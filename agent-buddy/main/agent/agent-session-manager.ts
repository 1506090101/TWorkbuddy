import { randomUUID } from "crypto";
import type { BrowserWindow } from "electron";
import type {
  AgentEvent,
  ContentBlock,
  AgentPromptRequest,
  AgentSessionInit,
  AgentStatus,
  ContextUsage,
  GitStatus,
  ModelAssignment,
  ProjectContext,
} from "@shared/types";
import { getProviderManager } from "../providers/provider-manager";
import { getWorkSessionManager } from "../work-session/work-session-manager";
import {
  getBuiltinToolManager,
  type AgentToolCall,
} from "../tool/builtin-tool-manager";
import { getPermissionManager } from "../tool/permission-manager";
import { getProjectDetector } from "../project/project-detector";
import { getGitManager } from "../git/git-manager";
import { getAgentDefinitionManager } from "./agent-definition-manager";
import { getModelConfigStore } from "./model-config-store";
import { routeModel } from "./model-router";
import type { AgentHistoryMessage, AgentRuntimeSession } from "./types";
import {
  getContextBudgetManager,
  estimateTokens,
  type ContextSegment,
} from "../context/context-budget-manager";
import { getUsageTracker } from "../usage/usage-tracker";

const DEFAULT_MODEL_BY_PROVIDER = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  deepseek: "deepseek-chat",
  gemini: "gemini-1.5-flash",
  mistral: "mistral-small-latest",
  openrouter: "openai/gpt-4o-mini",
  custom: "gpt-4o-mini",
} as const;

const TOOL_DIRECTIVE_OPEN = "<agent-tool>";
const TOOL_DIRECTIVE_CLOSE = "</agent-tool>";
const MAX_TOOL_TURNS = 8;

interface ProviderTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function formatUsd(amount: number): string {
  if (amount < 0.01) return amount.toFixed(4);
  if (amount < 1) return amount.toFixed(3);
  return amount.toFixed(2);
}

export class AgentSessionManager {
  private readonly sessions = new Map<
    string,
    { session: AgentRuntimeSession; window: BrowserWindow }
  >();

  async createSession(
    config: AgentSessionInit = {},
    window: BrowserWindow,
    workSessionId?: string
  ): Promise<{ sessionId: string }> {
    const providerManager = getProviderManager();
    const providers = providerManager.list();
    if (providers.length === 0) throw new Error("NO_PROVIDER_CONFIGURED");

    const agentId = config.agentId ?? "default";
    const agent = getAgentDefinitionManager().get(agentId);
    const assignment = getModelConfigStore().getAssignment(agentId);
    const provider =
      providers.find(
        (item) => item.id === (config.providerId || assignment.chat.providerId)
      ) ?? providers[0];
    const modelId =
      config.modelId ||
      (provider.id === assignment.chat.providerId
        ? assignment.chat.modelId
        : "") ||
      provider.models[0]?.id ||
      DEFAULT_MODEL_BY_PROVIDER[provider.type];

    // Keep model credential injection in the main process for SDK parity.
    const model = providerManager.getModel(provider.id, modelId);
    this.applyEnvironment(model.envVars);

    const sessionId = workSessionId ?? `session_${randomUUID()}`;
    const session: AgentRuntimeSession = {
      id: sessionId,
      agentId,
      providerId: provider.id,
      providerType: provider.type,
      modelId,
      thinkingLevel: config.thinkingLevel ?? assignment.thinkingLevel,
      systemPrompt: config.systemPrompt ?? agent.systemPrompt,
      history: [],
      abortController: null,
      isGenerating: false,
    };

    this.sessions.set(sessionId, { session, window });
    this.emit(sessionId, {
      type: "session_ready",
      data: { providerId: provider.id, modelId },
    });
    return { sessionId };
  }

