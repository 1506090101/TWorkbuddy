import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleCheck,
  FileCode2,
  Flag,
  FolderSearch,
  Plus,
  Plug,
  RefreshCw,
  Target,
  Trash2,
  Wrench,
} from "lucide-react";
import type {
  AgentListItem,
  GitStatus,
  GoalStatus,
  GoalStep,
  ProjectContext,
  WorkSession,
} from "@shared/types";
import { Button, IconButton } from "@components/common";
import { useWorkSessionStore } from "@stores/workSessionStore";
import { ChangeReviewSection } from "./ChangeReviewSection";
import { BranchSection } from "./BranchSection";
import { ContextBudgetSection } from "./ContextBudgetSection";

interface SessionInspectorProps {
  session: WorkSession | null;
  focusChangesetId?: string;
}

export function SessionInspector({
  session,
  focusChangesetId,
}: SessionInspectorProps) {
  if (!session) {
    return (
      <div className="p-5 text-xs text-content-muted">
        选择一个任务查看上下文。
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <span className="text-xs font-semibold text-content">任务上下文</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <BranchSection session={session} />
        <GoalSection session={session} />
        <ProjectContextSection session={session} />
        <ChangeReviewSection
          session={session}
          focusChangesetId={focusChangesetId}
        />
        <ContextBudgetSection session={session} />
        <ContextSection
          title="工具活动"
          icon={<Wrench size={14} />}
          value={`${session.events.filter((event) => event.type === "tool_call").length} 次调用`}
        />
        <ContextSection
          title="文件附件"
          icon={<FileCode2 size={14} />}
          value={`${session.attachments.length} 个文件`}
        />
        <ContextSection
          title="插件上下文"
          icon={<Plug size={14} />}
          value={
            session.pluginIds.length
              ? `${session.pluginIds.length} 个已启用`
              : "未启用"
          }
        />
        <AgentContext session={session} />
      </div>
    </div>
  );
}

function GoalSection({ session }: { session: WorkSession }) {
  const updateGoal = useWorkSessionStore((state) => state.updateGoal);
  const stopGoal = useWorkSessionStore((state) => state.stopGoal);
  const replanGoal = useWorkSessionStore((state) => state.replanGoal);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.goal?.title ?? "");
  const [description, setDescription] = useState(
    session.goal?.description ?? ""
  );
  const [status, setStatus] = useState<GoalStatus>(
    session.goal?.status ?? "active"
  );
  const [blockedReason, setBlockedReason] = useState(
    session.goal?.blockedReason ?? ""
  );
  const [steps, setSteps] = useState<GoalStep[]>(session.goal?.steps ?? []);

  useEffect(() => {
    if (editing) return;
    setTitle(session.goal?.title ?? "");
    setDescription(session.goal?.description ?? "");
    setStatus(session.goal?.status ?? "active");
    setBlockedReason(session.goal?.blockedReason ?? "");
    setSteps(session.goal?.steps ?? []);
  }, [editing, session.goal]);

  const save = async () => {
    if (!title.trim()) return;
    await updateGoal({
      id: session.goal?.id,
      title,
      description,
      status,
      executionStatus: session.goal?.executionStatus,
      blockedReason,
      steps,
      result: session.goal?.result,
    });
    setEditing(false);
  };

  const updateStepStatus = async (
    stepId: string,
    nextStatus: GoalStep["status"]
  ) => {
    if (!session.goal) return;
    await updateGoal({
      id: session.goal.id,
      title: session.goal.title,
      description: session.goal.description,
      status: session.goal.status,
      executionStatus: session.goal.executionStatus,
      blockedReason: session.goal.blockedReason,
      steps: session.goal.steps.map((step) =>
        step.id === stepId ? { ...step, status: nextStatus } : step
      ),
      result: session.goal.result,
    });
  };

  const completedSteps =
    session.goal?.steps.filter((step) => step.status === "completed").length ??
    0;
  const stepProgress = session.goal?.steps.length
    ? Math.round((completedSteps / session.goal.steps.length) * 100)
    : 0;

  const stop = async () => {
    await window.electronAPI.abort(session.id);
    await stopGoal();
  };

  return (
    <section className="border-b border-border pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-primary-500" />
          <h2 className="text-xs font-semibold text-content">会话目标</h2>
        </div>
        {session.goal && !editing && (
          <div className="flex items-center gap-0.5">
            {session.goal.status !== "completed" &&
              session.goal.executionStatus !== "stopped" && (
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<CircleAlert size={13} />}
                  tooltip="停止目标执行"
                  aria-label="停止目标执行"
                  onClick={() => void stop()}
                />
              )}
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              icon={<RefreshCw size={13} />}
              tooltip="重新规划目标"
              aria-label="重新规划目标"
              onClick={() => void replanGoal()}
            />
            <button
              type="button"
              className="text-[11px] text-primary-600 hover:text-primary-700"
              onClick={() => setEditing(true)}
            >
              编辑
            </button>
          </div>
        )}
      </div>

      {!session.goal && !editing && (
        <button
          type="button"
          className="mt-3 flex w-full items-center gap-2 border border-dashed border-border-strong px-3 py-2.5 text-left text-xs text-content-muted hover:border-primary-300 hover:text-content"
          onClick={() => setEditing(true)}
        >
          <Flag size={13} />
          设置一个目标，让 Agent 保持方向
        </button>
      )}

      {session.goal && !editing && (
        <div className="mt-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-content">
              {session.goal.title}
            </p>
            <div className="flex items-center gap-2">
              <GoalStatusBadge status={session.goal.status} />
              <GoalExecutionBadge status={session.goal.executionStatus} />
            </div>
          </div>
          {session.goal.description && (
            <p className="mt-1 text-xs leading-5 text-content-muted">
              {session.goal.description}
            </p>
          )}
          {session.goal.status === "blocked" && session.goal.blockedReason && (
            <p className="mt-2 border-l-2 border-danger-400 pl-2 text-xs leading-5 text-danger-700 dark:text-danger-300">
              {session.goal.blockedReason}
            </p>
          )}
          {session.goal.steps.length > 0 && (
            <>
              <div className="mt-3 h-1.5 overflow-hidden bg-surface-muted">
                <span
                  className="block h-full bg-primary-500 transition-[width]"
                  style={{ width: `${stepProgress}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-content-subtle">
                {completedSteps} / {session.goal.steps.length} 步骤完成
              </p>
              <div className="mt-2 space-y-1.5">
                {session.goal.steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-1.5 text-xs text-content-muted"
                  >
                    <StepStatusIcon status={step.status} />
                    <span className="min-w-0 flex-1 truncate">
                      {step.title}
                    </span>
                    <select
                      value={step.status}
                      aria-label={`更新步骤状态：${step.title}`}
                      className="max-w-20 bg-transparent text-[10px] text-content-subtle outline-none"
                      onChange={(event) =>
                        void updateStepStatus(
                          step.id,
                          event.target.value as GoalStep["status"]
                        )
                      }
                    >
                      <option value="pending">待开始</option>
                      <option value="in_progress">进行中</option>
                      <option value="completed">完成</option>
                      <option value="blocked">阻塞</option>
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：修复登录流程中的异常"
            className="h-8 w-full border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="补充完成标准或限制条件"
            className="w-full resize-none border border-border bg-surface px-2 py-1.5 text-xs leading-5 text-content outline-none focus:border-primary-400"
          />
          <label className="block text-[11px] text-content-muted">
            目标状态
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as GoalStatus)}
              className="mt-1 h-8 w-full border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
            >
              <option value="draft">草稿</option>
              <option value="active">进行中</option>
              <option value="blocked">阻塞</option>
              <option value="completed">完成</option>
            </select>
          </label>
          {status === "blocked" && (
            <label className="block text-[11px] text-content-muted">
              阻塞原因
              <textarea
                value={blockedReason}
                onChange={(event) => setBlockedReason(event.target.value)}
                rows={2}
                placeholder="说明需要用户或外部条件处理的事项"
                className="mt-1 w-full resize-none border border-border bg-surface px-2 py-1.5 text-xs leading-5 text-content outline-none focus:border-primary-400"
              />
            </label>
          )}
          <div className="space-y-1.5 border-t border-border-muted pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-content-muted">任务步骤</span>
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus size={12} />}
                onClick={() =>
                  setSteps((current) => [
                    ...current,
                    {
                      id: `step_${Date.now()}_${current.length}`,
                      title: "",
                      status: "pending",
                    },
                  ])
                }
              >
                添加
              </Button>
            </div>
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-1.5">
                <input
                  value={step.title}
                  onChange={(event) =>
                    setSteps((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, title: event.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="步骤名称"
                  className="h-8 min-w-0 flex-1 border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
                />
                <select
                  value={step.status}
                  aria-label={`步骤 ${index + 1} 状态`}
                  onChange={(event) =>
                    setSteps((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              status: event.target.value as GoalStep["status"],
                            }
                          : item
                      )
                    )
                  }
                  className="h-8 max-w-20 border border-border bg-surface px-1 text-[10px] text-content-muted outline-none focus:border-primary-400"
                >
                  <option value="pending">待开始</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">完成</option>
                  <option value="blocked">阻塞</option>
                </select>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={13} />}
                  tooltip="移除步骤"
                  aria-label="移除步骤"
                  onClick={() =>
                    setSteps((current) =>
                      current.filter((item) => item.id !== step.id)
                    )
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!title.trim()}
              onClick={() => void save()}
            >
              保存目标
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function StepStatusIcon({ status }: { status: GoalStep["status"] }) {
  if (status === "completed") {
    return <CircleCheck size={13} className="shrink-0 text-success-500" />;
  }
  if (status === "blocked") {
    return <CircleAlert size={13} className="shrink-0 text-danger-500" />;
  }
  if (status === "in_progress") {
    return <Circle size={13} className="shrink-0 text-primary-500" />;
  }
  return <Circle size={13} className="shrink-0 text-content-subtle" />;
}

function ProjectContextSection({ session }: { session: WorkSession }) {
  const rootPath = session.project?.rootPath;
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (!rootPath) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const contextPromise = refresh
        ? window.electronAPI.refreshProjectContext(rootPath)
        : window.electronAPI
            .getProjectContext(rootPath)
            .then(
              (cached) => cached ?? window.electronAPI.detectProject(rootPath)
            );
      const [next, nextGitStatus] = await Promise.all([
        contextPromise,
        window.electronAPI.getGitStatus(rootPath),
      ]);
      setContext(next);
      setGitStatus(nextGitStatus);
    } catch (cause) {
      setContext(null);
      setGitStatus(null);
      setError(cause instanceof Error ? cause.message : "项目检测失败");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setContext(null);
    setGitStatus(null);
    setError(null);
    if (rootPath) void load();
  }, [rootPath]);

  return (
    <section className="border-b border-border pb-4 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderSearch size={14} className="text-primary-500" />
          <h2 className="text-xs font-semibold text-content">项目上下文</h2>
        </div>
        {rootPath && (
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={
              <RefreshCw
                size={13}
                className={isRefreshing ? "animate-spin" : ""}
              />
            }
            tooltip="刷新项目检测"
            aria-label="刷新项目检测"
            disabled={isRefreshing}
            onClick={() => void load(true)}
          />
        )}
      </div>

      {!rootPath && (
        <p className="mt-2 text-xs leading-5 text-content-muted">
          选择项目目录后，Agent 会获得裁剪后的技术栈和常用脚本摘要。
        </p>
      )}

      {rootPath && isRefreshing && !context && (
        <p className="mt-2 text-xs text-content-muted">正在识别项目…</p>
      )}

      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}

      {context && (
        <div className="mt-3 space-y-2 text-[11px] leading-5 text-content-muted">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{context.type}</span>
            <span>{context.language}</span>
            {context.framework && <span>{context.framework}</span>}
            {context.packageManager && <span>{context.packageManager}</span>}
          </div>
          {context.buildSystem && <p>构建：{context.buildSystem}</p>}
          {(context.testCommand ||
            context.lintCommand ||
            context.buildCommand) && (
            <p>
              {[
                context.testCommand && `测试 ${context.testCommand}`,
                context.lintCommand && `检查 ${context.lintCommand}`,
                context.buildCommand && `构建 ${context.buildCommand}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {context.structure.sourceDirs.length > 0 && (
            <p>源码：{context.structure.sourceDirs.join(" · ")}</p>
          )}
          {context.structure.testDirs.length > 0 && (
            <p>测试：{context.structure.testDirs.join(" · ")}</p>
          )}
          {gitStatus && (
            <p>
              Git：{gitStatus.branch} · {gitStatus.totalChanges} 项变更
              {gitStatus.ahead || gitStatus.behind
                ? ` · ↑${gitStatus.ahead} ↓${gitStatus.behind}`
                : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function AgentContext({ session }: { session: WorkSession }) {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const agent = agents.find((item) => item.id === session.activeAgentId);

  useEffect(() => {
    let disposed = false;
    void window.electronAPI.listAgents().then((items) => {
      if (!disposed) setAgents(items);
    });
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-content-subtle">
        当前 Agent
      </p>
      <p className="mt-1 text-sm text-content">
        {agent?.name ?? session.activeAgentId}
      </p>
      <p className="mt-1 text-xs leading-5 text-content-muted">
        {agent?.description ?? "正在加载 Agent 定义"}
      </p>
      {agent && (
        <p className="mt-2 text-[11px] leading-5 text-content-subtle">
          工具：{agent.tools.join(" · ") || "未配置"}
          {agent.skills.length > 0 && `\n技能：${agent.skills.join(" · ")}`}
        </p>
      )}
      <p className="mt-2 text-xs text-content-muted">
        {session.modelOverride
          ? `${session.modelOverride.providerId} / ${session.modelOverride.modelId}`
          : "使用 Agent 默认模型"}
      </p>
    </div>
  );
}

function ContextSection({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border-muted py-3">
      <span className="flex items-center gap-2 text-xs text-content-muted">
        {icon}
        {title}
      </span>
      <span className="text-[11px] text-content-subtle">{value}</span>
    </div>
  );
}

function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const labels: Record<GoalStatus, string> = {
    draft: "草稿",
    active: "进行中",
    blocked: "阻塞",
    completed: "完成",
  };
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-content-subtle">
      <CheckCircle2
        size={11}
        className={
          status === "completed" ? "text-success-500" : "text-primary-500"
        }
      />
      {labels[status]}
    </span>
  );
}

function GoalExecutionBadge({
  status,
}: {
  status: NonNullable<WorkSession["goal"]>["executionStatus"];
}) {
  const labels = {
    idle: "未启动",
    running: "执行中",
    stopped: "已停止",
  };
  const colors = {
    idle: "text-content-subtle",
    running: "text-primary-600",
    stopped: "text-warning-600",
  };
  return (
    <span className={`text-[10px] ${colors[status]}`}>{labels[status]}</span>
  );
}
