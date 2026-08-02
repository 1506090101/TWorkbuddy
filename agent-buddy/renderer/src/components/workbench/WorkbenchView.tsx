import { useEffect, useState } from "react";
import {
  CircleAlert,
  FolderOpen,
  GitBranch,
  Goal as GoalIcon,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Button, IconButton } from "@components/common";
import { useProviderStore } from "@stores/providerStore";
import { useWorkSessionStore } from "@stores/workSessionStore";
import { useUIStore } from "@stores/uiStore";
import { cn } from "@utils/cn";
import { AgentComposer } from "./AgentComposer";
import { AgentSelector } from "./AgentSelector";
import { WorkTimeline } from "./WorkTimeline";

export function WorkbenchView({
  onViewChangeInPanel,
}: {
  onViewChangeInPanel: (changesetId: string) => void;
}) {
  const activeSession = useWorkSessionStore((state) => state.activeSession);
  const isLoading = useWorkSessionStore((state) => state.isLoading);
  const error = useWorkSessionStore((state) => state.error);
  const initialize = useWorkSessionStore((state) => state.initialize);
  const applyEvent = useWorkSessionStore((state) => state.applyEvent);
  const clearError = useWorkSessionStore((state) => state.clearError);
  const loadProviders = useProviderStore((state) => state.loadProviders);
  const providers = useProviderStore((state) => state.providers);
  const createSession = useWorkSessionStore((state) => state.createSession);
  const createBranch = useWorkSessionStore((state) => state.createBranch);
  const renameSession = useWorkSessionStore((state) => state.renameSession);
  const openSettings = useUIStore((state) => state.openSettings);
  const [isRenaming, setIsRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    void initialize();
    void loadProviders();
    const unsubscribe = window.electronAPI.onWorkSessionEvent(applyEvent);
    return () => unsubscribe?.();
  }, [applyEvent, initialize, loadProviders]);

  useEffect(() => {
    if (activeSession && !isRenaming) setTitleDraft(activeSession.title);
  }, [activeSession, isRenaming]);

  const saveTitle = async () => {
    if (!titleDraft.trim()) return;
    await renameSession(titleDraft);
    setIsRenaming(false);
  };

  if (isLoading && !activeSession) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-content-muted">
        正在恢复工作会话…
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md px-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
            <Sparkles size={24} />
          </div>
          <h1 className="text-lg font-semibold text-content">
            开始一个开发任务
          </h1>
          <p className="mt-2 text-sm leading-6 text-content-muted">
            创建任务后，Agent 会在可恢复的工作流中记录上下文、工具和验证结果。
          </p>
          <Button
            className="mt-5"
            variant="primary"
            icon={<Sparkles size={15} />}
            onClick={() => void createSession()}
          >
            新建任务
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isRenaming ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveTitle();
                    if (event.key === "Escape") setIsRenaming(false);
                  }}
                  className="h-7 w-64 border border-primary-400 bg-surface px-2 text-sm font-semibold text-content outline-none"
                />
              ) : (
                <h1 className="truncate text-sm font-semibold text-content">
                  {activeSession.title}
                </h1>
              )}
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<Pencil size={13} />}
                tooltip="重命名任务"
                aria-label="重命名任务"
                onClick={() => {
                  setTitleDraft(activeSession.title);
                  setIsRenaming(true);
                }}
              />
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-content-subtle">
              <span className="inline-flex items-center gap-1">
                <FolderOpen size={11} />
                {activeSession.project?.name ?? "未选择项目"}
              </span>
              <span className="text-content-subtle">/</span>
              <AgentSelector session={activeSession} compact />
              <span className="text-content-subtle">/</span>
              <span className="inline-flex max-w-48 items-center gap-1 truncate">
                <Sparkles size={11} />
                {activeSession.modelOverride?.modelId ?? "Agent 默认模型"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={<GitBranch size={14} />}
            tooltip="创建任务分支"
            aria-label="创建任务分支"
            disabled={activeSession.status === "running"}
            onClick={() =>
              void createBranch({ parentSessionId: activeSession.id })
            }
          />
          {activeSession.goal && (
            <span className="hidden max-w-48 items-center gap-1 truncate border border-border bg-surface-muted px-2 py-1 text-content-muted sm:inline-flex">
              <GoalIcon size={12} className="text-primary-500" />
              {activeSession.goal.title}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1",
              activeSession.status === "failed"
                ? "text-danger-600"
                : activeSession.status === "running"
                  ? "text-primary-600"
                  : "text-success-600"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {getStatusLabel(activeSession.status)}
          </span>
        </div>
      </header>

      {providers.length === 0 && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-warning-200 bg-warning-50 px-5 py-2 text-xs text-warning-800 dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-300">
          <span className="inline-flex items-center gap-2">
            <CircleAlert size={14} />
            还没有配置可用模型，任务可以先保存，发送前请完成 Provider 配置。
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openSettings("providers")}
          >
            配置模型
          </Button>
        </div>
      )}

      {error && (
        <button
          type="button"
          className="shrink-0 border-b border-danger-200 bg-danger-50 px-5 py-2 text-left text-xs text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-300"
          onClick={clearError}
        >
          {error}
        </button>
      )}

      <WorkTimeline
        sessionId={activeSession.id}
        events={activeSession.events}
        goalId={activeSession.goal?.id}
        onViewChangeInPanel={onViewChangeInPanel}
      />
      <AgentComposer
        session={activeSession}
        hasProvider={providers.length > 0}
      />
    </div>
  );
}

function getStatusLabel(status: string): string {
  return (
    {
      idle: "待命",
      running: "工作中",
      completed: "已完成",
      failed: "需处理",
      aborted: "已停止",
      archived: "已归档",
    }[status] ?? "待命"
  );
}
