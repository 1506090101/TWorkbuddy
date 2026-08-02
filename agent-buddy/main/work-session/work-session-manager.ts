import { randomUUID } from "crypto";
import { app } from "electron";
import Store from "electron-store";
import { join } from "path";
import type {
  AgentEvent,
  ComposerContext,
  Goal,
  GoalExecutionStatus,
  GoalInput,
  GoalStatus,
  PermissionDecision,
  PermissionRequest,
  WorkAttachment,
  WorkEvent,
  WorkEventStatus,
  WorkSession,
  WorkSessionBranchInput,
  WorkSessionBranchOperationResult,
  WorkSessionBranchType,
  WorkSessionCreateInput,
  WorkSessionStatus,
  WorkSessionSummary,
} from "@shared/types";

interface WorkSessionStoreData {
  sessions: Record<string, WorkSession>;
  activeSessionId?: string;
  version: number;
}

type WorkEventListener = (event: WorkEvent) => void;

const MAX_EVENT_CONTENT_LENGTH = 48_000;
const MAX_METADATA_STRING_LENGTH = 2_000;
const SENSITIVE_KEY_PATTERN =
  /api.?key|authorization|credential|password|secret|token/i;

export class WorkSessionManager {
  private readonly store: Store<WorkSessionStoreData>;
  private readonly listeners = new Set<WorkEventListener>();

  constructor() {
    this.store = new Store<WorkSessionStoreData>({
      cwd: join(app.getPath("home"), ".agentbuddy", "sessions"),
      name: "work-sessions",
      defaults: { sessions: {}, version: 2 },
    });
  }

  list(): WorkSessionSummary[] {
    return Object.values(this.store.get("sessions"))
      .filter((session) => session.status !== "archived")
      .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
      .map((session) => this.toSummary(session));
  }

  get(sessionId: string): WorkSession {
    const session = this.store.get("sessions")[sessionId];
    if (!session) throw new Error("WORK_SESSION_NOT_FOUND");
    return normalizeSession(clone(session));
  }

  open(sessionId: string): WorkSession {
    const session = this.getMutable(sessionId);
    if (session.status === "archived") throw new Error("WORK_SESSION_ARCHIVED");
    return this.touch(session);
  }

  create(input: WorkSessionCreateInput = {}): WorkSession {
    const now = Date.now();
    const session: WorkSession = {
      id: `work_${randomUUID()}`,
      title: sanitizeTitle(input.title) || "新建任务",
      project: sanitizeProject(input.project),
      activeAgentId: sanitizeAgentId(input.agentId),
      pluginIds: [],
      attachments: [],
      events: [],
      status: "idle",
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };
    this.write(session, true);
    return clone(session);
  }

  createBranch(input: WorkSessionBranchInput): WorkSession {
    const parent = this.getMutable(input.parentSessionId);
    if (parent.status === "archived") throw new Error("WORK_SESSION_ARCHIVED");

    const now = Date.now();
    const contextSummary = sanitizeBranchSummary(
      input.contextSummary || buildBranchContextSummary(parent)
    );
    if (!contextSummary) throw new Error("BRANCH_CONTEXT_REQUIRED");
    const branchType = sanitizeBranchType(input.type);

    const branch: WorkSession = {
      id: `work_${randomUUID()}`,
      title: sanitizeTitle(input.title) || `${parent.title} - 分支`,
      project: parent.project ? clone(parent.project) : undefined,
      activeAgentId: sanitizeAgentId(input.agentId ?? parent.activeAgentId),
      modelOverride: parent.modelOverride
        ? clone(parent.modelOverride)
        : undefined,
      pluginIds: [...parent.pluginIds],
      goal: cloneGoalForBranch(parent.goal, now),
      branch: {
        parentSessionId: parent.id,
        type: branchType,
        contextSummary,
        mergeStatus: "pending",
        createdAt: now,
        updatedAt: now,
      },
      attachments: [],
      events: [],
      status: "idle",
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };

    this.write(branch, true);
    this.recordSystemActivity(branch.id, {
      title: "已从任务创建分支",
      content: parent.title,
      metadata: { parentSessionId: parent.id, branchType },
    });
    this.recordSystemActivity(parent.id, {
      title: "已创建任务分支",
      content: branch.title,
      metadata: { branchSessionId: branch.id, branchType },
    });
    return this.get(branch.id);
  }

