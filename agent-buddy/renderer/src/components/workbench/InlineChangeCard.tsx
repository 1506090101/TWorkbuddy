import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileCode2,
  PanelRightOpen,
  RotateCcw,
} from "lucide-react";
import type { Changeset, DiffHunk, ReviewFileChange } from "@shared/types";
import { IconButton } from "@components/common";
import { cn } from "@utils/cn";

interface InlineChangeCardProps {
  sessionId: string;
  changesetId: string;
  refreshToken: number;
  onViewInPanel: (changesetId: string) => void;
}

export function InlineChangeCard({
  sessionId,
  changesetId,
  refreshToken,
  onViewInPanel,
}: InlineChangeCardProps) {
  const [changeset, setChangeset] = useState<Changeset>();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const changesets = await window.electronAPI.listChangesets(sessionId);
    setChangeset(changesets.find((item) => item.id === changesetId));
  }, [changesetId, sessionId]);

  useEffect(() => {
    void load().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "读取变更失败");
    });
  }, [load, refreshToken]);

  const runAction = async (
    action: () => Promise<unknown>,
    fallbackError: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallbackError);
    } finally {
      setIsLoading(false);
    }
  };

  if (!changeset) return null;

  const pendingHunks = changeset.files
    .flatMap((file) => file.hunks)
    .filter((hunk) => hunk.decision === "pending").length;
  const rejectedHunks = changeset.files
    .flatMap((file) => file.hunks)
    .filter((hunk) => hunk.decision === "rejected").length;

  const handleShortcut = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (pendingHunks > 0) {
        void runAction(
          () => window.electronAPI.acceptChangeset(sessionId, changeset.id),
          "接受变更失败"
        );
      }
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      if (pendingHunks > 0) {
        void runAction(
          () => window.electronAPI.rejectChangeset(sessionId, changeset.id),
          "恢复变更失败"
        );
      }
      return;
    }
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      void runAction(
        () => window.electronAPI.undoLastCheckpoint(sessionId),
        "回滚最后一个 Checkpoint 失败"
      );
    }
  };

  return (
    <section
      tabIndex={0}
      onKeyDown={handleShortcut}
      className="mt-3 overflow-hidden border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      aria-label={`代码变更：${changeset.files.map((file) => file.path).join("、")}`}
    >
      <div className="flex items-center gap-2 border-b border-border-muted bg-surface-muted px-3 py-2">
        <FileCode2 size={15} className="shrink-0 text-primary-500" />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() =>
            setExpandedFiles((current) =>
              current.size === changeset.files.length
                ? new Set()
                : new Set(changeset.files.map((file) => file.path))
            )
          }
        >
          <span className="block truncate font-code text-[11px] font-medium text-content">
            {changeset.files.length === 1
              ? changeset.files[0].path
              : `${changeset.files.length} 个文件变更`}
          </span>
          {changeset.reason && (
            <span className="mt-0.5 block truncate text-[10px] text-content-subtle">
              {changeset.reason}
            </span>
          )}
        </button>
        <span className="shrink-0 font-code text-[10px] text-content-subtle">
          <span className="text-success-700">+{changeset.totalAdditions}</span>{" "}
          <span className="text-danger-600">-{changeset.totalDeletions}</span>
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={<CheckCheck size={13} />}
            tooltip="接受此变更（Ctrl+Enter）"
            aria-label="接受此变更"
            disabled={isLoading || pendingHunks === 0}
            onClick={() =>
              void runAction(
                () =>
                  window.electronAPI.acceptChangeset(sessionId, changeset.id),
                "接受变更失败"
              )
            }
          />
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={13} />}
            tooltip="恢复此变更（Ctrl+Backspace）"
            aria-label="恢复此变更"
            disabled={isLoading || pendingHunks === 0}
            onClick={() =>
              void runAction(
                () =>
                  window.electronAPI.rejectChangeset(sessionId, changeset.id),
                "恢复变更失败"
              )
            }
          />
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={<PanelRightOpen size={13} />}
            tooltip="在变更审查面板中查看"
            aria-label="在变更审查面板中查看"
            onClick={() => onViewInPanel(changeset.id)}
          />
        </div>
      </div>

      {pendingHunks === 0 && (
        <p
          className={cn(
            "border-b border-border-muted px-3 py-1.5 text-[10px]",
            rejectedHunks > 0 ? "text-content-subtle" : "text-success-700"
          )}
        >
          {rejectedHunks > 0 ? "此变更已恢复" : "此变更已接受"}
        </p>
      )}

      <div className="divide-y divide-border-muted">
        {changeset.files.map((file) => (
          <InlineFileChange
            key={file.path}
            file={file}
            expanded={expandedFiles.has(file.path)}
            isLoading={isLoading}
            onToggle={() =>
              setExpandedFiles((current) => {
                const next = new Set(current);
                if (next.has(file.path)) next.delete(file.path);
                else next.add(file.path);
                return next;
              })
            }
            onDecide={(hunkIndex, decision) =>
              void runAction(
                () =>
                  window.electronAPI.decideChangesetHunk(
                    sessionId,
                    changeset.id,
                    file.path,
                    hunkIndex,
                    decision
                  ),
                "更新变更决定失败"
              )
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border-muted px-3 py-1.5 text-[10px] text-content-subtle">
        <span>
          <kbd className="border border-border bg-surface px-1 font-code">
            Ctrl+Enter
          </kbd>{" "}
          接受
        </span>
        <span>
          <kbd className="border border-border bg-surface px-1 font-code">
            Ctrl+Backspace
          </kbd>{" "}
          恢复
        </span>
        <span>
          <kbd className="border border-border bg-surface px-1 font-code">
            Ctrl+Z
          </kbd>{" "}
          回滚最后一个 Checkpoint
        </span>
      </div>

      {error && <p className="px-3 pb-2 text-xs text-danger-600">{error}</p>}
    </section>
  );
}

function InlineFileChange({
  file,
  expanded,
  isLoading,
  onToggle,
  onDecide,
}: {
  file: ReviewFileChange;
  expanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onDecide: (hunkIndex: number, decision: "accepted" | "rejected") => void;
}) {
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown size={13} className="shrink-0 text-content-subtle" />
        ) : (
          <ChevronRight size={13} className="shrink-0 text-content-subtle" />
        )}
        <span className="min-w-0 flex-1 truncate font-code text-[11px] text-content-muted">
          {file.path}
        </span>
        <span className="shrink-0 font-code text-[10px] text-content-subtle">
          <span className="text-success-700">+{file.additions}</span>{" "}
          <span className="text-danger-600">-{file.deletions}</span>
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border-muted">
          {file.hunks.map((hunk) => (
            <InlineHunk
              key={hunk.index}
              hunk={hunk}
              isLoading={isLoading}
              onDecide={onDecide}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InlineHunk({
  hunk,
  isLoading,
  onDecide,
}: {
  hunk: DiffHunk;
  isLoading: boolean;
  onDecide: (hunkIndex: number, decision: "accepted" | "rejected") => void;
}) {
  return (
    <div className="border-b border-border-muted last:border-b-0">
      <div className="flex items-center justify-between gap-2 bg-surface-muted px-3 py-1">
        <span className="truncate font-code text-[10px] text-content-subtle">
          {hunk.header}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {hunk.decision === "pending" ? (
            <>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<Check size={12} />}
                tooltip="接受此 hunk"
                aria-label="接受此 hunk"
                disabled={isLoading}
                onClick={() => onDecide(hunk.index, "accepted")}
              />
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<RotateCcw size={12} />}
                tooltip="恢复此 hunk"
                aria-label="恢复此 hunk"
                disabled={isLoading}
                onClick={() => onDecide(hunk.index, "rejected")}
              />
            </>
          ) : (
            <span
              className={cn(
                "text-[10px]",
                hunk.decision === "accepted"
                  ? "text-success-700"
                  : "text-content-subtle"
              )}
            >
              {hunk.decision === "accepted" ? "已接受" : "已恢复"}
            </span>
          )}
        </span>
      </div>
      <pre className="selectable max-h-64 overflow-auto bg-surface font-code text-[10px] leading-4 text-content-muted">
        {hunk.lines.map((line, index) => (
          <span
            key={`${line.type}-${index}`}
            className={cn(
              "block whitespace-pre px-3",
              line.type === "addition" && "bg-success-50 text-success-800",
              line.type === "deletion" && "bg-danger-50 text-danger-800"
            )}
          >
            {line.type === "addition"
              ? "+"
              : line.type === "deletion"
                ? "-"
                : " "}
            {line.content}
          </span>
        ))}
      </pre>
    </div>
  );
}