  async getOrCreateSession(
    workSessionId: string,
    agentId: string,
    window: BrowserWindow,
    config?: AgentSessionInit
  ): Promise<string> {
    const existing = this.sessions.get(workSessionId);
    if (existing) {
      if (existing.session.agentId !== agentId) {
        const agent = getAgentDefinitionManager().get(agentId);
        existing.session.agentId = agent.id;
        existing.session.systemPrompt =
          config?.systemPrompt ?? agent.systemPrompt;
      }
      if (
        config?.providerId &&
        config.modelId &&
        (existing.session.providerId !== config.providerId ||
          existing.session.modelId !== config.modelId)
      ) {
        this.setModel(workSessionId, config.providerId, config.modelId);
      }
      if (config?.thinkingLevel) {
        existing.session.thinkingLevel = config.thinkingLevel;
      }
      return existing.session.id;
    }
    return (
      await this.createSession({ ...config, agentId }, window, workSessionId)
    ).sessionId;
  }

  startPrompt(sessionId: string, request: AgentPromptRequest): void {
    const entry = this.getEntry(sessionId);
    if (entry.session.isGenerating) throw new Error("AGENT_BUSY");

    entry.session.isGenerating = true;
    entry.session.abortController = new AbortController();
    const userMessage: AgentHistoryMessage = {
      role: "user",
      content: request.message.content,
    };
    entry.session.history.push(userMessage);
    this.emit(sessionId, {
      type: "agent_start",
      data: { agentId: entry.session.agentId },
    });
    this.emit(sessionId, {
      type: "thinking",
      data: { label: "正在准备项目上下文" },
    });
    void this.runPrompt(entry.session, entry.window, request.message.content);
  }

  abort(sessionId?: string): void {
    const entry = sessionId
      ? this.sessions.get(sessionId)
      : [...this.sessions.values()].find(({ session }) => session.isGenerating);
    if (!entry?.session.abortController) return;
    getPermissionManager().cancelPending(entry.session.id);
    entry.session.abortController.abort();
  }

  steer(sessionId: string | undefined, instruction: string): void {
    const entry = sessionId
      ? this.sessions.get(sessionId)
      : [...this.sessions.values()].find(({ session }) => session.isGenerating);
    if (!entry) throw new Error("SESSION_NOT_FOUND");
    entry.session.steerInstruction = instruction.trim() || undefined;
  }

  setModel(sessionId: string, providerId: string, modelId: string): void {
    const entry = this.getEntry(sessionId);
    const providerManager = getProviderManager();
    const provider = providerManager
      .list()
      .find((item) => item.id === providerId);
    if (!provider) throw new Error(`Provider “${providerId}” 不存在`);

    const model = providerManager.getModel(providerId, modelId);
    this.applyEnvironment(model.envVars);
    entry.session.providerId = providerId;
    entry.session.providerType = provider.type;
    entry.session.modelId = modelId;
    this.emit(sessionId, {
      type: "model_changed",
      data: { providerId, modelId },
    });
  }

  applyAssignment(agentId: string, assignment: ModelAssignment): void {
    const entry = [...this.sessions.values()].find(
      ({ session }) => session.agentId === agentId
    );
    if (!entry || !assignment.chat.providerId || !assignment.chat.modelId)
      return;
    this.setModel(
      entry.session.id,
      assignment.chat.providerId,
      assignment.chat.modelId
    );
    entry.session.thinkingLevel = assignment.thinkingLevel;
  }

  getStatus(): AgentStatus {
    const providerManager = getProviderManager();
    const providers = providerManager.list();
    const active = [...this.sessions.values()].find(
      ({ session }) => session.isGenerating
    )?.session;
    const current = active ?? [...this.sessions.values()][0]?.session;
    return {
      hasProvider: providers.length > 0,
      sessionId: current?.id,
      providerId: current?.providerId,
      modelId: current?.modelId,
      isGenerating: current?.isGenerating ?? false,
    };
  }