  updateBranchSummary(sessionId: string, contextSummary: string): WorkSession {
    const session = this.getMutable(sessionId);
    if (!session.branch) throw new Error("WORK_SESSION_NOT_A_BRANCH");
    if (session.branch.mergeStatus !== "pending") {
      throw new Error("WORK_SESSION_BRANCH_CLOSED");
    }
    const nextSummary = sanitizeBranchSummary(contextSummary);
    if (!nextSummary) throw new Error("BRANCH_CONTEXT_REQUIRED");
    session.branch.contextSummary = nextSummary;
    session.branch.updatedAt = Date.now();
    this.write(session);
    this.recordSystemActivity(sessionId, {
      title: "已更新分支上下文摘要",
      metadata: { parentSessionId: session.branch.parentSessionId },
    });
    return this.get(sessionId);
  }

  mergeBranch(sessionId: string): WorkSessionBranchOperationResult {
    const branch = this.getMutable(sessionId);
    const parent = this.getMutableBranchParent(branch);
    this.assertPendingBranch(branch);

    const mergeEvent = this.recordEvent(parent.id, {
      type: "summary",
      status: "completed",
      title: "已合并分支结果",
      content: buildBranchMergeSummary(branch),
      metadata: {
        branchSessionId: branch.id,
        branchTitle: branch.title,
        branchStatus: branch.status,
      },
      agentId: branch.activeAgentId,
    });
    branch.branch!.mergeStatus = "merged";
    branch.branch!.mergedAt = Date.now();
    branch.branch!.mergeEventId = mergeEvent.id;
    branch.branch!.updatedAt = Date.now();
    this.write(branch);
    const parentSession = this.touch(this.getMutable(parent.id));
    return { parentSession, branchSession: this.get(branch.id) };
  }

  discardBranch(sessionId: string): WorkSessionBranchOperationResult {
    const branch = this.getMutable(sessionId);
    const parent = this.getMutableBranchParent(branch);
    this.assertPendingBranch(branch);

    branch.branch!.mergeStatus = "discarded";
    branch.branch!.updatedAt = Date.now();
    branch.status = "archived";
    branch.archivedAt = Date.now();
    this.write(branch);
    this.recordSystemActivity(parent.id, {
      title: "已丢弃任务分支",
      content: branch.title,
      metadata: { branchSessionId: branch.id },
    });
    const parentSession = this.touch(this.getMutable(parent.id));
    return { parentSession, branchSession: this.get(branch.id) };
  }

