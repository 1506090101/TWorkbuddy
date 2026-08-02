import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronRight,
  FileDiff,
  RotateCcw,
} from "lucide-react";
import type { SessionChangesetView } from "@shared/types";
import { IconButton } from "@components/common";

interface InlineSessionChangesSummaryProps {
  sessionId: string;
  refreshToken: number;
  onViewInPanel: (changesetId: string) => void;
}

export function InlineSessionChangesSummary({
  sessionId,
  refreshToken,
  onViewInPanel,
}: InlineSessionChangesSummaryProps) {
  const [view, setView] = useState<SessionChangesetView>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setView(await window.electronAPI.getSessionChangesetView(sessionId));
  }, [sessionId]);

  useEffect(() => {
    void load().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "读取任务变更失败");
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

  if (!view || view.totalFiles < 2) return null;

  const handleShortcut = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (view.pendingFiles > 0) {
        void runAction(
          () => window.electronAPI.acceptAllChanges(sessionId),
          "接受全部变更失败"
        );
      }
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      if (view.pendingFiles > 0) {
        void runAction(
          () => window.electronAPI.revertAllChanges(sessionId),
          "恢复全部变更失败"
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
      aria-label={`任务级变更集，共 ${view.totalFiles} 个文件`}
    >
      <div className="flex items-center gap-2 border-b border-border-muted bg-surface-muted px-3 py-2">
        <FileDiff size={15} className="shrink-0 text-primary-500" />
        <span className="min-w-0 flex-1 text-xs font-medium text-content">
          本任务的 {view.totalFiles} 个文件变更
        </span>
        <span className="shrink-0 font-code text-[10px] text-content-subtle">
          <span className="text-success-700">+{view.totalAdditions}</span>{" "}
          <span className="text-danger-600">-{view.totalDeletions}</span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={<CheckCheck size={13} />}
            tooltip="接受全部文件变更（Ctrl+Enter）"
            aria-label="接受全部文件变更"
            disabled={isLoading || view.pendingFiles === 0}
            onClick={() =>
              void runAction(
                () => window.electronAPI.acceptAllChanges(sessionId),
                "接受全部变更失败"
              )
            }
          />
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={13} />}
            tooltip="恢复全部文件变更（Ctrl+Backspace）"
            aria-label="恢复全部文件变更"
            disabled={isLoading || view.pendingFiles === 0}
            onClick={() =>
              void runAction(
                () => window.electronAPI.revertAllChanges(sessionId),
                "恢复全部变更失败"
              )
            }
          />
        </span>
      </div>

      <div className="divide-y divide-border-muted">
        {view.files.map((file) => {
          const changesetId = file.changesetIds.at(-1);
          return (
            <div key={file.path} className="flex items-center gap-1 px-3 py-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => changesetId && onViewInPanel(changesetId)}
                disabled={!changesetId}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-code text-[11px] text-content-muted">
                    {file.path}
                  </span>
                  <span className="shrink-0 font-code text-[10px] text-content-subtle">
                    <span className="text-success-700">+{file.additions}</span>{" "}
                    <span className="text-danger-600">-{file.deletions}</span>
                  </span>
                  <ChevronRight
                    size={12}
                    className="shrink-0 text-content-subtle"
                  />
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-content-subtle">
                  {file.reason}
                </span>
              </button>
              <span className="flex shrink-0 items-center gap-0.5">
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Check size={12} />}
                  tooltip="接受此文件变更"
                  aria-label={`接受 ${file.path} 的变更`}
                  disabled={isLoading || file.reviewStatus !== "pending"}
                  onClick={() =>
                    void runAction(
                      () =>
                        window.electronAPI.acceptChangesetFile(
                          sessionId,
                          file.path
                        ),
                      "接受文件变更失败"
                    )
                  }
                />
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw size={12} />}
                  tooltip="恢复此文件变更"
                  aria-label={`恢复 ${file.path}`}
                  disabled={isLoading || file.reviewStatus !== "pending"}
                  onClick={() =>
                    void runAction(
                      () =>
                        window.electronAPI.rejectChangesetFile(
                          sessionId,
                          file.path
                        ),
                      "恢复文件变更失败"
                    )
                  }
                />
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border-muted px-3 py-1.5 text-[10px] text-content-subtle">
        {view.pendingFiles > 0
          ? `${view.pendingFiles} 个文件待审查`
          : view.rejectedFiles > 0
            ? "本任务变更已恢复"
            : "本任务变更已接受"}
      </div>
      {error && <p className="px-3 pb-2 text-xs text-danger-600">{error}</p>}
    </section>
  );
}