  async compactContext(sessionId: string): Promise<ContextUsage> {
    const entry = this.getEntry(sessionId);
    const workSessions = getWorkSessionManager();
    const workSession = workSessions.get(sessionId);
    const agent = getAgentDefinitionManager().get(entry.session.agentId);
    const projectContext = await this.getProjectContext(
      workSession.project?.rootPath
    );
    const gitStatus = await this.getGitStatus(workSession.project?.rootPath);
    const contextManager = getContextBudgetManager();
    const result = contextManager.compactHistory(entry.session.history);
    const usage = contextManager.buildContext({
      sessionId,
      segments: this.buildSystemContextSegments(
        entry.session.systemPrompt ?? agent.systemPrompt,
        workSession.project?.rootPath && agent.tools.length > 0
          ? agent.tools
          : [],
        projectContext,
        gitStatus,
        workSession.branch?.contextSummary
      ),
      history: entry.session.history,
    }).usage;
    if (result.changed) {
      workSessions.recordContextActivity(sessionId, {
        title: "已压缩任务上下文",
        content: `保留 ${result.after} 条最近上下文（原 ${result.before} 条）`,
        metadata: { before: result.before, after: result.after, manual: true },
      });
    }
    return usage;
  }

  destroyAll(): void {
    for (const { session } of this.sessions.values()) {
      session.abortController?.abort();
    }
    this.sessions.clear();
  }

  private async runPrompt(
    session: AgentRuntimeSession,
    window: BrowserWindow,
    messageBlocks: ContentBlock[]
  ): Promise<void> {
    const controller = session.abortController;
    if (!controller) return;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 120_000);