  recover(): WorkSession {
    const activeSessionId = this.store.get("activeSessionId");
    if (activeSessionId) {
      const active = this.store.get("sessions")[activeSessionId];
      if (active && active.status !== "archived") return this.touch(active);
    }

    const latest = Object.values(this.store.get("sessions"))
      .filter((session) => session.status !== "archived")
      .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)[0];
    return latest ? this.touch(latest) : this.create();
  }

  rename(sessionId: string, title: string): WorkSession {
    const session = this.getMutable(sessionId);
    session.title = sanitizeTitle(title) || session.title;
    this.write(session, true);
    return clone(session);
  }

  archive(sessionId: string): WorkSession {
    const session = this.getMutable(sessionId);
    if (session.branch?.mergeStatus === "pending") {
      session.branch.mergeStatus = "discarded";
      session.branch.updatedAt = Date.now();
    }
    session.status = "archived";
    session.archivedAt = Date.now();
    this.write(session, this.store.get("activeSessionId") === sessionId);
    return clone(session);
  }

  updateGoal(sessionId: string, input?: GoalInput): WorkSession {
    const session = this.getMutable(sessionId);
    if (!input) {
      session.goal = undefined;
      this.write(session);
      return clone(session);
    }

    const now = Date.now();
    const existing = session.goal;
    const title = sanitizeTitle(input.title);
    if (!title) throw new Error("GOAL_TITLE_REQUIRED");
    const status = sanitizeGoalStatus(input.status ?? existing?.status);

    const goal: Goal = {
      id: input.id ?? existing?.id ?? `goal_${randomUUID()}`,
      title,
      description: sanitizeContent(input.description, 4_000) || undefined,
      status,
      executionStatus: sanitizeGoalExecutionStatus(
        input.executionStatus ??
          (status === "completed" ? "idle" : existing?.executionStatus)
      ),
      blockedReason:
        status === "blocked"
          ? sanitizeContent(
              input.blockedReason ?? existing?.blockedReason,
              2_000
            ) || undefined
          : undefined,
      steps: (input.steps ?? existing?.steps ?? []).map((step) => ({
        id: step.id || `goal_step_${randomUUID()}`,
        title: sanitizeTitle(step.title) || "未命名步骤",
        status: sanitizeGoalStepStatus(step.status),
      })),
      result: sanitizeContent(input.result, 8_000) || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    session.goal = goal;
    this.write(session);
    if (!existing) {
      this.recordEvent(session.id, {
        type: "system",
        status: "info",
        title: "已设置任务目标",
        content: goal.title,
      });
    } else {
      this.recordEvent(session.id, {
        type: "system",
        status: "info",
        title:
          existing.status !== goal.status ? "已更新目标状态" : "已更新任务目标",
        content:
          existing.status !== goal.status
            ? `${goal.title}：${getGoalStatusLabel(goal.status)}`
            : goal.title,
      });
      if (JSON.stringify(existing.steps) !== JSON.stringify(goal.steps)) {
        this.recordEvent(session.id, {
          type: "system",
          status: "info",
          title: "已更新任务步骤",
          content: `${goal.steps.length} 个步骤`,
        });
      }
      if (existing.blockedReason !== goal.blockedReason && goal.blockedReason) {
        this.recordEvent(session.id, {
          type: "system",
          status: "info",
          title: "已更新目标阻塞原因",
          content: goal.blockedReason,
        });
      }
    }
    return this.get(sessionId);
  }

  stopGoal(sessionId: string): WorkSession {
    const session = this.getMutable(sessionId);
    if (!session.goal) throw new Error("GOAL_NOT_FOUND");
    if (session.goal.status === "completed") {
      throw new Error("GOAL_ALREADY_COMPLETED");
    }
    if (session.goal.executionStatus === "stopped") return clone(session);
    session.goal.executionStatus = "stopped";
    session.goal.updatedAt = Date.now();
    this.write(session);
    this.recordEvent(sessionId, {
      type: "system",
      status: "aborted",
      title: "已停止目标执行",
      content: session.goal.title,
    });
    return this.get(sessionId);
  }

  replanGoal(sessionId: string): WorkSession {
    const session = this.getMutable(sessionId);
    if (!session.goal) throw new Error("GOAL_NOT_FOUND");
    const now = Date.now();
    session.goal.status = "active";
    session.goal.executionStatus = "running";
    session.goal.blockedReason = undefined;
    session.goal.result = undefined;
    session.goal.steps = session.goal.steps.map((step) => ({
      ...step,
      status: "pending",
    }));
    session.goal.updatedAt = now;
    this.write(session);
    this.recordEvent(sessionId, {
      type: "system",
      status: "info",
      title: "已重新规划目标",
      content: `${session.goal.title}：重置 ${session.goal.steps.length} 个步骤`,
    });
    return this.get(sessionId);
  }

  updateProject(
    sessionId: string,
    project?: WorkSessionCreateInput["project"]
  ): WorkSession {
    const session = this.getMutable(sessionId);
    session.project = sanitizeProject(project);
    this.write(session);
    this.recordEvent(sessionId, {
      type: "system",
      status: "info",
      title: session.project ? "已关联项目目录" : "已移除项目目录",
      content: session.project?.name,
    });
    return this.get(sessionId);
  }

  updateAgent(
    sessionId: string,
    agentId: string,
    agentName?: string
  ): WorkSession {
    const session = this.getMutable(sessionId);
    const nextAgentId = sanitizeAgentId(agentId);
    if (session.activeAgentId === nextAgentId) return clone(session);
    session.activeAgentId = nextAgentId;
    this.write(session);
    this.recordEvent(sessionId, {
      type: "system",
      status: "info",
      title: "已切换 Agent",
      content: sanitizeTitle(agentName) || nextAgentId,
      agentId: nextAgentId,
    });
    return this.get(sessionId);
  }

  updateComposerContext(
    sessionId: string,
    context: ComposerContext
  ): WorkSession {
    const session = this.getMutable(sessionId);
    session.activeAgentId = sanitizeAgentId(context.agentId);
    session.modelOverride = context.modelOverride
      ? {
          providerId: context.modelOverride.providerId.trim(),
          modelId: context.modelOverride.modelId.trim(),
          thinkingLevel: context.modelOverride.thinkingLevel,
        }
      : undefined;
    session.pluginIds = [...new Set(context.pluginIds.map((id) => id.trim()))]
      .filter(Boolean)
      .slice(0, 20);
    session.attachments = mergeAttachments(
      session.attachments,
      context.attachments
    );
    this.write(session);
    return clone(session);
  }

  recordUserTask(
    sessionId: string,
    content: string,
    context: ComposerContext
  ): WorkEvent {
    return this.recordEvent(sessionId, {
      type: "user_task",
      status: "completed",
      title: "任务指令",
      content,
      agentId: context.agentId,
      attachmentIds: context.attachments.map((attachment) => attachment.id),
      metadata:
        context.pluginIds.length > 0
          ? { pluginCount: context.pluginIds.length }
          : undefined,
    });
  }

  getLatestTaskSummary(sessionId: string): string | undefined {
    const event = [...this.get(sessionId).events]
      .reverse()
      .find((item) => item.type === "user_task" && item.content?.trim());
    const summary = event?.content?.trim().replace(/\s+/g, " ").slice(0, 240);
    return summary || undefined;
  }

  recordFailure(sessionId: string, error: unknown): WorkEvent {
    const message = sanitizeError(
      error instanceof Error ? error.message : "Agent 运行失败"
    );
    const session = this.getMutable(sessionId);
    session.status = "failed";
    this.write(session);
    return this.recordEvent(sessionId, {
      type: "error",
      status: "failed",
      title: "无法启动 Agent 工作",
      content: message,
    });
  }

  recordPermissionRequest(request: PermissionRequest): WorkEvent {
    return this.recordEvent(request.sessionId, {
      type: "permission_request",
      status: "pending",
      title: `需要确认：${request.toolLabel}`,
      content: request.impact,
      metadata: {
        toolName: request.toolName,
        permission: request.permission,
        category: request.category,
        params: request.params,
      },
    });
  }

  recordPermissionDecision(
    request: PermissionRequest,
    decision: PermissionDecision
  ): WorkEvent {
    return this.recordEvent(request.sessionId, {
      type: "permission_decision",
      status: decision.action === "deny" ? "failed" : "completed",
      title: decision.action === "deny" ? "已拒绝工具执行" : "已允许工具执行",
      content: `${request.toolLabel}：${getPermissionActionLabel(decision.action)}`,
      metadata: {
        toolName: request.toolName,
        category: decision.category ?? request.category,
        action: decision.action,
      },
    });
  }

  recordToolActivity(
    sessionId: string,
    input: {
      toolName: string;
      title: string;
      status: Extract<WorkEventStatus, "running" | "completed" | "failed">;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  ): WorkEvent {
    return this.recordEvent(sessionId, {
      type: "tool_call",
      status: input.status,
      title: input.title,
      content: input.content,
      metadata: { toolName: input.toolName, ...input.metadata },
      agentId: this.get(sessionId).activeAgentId,
    });
  }

  recordContextActivity(
    sessionId: string,
    input: {
      title: string;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  ): WorkEvent {
    return this.recordEvent(sessionId, {
      type: "agent_progress",
      status: "info",
      title: input.title,
      content: input.content,
      metadata: { contextBudget: true, ...input.metadata },
      agentId: this.get(sessionId).activeAgentId,
    });
  }

  recordSystemActivity(
    sessionId: string,
    input: {
      title: string;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  ): WorkEvent {
    return this.recordEvent(sessionId, {
      type: "system",
      status: "info",
      title: input.title,
      content: input.content,
      metadata: input.metadata,
      agentId: this.get(sessionId).activeAgentId,
    });
  }

  recordFileChange(
    sessionId: string,
    input: {
      path: string;
      operation: "write" | "edit" | "accept" | "revert";
      metadata?: Record<string, unknown>;
    }
  ): WorkEvent {
    return this.recordEvent(sessionId, {
      type: "file_change",
      status: "completed",
      title: getFileChangeTitle(input.operation),
      content: input.path,
      metadata: {
        operation: input.operation,
        path: input.path,
        ...input.metadata,
      },
      agentId: this.get(sessionId).activeAgentId,
    });
  }

  recordAgentEvent(
    sessionId: string,
    event: Omit<AgentEvent, "sessionId">
  ): void {
    if (!this.store.get("sessions")[sessionId]) return;

    switch (event.type) {
      case "agent_start":
      case "turn_start":
        this.setStatus(sessionId, "running");
        this.recordEvent(sessionId, {
          type: "agent_progress",
          status: "running",
          title: "Agent 正在准备工作",
          agentId: this.get(sessionId).activeAgentId,
        });
        break;
      case "thinking":
        this.recordEvent(sessionId, {
          type: "agent_progress",
          status: "running",
          title: "Agent 正在分析",
          content: getEventText(event.data),
          agentId: this.get(sessionId).activeAgentId,
        });
        break;
      case "token":
        this.appendAssistantToken(sessionId, getEventText(event.data));
        break;
      case "tool_call":
      case "tool_execution_start":
      case "tool_execution_update":
      case "tool_execution_end":
      case "tool_result":
        this.recordToolEvent(sessionId, event);
        break;
      case "completed":
      case "agent_end":
      case "agent_settled":
        this.completeAssistantMessage(sessionId);
        this.setStatus(sessionId, "completed");
        this.recordEvent(sessionId, {
          type: "summary",
          status: "completed",
          title: "Agent 已完成本次工作",
          agentId: this.get(sessionId).activeAgentId,
        });
        break;
      case "aborted":
        this.completeAssistantMessage(sessionId, "aborted");
        this.setStatus(sessionId, "aborted");
        this.recordEvent(sessionId, {
          type: "system",
          status: "aborted",
          title: "已停止 Agent 工作",
        });
        break;
      case "error":
        this.completeAssistantMessage(sessionId, "failed");
        this.setStatus(sessionId, "failed");
        this.recordEvent(sessionId, {
          type: "error",
          status: "failed",
          title: "Agent 工作失败",
          content: sanitizeError(
            event.error || getEventText(event.data) || "Agent 运行失败"
          ),
        });
        break;
      case "model_changed":
        this.recordEvent(sessionId, {
          type: "system",
          status: "info",
          title: "已更新本次工作模型",
          metadata: sanitizeMetadata(event.data),
        });
        break;
      default:
        break;
    }
  }

  subscribe(listener: WorkEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private appendAssistantToken(sessionId: string, token: string): void {
    if (!token) return;
    const session = this.getMutable(sessionId);
    const current = [...session.events]
      .reverse()
      .find(
        (event) => event.type === "agent_message" && event.status === "running"
      );
    if (current) {
      current.content = sanitizeContent(`${current.content ?? ""}${token}`);
      current.timestamp = Date.now();
      this.write(session);
      this.publish(current);
      return;
    }
    this.recordEvent(sessionId, {
      type: "agent_message",
      status: "running",
      title: "Agent 输出",
      content: token,
      agentId: session.activeAgentId,
    });
  }

  private completeAssistantMessage(
    sessionId: string,
    status: Extract<
      WorkEventStatus,
      "completed" | "aborted" | "failed"
    > = "completed"
  ): void {
    const session = this.getMutable(sessionId);
    const current = [...session.events]
      .reverse()
      .find(
        (event) => event.type === "agent_message" && event.status === "running"
      );
    if (!current) return;
    current.status = status;
    current.timestamp = Date.now();
    this.write(session);
    this.publish(current);
  }

  private recordToolEvent(
    sessionId: string,
    event: Omit<AgentEvent, "sessionId">
  ): void {
    const status: WorkEventStatus =
      event.type === "tool_execution_end" || event.type === "tool_result"
        ? "completed"
        : "running";
    this.recordEvent(sessionId, {
      type: "tool_call",
      status,
      title: "工具调用",
      content: getEventText(event.data),
      metadata: sanitizeMetadata(event.data),
      agentId: this.get(sessionId).activeAgentId,
    });
  }

  private getMutableBranchParent(branch: WorkSession): WorkSession {
    if (!branch.branch) throw new Error("WORK_SESSION_NOT_A_BRANCH");
    const parent = this.getMutable(branch.branch.parentSessionId);
    if (parent.status === "archived") throw new Error("WORK_SESSION_ARCHIVED");
    return parent;
  }

  private assertPendingBranch(branch: WorkSession): void {
    if (!branch.branch) throw new Error("WORK_SESSION_NOT_A_BRANCH");
    if (branch.status === "archived") throw new Error("WORK_SESSION_ARCHIVED");
    if (branch.branch.mergeStatus !== "pending") {
      throw new Error("WORK_SESSION_BRANCH_CLOSED");
    }
  }

  private recordEvent(
    sessionId: string,
    input: Omit<WorkEvent, "id" | "sessionId" | "timestamp">
  ): WorkEvent {
    const session = this.getMutable(sessionId);
    const metadata = sanitizeMetadata({
      ...input.metadata,
      ...(session.goal ? { goalId: session.goal.id } : {}),
    });
    const event: WorkEvent = {
      id: `event_${randomUUID()}`,
      sessionId,
      timestamp: Date.now(),
      ...input,
      title: sanitizeTitle(input.title) || "工作事件",
      content: sanitizeContent(input.content) || undefined,
      attachmentIds: input.attachmentIds?.slice(0, 32),
      metadata,
    };
    session.events.push(event);
    this.write(session);
    this.publish(event);
    return clone(event);
  }

  private setStatus(sessionId: string, status: WorkSessionStatus): void {
    const session = this.getMutable(sessionId);
    session.status = status;
    if (session.goal) {
      if (
        status === "running" &&
        session.goal.status !== "completed" &&
        session.goal.executionStatus !== "stopped"
      ) {
        session.goal.executionStatus = "running";
      } else if (
        ["completed", "failed", "aborted"].includes(status) &&
        session.goal.executionStatus === "running"
      ) {
        session.goal.executionStatus = "idle";
      }
      session.goal.updatedAt = Date.now();
    }
    this.write(session);
  }

  private touch(session: WorkSession): WorkSession {
    session = normalizeSession(session);
    session.lastOpenedAt = Date.now();
    this.write(session, true);
    return clone(session);
  }

  private write(session: WorkSession, makeActive = false): void {
    const sessions = this.store.get("sessions");
    const updatedAt = Date.now();
    const next = { ...session, updatedAt };
    this.store.set("sessions", { ...sessions, [next.id]: next });
    if (makeActive) this.store.set("activeSessionId", next.id);
  }

  private getMutable(sessionId: string): WorkSession {
    const session = this.store.get("sessions")[sessionId];
    if (!session) throw new Error("WORK_SESSION_NOT_FOUND");
    return normalizeSession(clone(session));
  }

  private toSummary(session: WorkSession): WorkSessionSummary {
    return {
      id: session.id,
      title: session.title,
      activeAgentId: session.activeAgentId,
      status: session.status,
      goal: session.goal
        ? {
            id: session.goal.id,
            title: session.goal.title,
            status: session.goal.status,
          }
        : undefined,
      parentSessionId: session.branch?.parentSessionId,
      branchMergeStatus: session.branch?.mergeStatus,
      updatedAt: session.updatedAt,
      lastOpenedAt: session.lastOpenedAt,
      eventCount: session.events.length,
    };
  }

  private publish(event: WorkEvent): void {
    const safeEvent = clone(event);
    for (const listener of this.listeners) listener(safeEvent);
  }
}

function mergeAttachments(
  existing: WorkAttachment[],
  attachments: ComposerContext["attachments"]
): WorkAttachment[] {
  const byId = new Map(
    existing.map((attachment) => [attachment.id, attachment])
  );
  for (const attachment of attachments) {
    byId.set(attachment.id, {
      id: attachment.id,
      name: sanitizeTitle(attachment.name) || "附件",
      mimeType: attachment.mimeType.slice(0, 160),
      size: Math.max(0, Math.min(attachment.size, 20 * 1024 * 1024)),
      kind: attachment.kind,
      createdAt: attachment.createdAt,
    });
  }
  return [...byId.values()].slice(-100);
}

function sanitizeProject(project: WorkSessionCreateInput["project"]) {
  if (!project) return undefined;
  const name = sanitizeTitle(project.name);
  const id = project.id?.trim().slice(0, 160);
  const rootPath = project.rootPath?.trim().slice(0, 1_024);
  return name || id || rootPath ? { id, name, rootPath } : undefined;
}

function sanitizeBranchType(
  type?: WorkSessionBranchInput["type"]
): WorkSessionBranchType {
  if (["manual", "agent_invocation", "task_delegation"].includes(type ?? "")) {
    return type as WorkSessionBranchType;
  }
  return "manual";
}

function sanitizeBranchSummary(value?: string): string {
  return sanitizeContent(value, 4_000)
    .replace(
      /(api[_-]?key|authorization|credential|password|secret|token)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[已隐藏]"
    )
    .trim();
}

function cloneGoalForBranch(
  goal: Goal | undefined,
  now: number
): Goal | undefined {
  if (!goal) return undefined;
  return {
    ...clone(goal),
    id: `goal_${randomUUID()}`,
    steps: goal.steps.map((step) => ({
      ...step,
      id: `goal_step_${randomUUID()}`,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

function buildBranchContextSummary(session: WorkSession): string {
  const lines = [`父任务：${session.title}`];
  if (session.goal) {
    lines.push(`目标：${session.goal.title}`);
    if (session.goal.description) lines.push(session.goal.description);
  }
  if (session.project) {
    const project = [session.project.name, session.project.rootPath]
      .filter(Boolean)
      .join(" · ");
    if (project) lines.push(`项目：${project}`);
  }
  lines.push(`Agent：${session.activeAgentId}`);
  const activityTitles = session.events
    .slice(-6)
    .map((event) => event.title)
    .filter(Boolean);
  if (activityTitles.length > 0) {
    lines.push(`最近活动：${activityTitles.join("；")}`);
  }
  return lines.join("\n");
}

function buildBranchMergeSummary(branch: WorkSession): string {
  const outcome = [...branch.events]
    .reverse()
    .find(
      (event) =>
        (event.type === "summary" || event.type === "agent_message") &&
        event.content?.trim()
    );
  const lines = [`分支「${branch.title}」的结果已合并。`];
  if (outcome?.content) {
    lines.push(sanitizeContent(outcome.content, 8_000));
  } else {
    lines.push("该分支尚未生成可合并的 Agent 输出，请查看分支工作流。 ");
  }
  return lines.join("\n\n").trim();
}

function sanitizeAgentId(agentId?: string): string {
  return agentId?.trim().slice(0, 160) || "default";
}

function sanitizeGoalStatus(status?: GoalStatus): GoalStatus {
  return ["draft", "active", "blocked", "completed"].includes(status ?? "")
    ? (status as GoalStatus)
    : "active";
}

function sanitizeGoalExecutionStatus(
  status?: GoalExecutionStatus
): GoalExecutionStatus {
  return ["idle", "running", "stopped"].includes(status ?? "")
    ? (status as GoalExecutionStatus)
    : "idle";
}

function sanitizeGoalStepStatus(
  status?: Goal["steps"][number]["status"]
): Goal["steps"][number]["status"] {
  return ["pending", "in_progress", "completed", "blocked"].includes(
    status ?? ""
  )
    ? (status as Goal["steps"][number]["status"])
    : "pending";
}

function sanitizeTitle(value?: string): string {
  return value?.trim().replace(/\s+/g, " ").slice(0, 160) ?? "";
}

function sanitizeContent(
  value?: string,
  limit = MAX_EVENT_CONTENT_LENGTH
): string {
  return value?.slice(0, limit) ?? "";
}

function sanitizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (typeof item === "string") {
      sanitized[key] = item.slice(0, MAX_METADATA_STRING_LENGTH);
    } else if (
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null
    ) {
      sanitized[key] = item;
    } else if (typeof item === "object" && !Array.isArray(item)) {
      const nested = sanitizeMetadata(item);
      if (nested) sanitized[key] = nested;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function getEventText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const candidate = value as {
    text?: unknown;
    message?: unknown;
    label?: unknown;
  };
  return typeof candidate.text === "string"
    ? candidate.text
    : typeof candidate.message === "string"
      ? candidate.message
      : typeof candidate.label === "string"
        ? candidate.label
        : "";
}

function sanitizeError(value: string): string {
  return value
    .slice(0, MAX_EVENT_CONTENT_LENGTH)
    .replace(
      /(api[_-]?key|authorization|credential|password|secret|token)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[已隐藏]"
    );
}

function getPermissionActionLabel(
  action: PermissionDecision["action"]
): string {
  return {
    allow: "本次允许",
    deny: "本次拒绝",
    allow_always: "本次会话内允许",
  }[action];
}

function getFileChangeTitle(
  operation: "write" | "edit" | "accept" | "revert"
): string {
  return {
    write: "已写入文件",
    edit: "已编辑文件",
    accept: "已接受文件变更",
    revert: "已回滚文件变更",
  }[operation];
}

function getGoalStatusLabel(status: GoalStatus): string {
  return {
    draft: "草稿",
    active: "进行中",
    blocked: "阻塞",
    completed: "完成",
  }[status];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSession(session: WorkSession): WorkSession {
  if (session.goal && !session.goal.executionStatus) {
    session.goal.executionStatus = "idle";
  }
  return session;
}

let manager: WorkSessionManager | undefined;

export function getWorkSessionManager(): WorkSessionManager {
  manager ??= new WorkSessionManager();
  return manager;
}
