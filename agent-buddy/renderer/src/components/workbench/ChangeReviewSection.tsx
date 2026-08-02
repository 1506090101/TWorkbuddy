import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  FileDiff,
  History,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import type {
  Changeset,
  Checkpoint,
  SessionChangedFile,
  SessionChangesetView,
  WorkSession,
} from "@shared/types";
import { IconButton } from "@components/common";
import { cn } from "@utils/cn";

export function ChangeReviewSection({
  session,
  focusChangesetId,
}: {
  session: WorkSession;
  focusChangesetId?: string;
}) {
  const [changesets, setChangesets] = useState<Changeset[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [view, setView] = useState<SessionChangesetView | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const reload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextChangesets, nextCheckpoints, nextView] = await Promise.all([
        window.electronAPI.listChangesets(session.id),
        window.electronAPI.listCheckpoints(session.id),
        window.electronAPI.getSessionChangesetView(session.id),
      ]);
      setChangesets(nextChangesets);
      setCheckpoints(nextCheckpoints);
      setView(nextView);
      setSelectedId((current) =>
        current && nextChangesets.some((item) => item.id === current)
          ? current
          : nextChangesets.at(-1)?.id
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取变更审查失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [session.id, session.events.length]);

  const selected = changesets.find((item) => item.id === selectedId);

  useEffect(() => {
    if (
      !focusChangesetId ||
      !changesets.some((item) => item.id === focusChangesetId)
    ) {
      return;
    }
    setSelectedId(focusChangesetId);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [changesets, focusChangesetId]);

  const decide = async (
    changeset: Changeset,
    path: string,
    hunkIndex: number,
    decision: "accepted" | "rejected"
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await window.electronAPI.decideChangesetHunk(
        session.id,
        changeset.id,
        path,
        hunkIndex,
        decision
      );
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新审查决定失败");
      setIsLoading(false);
    }
  };

  const runAction = async (
    action: () => Promise<unknown>,
    fallbackError: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallbackError);
      setIsLoading(false);
    }
  };

  const selectFile = (file: SessionChangedFile) => {
    const nextId = file.changesetIds.at(-1);
    if (nextId) setSelectedId(nextId);
  };

  const changeFiles = view?.files ?? [];

  return (
    <section ref={sectionRef} className="border-b border-border pb-4 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileDiff size={14} className="text-primary-500" />
          <h2 className="text-xs font-semibold text-content">变更审查</h2>
        </div>
        <div className="flex items-center gap-0.5">
          {changeFiles.length > 0 && (
            <>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<CheckCheck size={13} />}
                tooltip="接受全部待审查变更"
                aria-label="接受全部待审查变更"
                disabled={isLoading || view?.pendingFiles === 0}
                onClick={() =>
                  void runAction(
                    () => window.electronAPI.acceptAllChanges(session.id),
                    "接受全部变更失败"
                  )
                }
              />
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<RotateCcw size={13} />}
                tooltip="恢复本任务全部 Agent 变更"
                aria-label="恢复本任务全部 Agent 变更"
                disabled={isLoading}
                onClick={() =>
                  void runAction(
                    () => window.electronAPI.revertAllChanges(session.id),
                    "恢复全部变更失败"
                  )
                }
              />
            </>
          )}
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={
              <RefreshCw
                size={13}
                className={isLoading ? "animate-spin" : ""}
              />
            }
            tooltip="刷新变更审查"
            aria-label="刷新变更审查"
            disabled={isLoading}
            onClick={() => void reload()}
          />
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}

      {changeFiles.length === 0 && !isLoading && (
        <p className="mt-2 text-xs leading-5 text-content-muted">
          Agent 的写入或编辑会按本任务汇总在这里，供你接受或恢复。
        </p>
      )}

      {view && changeFiles.length > 0 && (
        <>
          <p className="mt-2 text-[10px] text-content-subtle">
            {view.totalFiles} 个文件，{view.checkpointCount} 个 Checkpoint，+
            {view.totalAdditions} -{view.totalDeletions}
          </p>
          <div className="mt-3 space-y-1.5">
            {changeFiles.map((file) => (
              <ChangeFileRow
                key={file.path}
                file={file}
                selected={selected?.id === file.changesetIds.at(-1)}
                isLoading={isLoading}
                onSelect={() => selectFile(file)}
                onAccept={() =>
                  void runAction(
                    () =>
                      window.electronAPI.acceptChangesetFile(
                        session.id,
                        file.path
                      ),
                    "接受文件变更失败"
                  )
                }
                onReject={() =>
                  void runAction(
                    () =>
                      window.electronAPI.rejectChangesetFile(
                        session.id,
                        file.path
                      ),
                    "恢复文件变更失败"
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {selected && (
        <div className="mt-3 border-t border-border-muted pt-3">
          {selected.reason && (
            <p className="mb-2 text-[11px] leading-5 text-content-muted">
              变更原因：{selected.reason}
            </p>
          )}
          {selected.files.map((file) => (
            <div key={file.path} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-code text-[11px] text-content-muted">
                  {file.path}
                </span>
                <span className="text-[10px] text-content-subtle">
                  +{file.additions} -{file.deletions}
                </span>
              </div>
              {file.hunks.map((hunk) => (
                <div
                  key={hunk.index}
                  className="mt-2 overflow-hidden border border-border"
                >
                  <div className="flex items-center justify-between gap-2 bg-surface-muted px-2 py-1">
                    <span className="font-code text-[10px] text-content-subtle">
                      {hunk.header}
                    </span>
                    <span className="flex items-center gap-1">
                      <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon={<Check size={12} />}
                        tooltip="接受此变更"
                        aria-label="接受此变更"
                        disabled={isLoading || hunk.decision !== "pending"}
                        onClick={() =>
                          void decide(
                            selected,
                            file.path,
                            hunk.index,
                            "accepted"
                          )
                        }
                      />
                      <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon={<RotateCcw size={12} />}
                        tooltip="拒绝并恢复此变更"
                        aria-label="拒绝并恢复此变更"
                        disabled={isLoading || hunk.decision !== "pending"}
                        onClick={() =>
                          void decide(
                            selected,
                            file.path,
                            hunk.index,
                            "rejected"
                          )
                        }
                      />
                    </span>
                  </div>
                  <pre className="selectable max-h-56 overflow-auto bg-surface text-[10px] leading-4 text-content-muted">
                    {hunk.lines.map((line, index) => (
                      <span
                        key={`${line.type}-${index}`}
                        className={cn(
                          "block whitespace-pre px-2",
                          line.type === "addition" &&
                            "bg-success-50 text-success-800",
                          line.type === "deletion" &&
                            "bg-danger-50 text-danger-800"
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
                  <p className="border-t border-border-muted px-2 py-1 text-[10px] text-content-subtle">
                    {getDecisionLabel(hunk.decision)}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {checkpoints.length > 0 && (
        <div className="mt-3 border-t border-border-muted pt-3">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-content-subtle">
            <History size={11} /> Checkpoints
          </p>
          <div className="space-y-1">
            {checkpoints
              .slice(-5)
              .reverse()
              .map((checkpoint) => (
                <div
                  key={checkpoint.id}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="min-w-0 truncate text-content-muted">
                    {checkpoint.description}
                  </span>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<RotateCcw size={12} />}
                    tooltip="回滚到此 Checkpoint"
                    aria-label={`回滚到 ${checkpoint.description}`}
                    disabled={isLoading}
                    onClick={() =>
                      void runAction(
                        () =>
                          window.electronAPI.rollbackCheckpoint(
                            session.id,
                            checkpoint.id
                          ),
                        "回滚 Checkpoint 失败"
                      )
                    }
                  />
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ChangeFileRow({
  file,
  selected,
  isLoading,
  onSelect,
  onAccept,
  onReject,
}: {
  file: SessionChangedFile;
  selected: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border",
        selected
          ? "border-primary-300 bg-primary-50 dark:bg-primary-900/20"
          : "border-border bg-surface hover:bg-surface-hover"
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 px-2.5 py-2 text-left"
        onClick={onSelect}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-code text-[11px] font-medium text-content">
            {file.path}
          </span>
          <span className="shrink-0 text-[10px] text-content-subtle">
            +{file.additions} -{file.deletions}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-content-subtle">
          <span>{getChangeTypeLabel(file.changeType)}</span>
          <span>{getReviewStatusLabel(file.reviewStatus)}</span>
          <span className="truncate">{file.reason}</span>
        </span>
      </button>
      <span className="mr-1 flex shrink-0 items-center gap-0.5">
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          icon={<Check size={12} />}
          tooltip="接受此文件的变更"
          aria-label={`接受 ${file.path} 的变更`}
          disabled={isLoading || file.reviewStatus === "accepted"}
          onClick={onAccept}
        />
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          icon={<RotateCcw size={12} />}
          tooltip="恢复此文件"
          aria-label={`恢复 ${file.path}`}
          disabled={isLoading || file.reviewStatus === "rejected"}
          onClick={onReject}
        />
      </span>
    </div>
  );
}

function getDecisionLabel(
  decision: "pending" | "accepted" | "rejected"
): string {
  return {
    pending: "等待审查",
    accepted: "已接受",
    rejected: "已拒绝并恢复",
  }[decision];
}

function getChangeTypeLabel(type: SessionChangedFile["changeType"]): string {
  return { create: "新增", modify: "修改", delete: "删除" }[type];
}

function getReviewStatusLabel(
  status: SessionChangedFile["reviewStatus"]
): string {
  return {
    pending: "待审查",
    accepted: "已接受",
    rejected: "已恢复",
    mixed: "部分处理",
  }[status];
}