    try {
      const providerManager = getProviderManager();
      const defaultAssignment = getModelConfigStore().getAssignment(
        session.agentId
      );
      const workSession = getWorkSessionManager().get(session.id);
      const projectContext = await this.getProjectContext(
        workSession.project?.rootPath
      );
      const gitStatus = await this.getGitStatus(workSession.project?.rootPath);
      const assignment = workSession.modelOverride
        ? {
            ...defaultAssignment,
            chat: {
              providerId: workSession.modelOverride.providerId,
              modelId: workSession.modelOverride.modelId,
            },
            thinkingLevel:
              workSession.modelOverride.thinkingLevel ??
              defaultAssignment.thinkingLevel,
          }
        : defaultAssignment;
      const decision = routeModel(messageBlocks, assignment, false);
      if (
        decision.modelAssignment.providerId !== session.providerId ||
        decision.modelAssignment.modelId !== session.modelId
      ) {
        this.setModel(
          session.id,
          decision.modelAssignment.providerId,
          decision.modelAssignment.modelId
        );
      }
      session.thinkingLevel = assignment.thinkingLevel;
      if (session.steerInstruction) {
        session.history.push({
          role: "user",
          content: [
            {
              type: "text",
              text: `[Agent steering] ${session.steerInstruction}`,
            },
          ],
        });
        session.steerInstruction = undefined;
      }
      const agent = getAgentDefinitionManager().get(session.agentId);
      const allowedTools = agent.tools;
      const toolsEnabled = Boolean(
        workSession.project?.rootPath && allowedTools.length > 0
      );
      const contextSegments = this.buildSystemContextSegments(
        session.systemPrompt ?? agent.systemPrompt,
        toolsEnabled ? allowedTools : [],
        projectContext,
        gitStatus,
        workSession.branch?.contextSummary
      );
      let remainingToolTurns = MAX_TOOL_TURNS;

      while (true) {
        const contextManager = getContextBudgetManager();
        let context = contextManager.buildContext({
          sessionId: session.id,
          segments: contextSegments,
          history: session.history,
        });
        if (context.usage.needsCompact) {
          const result = contextManager.compactHistory(session.history);
          if (result.changed) {
            getWorkSessionManager().recordContextActivity(session.id, {
              title: "已自动压缩任务上下文",
              content: `保留 ${result.after} 条最近上下文（原 ${result.before} 条）`,
              metadata: {
                before: result.before,
                after: result.after,
                manual: false,
              },
            });
            context = contextManager.buildContext({
              sessionId: session.id,
              segments: contextSegments,
              history: session.history,
            });
          }
        }
        const request = providerManager.getChatRequest(
          session.providerId,
          session.modelId,
          context.history,
          context.systemPrompt,
          controller.signal
        );
        const requestStarted = Date.now();
        const response = await this.fetchWithProviderRetry(
          request.url,
          request.init,
          assignment.retryOnProviderError
        );
        if (!response.ok) {
          const detail = await this.readError(response);
          throw new Error(`模型请求失败：${response.status} ${detail}`);
        }

        let assistantContent = "";
        const stream = new ToolDirectiveStream((token) => {
          this.emit(session.id, { type: "token", data: token });
        });
        const providerUsage = await this.consumeResponse(
          response,
          controller.signal,
          (token) => {
            assistantContent += token;
            stream.push(token);
          }
        );
        const tracked = getUsageTracker().record({
          providerId: session.providerId,
          providerType: session.providerType,
          modelId: session.modelId,
          inputTokens: providerUsage?.inputTokens ?? context.usage.totalUsed,
          outputTokens:
            providerUsage?.outputTokens ?? estimateTokens(assistantContent),
          durationMs: Date.now() - requestStarted,
          sessionId: session.id,
          agentId: session.agentId,
          projectId: workSession.project?.id,
          inputEstimated: providerUsage?.inputTokens === undefined,
          outputEstimated: providerUsage?.outputTokens === undefined,
        });
        if (tracked.budgetAlert) {
          getWorkSessionManager().recordSystemActivity(session.id, {
            title: "已达到月度成本预警",
            content: `本月已使用 $${formatUsd(tracked.budgetAlert.spendUsd)} / $${formatUsd(tracked.budgetAlert.budget.monthlyLimitUsd)}`,
            metadata: {
              usageBudget: true,
              spendUsd: tracked.budgetAlert.spendUsd,
              monthlyLimitUsd: tracked.budgetAlert.budget.monthlyLimitUsd,
            },
          });
        }
        const toolCall = toolsEnabled
          ? parseToolCall(assistantContent)
          : undefined;
        if (toolCall) {
          if (!allowedTools.includes(toolCall.name)) {
            throw new Error(`当前 Agent 不允许使用工具：${toolCall.name}`);
          }
          if (remainingToolTurns-- <= 0) {
            throw new Error("Agent 工具调用次数超过本轮限制");
          }
          session.history.push({
            role: "assistant",
            content: [{ type: "text", text: assistantContent }],
          });
          const result = await getBuiltinToolManager().execute(
            window,
            session.id,
            toolCall,
            controller.signal
          );
          session.history.push({
            role: "user",
            content: [
              {
                type: "text",
                text: formatToolResult(result),
              },
            ],
          });
          this.emit(session.id, {
            type: "thinking",
            data: { label: `正在分析${toolCall.name}的结果` },
          });
          continue;
        }

        stream.flush();
        if (assistantContent) {
          session.history.push({
            role: "assistant",
            content: [{ type: "text", text: assistantContent }],
          });
        }
        this.emit(session.id, {
          type: "completed",
          data: { finishReason: "stop" },
        });
        return;
      }
    } catch (error) {
      if (controller.signal.aborted && !timedOut) {
        this.emit(session.id, { type: "aborted" });
      } else {
        this.emit(session.id, {
          type: "error",
          error: timedOut
            ? "模型响应超时（120 秒）"
            : this.getErrorMessage(error),
        });
      }
    } finally {
      clearTimeout(timeout);
      session.isGenerating = false;
      session.abortController = null;
      if (window.isDestroyed()) return;
    }
  }

  private async consumeResponse(
    response: Response,
    signal: AbortSignal,
    onToken: (token: string) => void
  ): Promise<ProviderTokenUsage | undefined> {
    let usage: ProviderTokenUsage | undefined;
    if (!response.body) {
      const data = (await response.json()) as Record<string, unknown>;
      const token = this.extractToken(data);
      if (token) onToken(token);
      return this.extractUsage(data);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const payload = line.replace(/^data:\s*/, "").trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const data = JSON.parse(payload) as Record<string, unknown>;
          const token = this.extractToken(data);
          if (token) onToken(token);
          usage = this.extractUsage(data) ?? usage;
        } catch {
          // Ignore keep-alive lines and provider-specific non-JSON events.
        }
      }
      if (done) break;
    }
    return usage;
  }

  private async fetchWithProviderRetry(
    url: string,
    init: RequestInit,
    retryOnProviderError: boolean
  ): Promise<Response> {
    try {
      const response = await fetch(url, init);
      if (!retryOnProviderError || !this.isRetryableStatus(response.status)) {
        return response;
      }
      return fetch(url, init);
    } catch (error) {
      if (!retryOnProviderError || this.isAbortError(error)) throw error;
      return fetch(url, init);
    }
  }

  private isRetryableStatus(status: number): boolean {
    return (
      status === 408 ||
      status === 409 ||
      status === 425 ||
      status === 429 ||
      status >= 500
    );
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
  }

  private extractToken(data: Record<string, unknown>): string {
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const delta = firstChoice?.delta as Record<string, unknown> | undefined;
    if (typeof delta?.content === "string") return delta.content;
    const content = firstChoice?.message as Record<string, unknown> | undefined;
    if (typeof content?.content === "string") return content.content;

    const anthropicDelta = data.delta as Record<string, unknown> | undefined;
    if (typeof anthropicDelta?.text === "string") return anthropicDelta.text;
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const parts = (
      (candidates[0] as Record<string, unknown> | undefined)?.content as
        Record<string, unknown> | undefined
    )?.parts;
    const firstPart = Array.isArray(parts) ? parts[0] : undefined;
    return firstPart && typeof firstPart === "object" && "text" in firstPart
      ? typeof (firstPart as { text?: unknown }).text === "string"
        ? (firstPart as { text: string }).text
        : ""
      : "";
  }

  private extractUsage(
    data: Record<string, unknown>
  ): ProviderTokenUsage | undefined {
    const usage = data.usage as Record<string, unknown> | undefined;
    if (usage) {
      const inputTokens = readNumber(usage.prompt_tokens ?? usage.input_tokens);
      const outputTokens = readNumber(
        usage.completion_tokens ?? usage.output_tokens
      );
      if (inputTokens !== undefined || outputTokens !== undefined) {
        return { inputTokens, outputTokens };
      }
    }
    const metadata = data.usageMetadata as Record<string, unknown> | undefined;
    if (metadata) {
      const inputTokens = readNumber(metadata.promptTokenCount);
      const outputTokens = readNumber(metadata.candidatesTokenCount);
      if (inputTokens !== undefined || outputTokens !== undefined) {
        return { inputTokens, outputTokens };
      }
    }
    return undefined;
  }

  private async readError(response: Response): Promise<string> {
    try {
      const body = (await response.text()).slice(0, 240);
      return body || response.statusText;
    } catch {
      return response.statusText;
    }
  }

  private emit(sessionId: string, event: Omit<AgentEvent, "sessionId">): void {
    getWorkSessionManager().recordAgentEvent(sessionId, event);
    const entry = this.sessions.get(sessionId);
    if (!entry || entry.window.isDestroyed()) return;
    entry.window.webContents.send("agent:event", {
      sessionId,
      ...toRendererAgentEvent(event),
    });
  }

  private getEntry(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (!entry) throw new Error(`Session “${sessionId}” 不存在`);
    return entry;
  }

  private applyEnvironment(envVars: Record<string, string>): void {
    for (const [key, value] of Object.entries(envVars)) {
      process.env[key] = value;
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Agent 运行失败";
  }

  private buildSystemContextSegments(
    systemPrompt: string | undefined,
    allowedTools: AgentToolCall["name"][],
    projectContext?: ProjectContext,
    gitStatus?: GitStatus | null,
    branchContextSummary?: string
  ): ContextSegment[] {
    return [
      {
        source: "systemPrompt",
        content: [
          this.buildSystemPrompt(systemPrompt, [], undefined, undefined),
          branchContextSummary
            ? `<branch-context>\n${branchContextSummary}\n</branch-context>`
            : undefined,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      {
        source: "projectOverview",
        content: projectContext
          ? this.buildSystemPrompt(undefined, [], projectContext, undefined)
          : undefined,
      },
      {
        source: "gitStatus",
        content: gitStatus
          ? this.buildSystemPrompt(undefined, [], undefined, gitStatus)
          : undefined,
      },
      {
        source: "toolDefinitions",
        content:
          allowedTools.length > 0
            ? this.buildSystemPrompt(
                undefined,
                allowedTools,
                undefined,
                undefined
              )
            : undefined,
      },
    ];
  }

  private buildSystemPrompt(
    systemPrompt: string | undefined,
    allowedTools: AgentToolCall["name"][],
    projectContext?: ProjectContext,
    gitStatus?: GitStatus | null
  ): string | undefined {
    const projectSummary = projectContext
      ? formatProjectContext(projectContext)
      : undefined;
    const gitSummary = gitStatus ? formatGitContext(gitStatus) : undefined;
    if (allowedTools.length === 0) {
      return (
        [systemPrompt, projectSummary, gitSummary]
          .filter(Boolean)
          .join("\n\n") || undefined
      );
    }
    const toolList = getBuiltinToolManager()
      .list()
      .filter((tool) => allowedTools.includes(tool.name))
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join("\n");
    const protocol = `\n\n你正在一个已选择项目的 Agent 工作台中工作。需要读取、搜索、修改文件或运行命令时，必须将**整个回复**写成单个工具指令，不要添加解释或 Markdown：\n${TOOL_DIRECTIVE_OPEN}{"name":"read","args":{"path":"src/main.ts"}}${TOOL_DIRECTIVE_CLOSE}\n可用工具：\n${toolList}\n参数约定：read/write/edit 使用 path；grep/find 使用 query 和可选 path；bash 必须使用可执行文件和参数数组，例如 {"command":"npm","args":["run","build"],"cwd":"."}，不得传入 shell 拼接命令。工具只可访问当前项目目录。read、ls、grep、find 只读；write、edit、bash 会要求用户确认。拿到工具结果后，继续分析并以普通文本给出最终回复。`;
    return [systemPrompt, projectSummary, gitSummary, protocol]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  private async getProjectContext(
    rootPath?: string
  ): Promise<ProjectContext | undefined> {
    if (!rootPath) return undefined;
    try {
      return await getProjectDetector().detect(rootPath);
    } catch {
      return undefined;
    }
  }

  private async getGitStatus(rootPath?: string): Promise<GitStatus | null> {
    if (!rootPath) return null;
    try {
      return await getGitManager().getStatus(rootPath);
    } catch {
      return null;
    }
  }
}

class ToolDirectiveStream {
  private buffered = "";
  private forwarded = false;

  constructor(private readonly onToken: (token: string) => void) {}

  push(token: string): void {
    if (this.forwarded) {
      this.onToken(token);
      return;
    }
    this.buffered += token;
    if (
      (this.buffered.length <= TOOL_DIRECTIVE_OPEN.length &&
        TOOL_DIRECTIVE_OPEN.startsWith(this.buffered)) ||
      this.buffered.startsWith(TOOL_DIRECTIVE_OPEN)
    ) {
      return;
    }
    this.forwarded = true;
    this.onToken(this.buffered);
    this.buffered = "";
  }

  flush(): void {
    if (this.forwarded || !this.buffered) return;
    this.onToken(this.buffered);
    this.buffered = "";
    this.forwarded = true;
  }
}

function parseToolCall(content: string): AgentToolCall | undefined {
  const trimmed = content.trim();
  if (
    !trimmed.startsWith(TOOL_DIRECTIVE_OPEN) ||
    !trimmed.endsWith(TOOL_DIRECTIVE_CLOSE)
  ) {
    return undefined;
  }
  const body = trimmed.slice(
    TOOL_DIRECTIVE_OPEN.length,
    -TOOL_DIRECTIVE_CLOSE.length
  );
  try {
    const parsed = JSON.parse(body) as { name?: unknown; args?: unknown };
    if (
      !isBuiltinToolName(parsed.name) ||
      !parsed.args ||
      typeof parsed.args !== "object" ||
      Array.isArray(parsed.args)
    ) {
      return undefined;
    }
    return { name: parsed.name, args: parsed.args as Record<string, unknown> };
  } catch {
    return undefined;
  }
}

function isBuiltinToolName(value: unknown): value is AgentToolCall["name"] {
  return ["read", "write", "edit", "bash", "grep", "find", "ls"].includes(
    value as string
  );
}

function formatToolResult(result: {
  toolName: string;
  output: string;
  denied?: boolean;
  exitCode?: number;
}): string {
  const status = result.denied
    ? "用户拒绝"
    : result.exitCode && result.exitCode !== 0
      ? `退出码 ${result.exitCode}`
      : "完成";
  return `[工具 ${result.toolName} ${status}]\n${result.output.slice(0, 16_000)}`;
}

function formatProjectContext(context: ProjectContext): string {
  const scripts = Object.entries(context.scripts ?? {})
    .map(([name, command]) => `${name}: ${command}`)
    .join("; ");
  const lines = [
    "<project-context>",
    `目录: ${context.rootPath}`,
    `类型: ${context.type}; 语言: ${context.language}`,
    context.framework ? `框架: ${context.framework}` : undefined,
    context.packageManager ? `包管理器: ${context.packageManager}` : undefined,
    context.buildSystem ? `构建系统: ${context.buildSystem}` : undefined,
    context.testCommand ? `测试建议: ${context.testCommand}` : undefined,
    context.lintCommand ? `检查建议: ${context.lintCommand}` : undefined,
    scripts ? `可用脚本: ${scripts}` : undefined,
    context.structure.sourceDirs.length
      ? `源码目录: ${context.structure.sourceDirs.join(", ")}`
      : undefined,
    context.structure.testDirs.length
      ? `测试目录: ${context.structure.testDirs.join(", ")}`
      : undefined,
    context.structure.entryPoints.length
      ? `常见入口: ${context.structure.entryPoints.join(", ")}`
      : undefined,
    "</project-context>",
  ];
  return lines.filter(Boolean).join("\n").slice(0, 4_000);
}

function formatGitContext(status: GitStatus): string {
  return [
    "<git-context>",
    `分支: ${status.branch}`,
    `工作区变更: ${status.totalChanges}（暂存 ${status.staged.length}，未暂存 ${status.unstaged.length}，未跟踪 ${status.untracked.length}）`,
    status.ahead || status.behind
      ? `与上游: ahead ${status.ahead}, behind ${status.behind}`
      : undefined,
    "</git-context>",
  ]
    .filter(Boolean)
    .join("\n");
}

function toRendererAgentEvent(
  event: Omit<AgentEvent, "sessionId">
): Omit<AgentEvent, "sessionId"> {
  if (event.type === "token" && typeof event.data === "string") {
    return { type: event.type, data: event.data.slice(0, 48_000) };
  }
  if (event.type === "session_ready" || event.type === "model_changed") {
    const value = event.data as { providerId?: unknown; modelId?: unknown };
    return {
      type: event.type,
      data: {
        providerId:
          typeof value?.providerId === "string" ? value.providerId : undefined,
        modelId: typeof value?.modelId === "string" ? value.modelId : undefined,
      },
    };
  }
  if (event.type === "thinking") {
    const value = event.data as { label?: unknown } | string | undefined;
    return {
      type: event.type,
      data:
        typeof value === "string"
          ? value.slice(0, 2_000)
          : {
              label:
                typeof value?.label === "string"
                  ? value.label
                  : "Agent 正在分析",
            },
    };
  }
  if (event.type === "error") {
    return { type: event.type, error: sanitizeRendererError(event.error) };
  }
  return { type: event.type };
}

function sanitizeRendererError(value?: string): string | undefined {
  return value
    ?.slice(0, 2_000)
    .replace(
      /(api[_-]?key|authorization|credential|password|secret|token)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[已隐藏]"
    );
}

let manager: AgentSessionManager | undefined;

export function getAgentSessionManager(): AgentSessionManager {
  manager ??= new AgentSessionManager();
  return manager;
}
