import { useEffect, useMemo, useRef, useState } from "react";
import { Command, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@utils/cn";

const HISTORY_KEY = "agent-buddy-command-history";
const MAX_HISTORY = 8;

export interface CommandItem {
  id: string;
  label: string;
  description: string;
  category: string;
  keywords: string[];
  shortcut?: string;
  icon: LucideIcon;
  enabled?: boolean;
  action: () => void | Promise<void>;
}

interface CommandPaletteProps {
  isOpen: boolean;
  commands: CommandItem[];
  onClose: () => void;
}

export function CommandPalette({
  isOpen,
  commands,
  onClose,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(readHistory);
  const [runningId, setRunningId] = useState<string>();
  const [error, setError] = useState<string>();

  const results = useMemo(
    () => rankCommands(commands, query, recentIds),
    [commands, query, recentIds]
  );

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);
    setError(undefined);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex((index) =>
      Math.min(index, Math.max(results.length - 1, 0))
    );
  }, [results.length]);

  const execute = async (item: CommandItem) => {
    if (item.enabled === false || runningId) return;
    setError(undefined);
    setRunningId(item.id);
    try {
      await item.action();
      const nextRecent = [
        item.id,
        ...recentIds.filter((id) => id !== item.id),
      ].slice(0, MAX_HISTORY);
      setRecentIds(nextRecent);
      writeHistory(nextRecent);
      onClose();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setRunningId(undefined);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 pt-[14vh]"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        className="w-full max-w-xl overflow-hidden rounded-md border border-border bg-surface shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
          <Search size={16} className="shrink-0 text-content-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((index) =>
                  Math.min(index + 1, results.length - 1)
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const item = results[selectedIndex];
                if (item) void execute(item);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="搜索工作台命令"
            aria-label="搜索工作台命令"
            className="min-w-0 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-content-subtle"
          />
          <kbd className="border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] text-content-subtle">
            Esc
          </kbd>
        </div>

        {error && (
          <p className="border-b border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-900/50 dark:bg-danger-950/30 dark:text-danger-300">
            {error}
          </p>
        )}

        <div className="max-h-[min(56vh,420px)] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-content-muted">
              未找到匹配的工作台命令
            </div>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              const active = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.enabled === false || Boolean(runningId)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => void execute(item)}
                  className={cn(
                    "flex w-full items-center gap-3 px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40",
                    active
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : "hover:bg-surface-hover"
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-surface-muted text-content-muted">
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-content">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-content-subtle">
                        {item.category}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-content-muted">
                      {item.description}
                    </span>
                  </span>
                  {item.shortcut && (
                    <kbd className="shrink-0 border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] text-content-subtle">
                      {item.shortcut}
                    </kbd>
                  )}
                  {runningId === item.id && (
                    <Command
                      size={13}
                      className="shrink-0 animate-pulse text-primary-600"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function rankCommands(
  commands: CommandItem[],
  query: string,
  recentIds: string[]
): CommandItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  const recentRank = new Map(recentIds.map((id, index) => [id, index]));
  return commands
    .filter((item) => item.enabled !== false)
    .map((item) => ({
      item,
      score: getScore(item, normalized),
      recent: recentRank.get(item.id) ?? Number.MAX_SAFE_INTEGER,
    }))
    .filter(({ score }) => normalized.length === 0 || score > 0)
    .sort((left, right) =>
      normalized.length === 0
        ? left.recent - right.recent ||
          left.item.label.localeCompare(right.item.label)
        : right.score - left.score || left.recent - right.recent
    )
    .map(({ item }) => item);
}

function getScore(item: CommandItem, query: string): number {
  if (!query) return 1;
  const label = item.label.toLocaleLowerCase();
  const haystack = [label, item.category, item.description, ...item.keywords]
    .join(" ")
    .toLocaleLowerCase();
  return query.split(/\s+/).reduce((score, token) => {
    if (!haystack.includes(token)) return score;
    if (label.startsWith(token)) return score + 12;
    if (label.includes(token)) return score + 8;
    return score + 3;
  }, 0);
}

function readHistory(): string[] {
  try {
    const value = localStorage.getItem(HISTORY_KEY);
    const items = value ? (JSON.parse(value) as unknown) : [];
    return Array.isArray(items)
      ? items
          .filter((item): item is string => typeof item === "string")
          .slice(0, MAX_HISTORY)
      : [];
  } catch {
    return [];
  }
}

function writeHistory(items: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // Recent command ordering is optional UI state.
  }
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "命令执行失败";
}
