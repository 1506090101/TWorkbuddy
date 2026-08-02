/**
 * Agent Buddy — Shared Types
 * F0.5: IPC Communication Layer & Type System
 *
 * Types shared between main process and renderer process.
 * This file is imported by both sides — must not import electron or node modules.
 */

// ============================================================
// Provider Types (F1.1)
// ============================================================

export type ProviderType =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "gemini"
  | "mistral"
  | "openrouter"
  | "custom";

export type ProviderStatus = "connected" | "untested" | "error";

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  description?: string;
}

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;
  /** API Key is masked when this object crosses the IPC boundary. */
  apiKey: string;
  baseURL?: string;
  models: ModelInfo[];
  status: ProviderStatus;
  statusMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export type ProviderCreateInput = Pick<
  ProviderConfig,
  "type" | "name" | "apiKey" | "baseURL" | "models"
>;

export type ProviderUpdateInput = Partial<ProviderCreateInput>;

export interface ProviderConnectionResult {
  success: boolean;
  duration: number;
  message: string;
}

export type ProviderImportInput = ProviderCreateInput & {
  id?: string;
};

export interface ModelRef {
  providerId: string;
  modelId: string;
}

export interface ModelAssignment {
  chat: ModelRef;
  vision?: ModelRef;
  thinkingLevel: ThinkingLevel;
  autoSwitchOnImage: boolean;
  fallbackToChatForImages: boolean;
  retryOnProviderError: boolean;
}

export type ThinkingLevel = "off" | "low" | "medium" | "high";
export type ThemeMode = "light" | "dark" | "system";
export type Locale = "zh-CN" | "en";

export type ContextBudgetSource =
  | "systemPrompt"
  | "projectOverview"
  | "gitStatus"
  | "toolDefinitions"
  | "conversationHistory";

export interface ContextBudgetConfig {
  totalLimit: number;
  reservedForResponse: number;
  compactThreshold: number;
  allocations: Record<ContextBudgetSource, number>;
}

export interface ContextUsage {
  totalLimit: number;
  totalUsed: number;
  reservedForResponse: number;
  available: number;
  breakdown: Record<ContextBudgetSource, number>;
  utilizationPercent: number;
  needsCompact: boolean;
  historyMessages: number;
}

// ============================================================
// Usage observability (F1.15)
// ============================================================

export interface ModelUsageRecord {
  id: string;
  timestamp: number;
  providerId: string;
  providerType: ProviderType;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  sessionId: string;
  agentId: string;
  projectId?: string;
  costUsd: number;
  priced: boolean;
  inputEstimated: boolean;
  outputEstimated: boolean;
}

export interface SessionUsage {
  sessionId: string;
  tokens: number;
  costUsd: number;
  requests: number;
  pricedRequests: number;
}

export interface UsageReport {
  from: number;
  to: number;
  totalTokens: number;
  totalCostUsd: number;
  totalRequests: number;
  pricedRequests: number;
  breakdown: Array<{
    key: string;
    tokens: number;
    costUsd: number;
    requests: number;
  }>;
}

export interface MonthlyUsageBudget {
  monthlyLimitUsd: number;
  alertThreshold: number;
}

export interface ModelPricing {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export interface ModelPricingEntry extends ModelPricing {
  providerId: string;
  modelId: string;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { data: string; media_type: string };
    };

export interface RoutingDecision {
  useModel: "chat" | "vision";
  reason: string;
  modelAssignment: ModelRef;
}

export interface AppSettings {
  providers: ProviderConfig[];
  modelAssignment: ModelAssignment;
  thinkingLevel: ThinkingLevel;
  themeMode: ThemeMode;
  locale: Locale;
}

export const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  modelAssignment: {
    chat: { providerId: "", modelId: "" },
    vision: undefined,
    thinkingLevel: "off",
    autoSwitchOnImage: true,
    fallbackToChatForImages: true,
    retryOnProviderError: false,
  },
  thinkingLevel: "off",
  themeMode: "system",
  locale: "zh-CN",
};

// ============================================================
// IPC Result Types
// ============================================================

export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// Chat Message Types (F1.4)
// ============================================================

export interface ImageAttachment {
  id: string;
  data: string; // base64
  mimeType: string;
  name: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  isError?: boolean;
  isStreaming?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "toolResult";
  content: string;
  images?: ImageAttachment[];
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
  timestamp: number;
  error?: string;
  modelUsed?: string;
  agentId?: string;
  agentName?: string;
}

// ============================================================
// Agent Workbuddy Types (V2)
// ============================================================

export type WorkSessionStatus =
  "idle" | "running" | "completed" | "failed" | "aborted" | "archived";

export type WorkEventType =
  | "user_task"
  | "agent_progress"
  | "agent_message"
  | "tool_call"
  | "permission_request"
  | "permission_decision"
  | "file_change"
  | "test_result"
  | "error"
  | "summary"
  | "system";

export type WorkEventStatus =
  "pending" | "running" | "completed" | "failed" | "aborted" | "info";

export type WorkAttachmentKind = "image" | "text" | "code";

export interface WorkAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: WorkAttachmentKind;
  createdAt: number;
}

/** The request-only file payload. `data` is never persisted with WorkSession. */
export interface ComposerAttachment extends WorkAttachment {
  data: string;
  encoding: "base64" | "utf8";
}

export interface SessionModelOverride {
  providerId: string;
  modelId: string;
  thinkingLevel?: ThinkingLevel;
}

export type GoalStatus = "draft" | "active" | "blocked" | "completed";

export type GoalExecutionStatus = "idle" | "running" | "stopped";

export interface GoalStep {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: GoalStatus;
  executionStatus: GoalExecutionStatus;
  blockedReason?: string;
  steps: GoalStep[];
  result?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GoalInput {
  id?: string;
  title: string;
  description?: string;
  status?: GoalStatus;
  executionStatus?: GoalExecutionStatus;
  blockedReason?: string;
  steps?: GoalStep[];
  result?: string;
}

export interface WorkEvent {
  id: string;
  sessionId: string;
  type: WorkEventType;
  status: WorkEventStatus;
  timestamp: number;
  title: string;
  content?: string;
  agentId?: string;
  attachmentIds?: string[];
  metadata?: Record<string, unknown>;
}

export type PermissionLevel = "auto" | "confirm" | "confirm_warn";
export type PermissionAction = "allow" | "deny" | "allow_always";

export interface PermissionRequest {
  id: string;
  sessionId: string;
  toolName: string;
  toolLabel: string;
  permission: PermissionLevel;
  params: Record<string, unknown>;
  impact: string;
  category: string;
  timestamp: number;
}

export interface PermissionDecision {
  requestId: string;
  action: PermissionAction;
  category?: string;
}

export type BuiltinToolName =
  "read" | "write" | "edit" | "bash" | "grep" | "find" | "ls";

export interface ToolDefinition {
  name: BuiltinToolName;
  label: string;
  description: string;
  permission: PermissionLevel;
  category: string;
}

export interface ToolExecutionResult {
  toolName: BuiltinToolName;
  output: string;
  duration: number;
  changedPath?: string;
  exitCode?: number;
  denied?: boolean;
}

export type ChangeHunkDecision = "pending" | "accepted" | "rejected";

export interface FileSnapshot {
  path: string;
  existed: boolean;
  content: string;
  hash: string;
  size: number;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  timestamp: number;
  description: string;
  files: FileSnapshot[];
  trigger: "agent" | "user";
  toolName?: BuiltinToolName;
}

export interface DiffLine {
  type: "context" | "addition" | "deletion";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  index: number;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
  decision: ChangeHunkDecision;
}

export interface ReviewFileChange {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface Changeset {
  id: string;
  sessionId: string;
  checkpointId: string;
  reason?: string;
  files: ReviewFileChange[];
  totalAdditions: number;
  totalDeletions: number;
  createdAt: number;
  updatedAt: number;
}

export type ChangeFileReviewStatus =
  "pending" | "accepted" | "rejected" | "mixed";

export interface SessionChangedFile {
  path: string;
  reason: string;
  changeType: "create" | "modify" | "delete";
  additions: number;
  deletions: number;
  checkpointIds: string[];
  changesetIds: string[];
  acceptedHunks: number;
  rejectedHunks: number;
  totalHunks: number;
  reviewStatus: ChangeFileReviewStatus;
  agentChanges: true;
}

export interface SessionChangesetView {
  id: string;
  sessionId: string;
  title?: string;
  files: SessionChangedFile[];
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  checkpointCount: number;
  pendingFiles: number;
  acceptedFiles: number;
  rejectedFiles: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: BuiltinToolName[];
  skills: string[];
  icon: string;
  color: string;
  isDefault: boolean;
}

export interface AgentListItem {
  id: string;
  name: string;
  description: string;
  tools: BuiltinToolName[];
  skills: string[];
  icon: string;
  color: string;
  isDefault: boolean;
}

export interface WorkSessionProject {
  id?: string;
  name?: string;
  rootPath?: string;
}

export type WorkSessionBranchType =
  "manual" | "agent_invocation" | "task_delegation";

export type WorkSessionBranchMergeStatus = "pending" | "merged" | "discarded";

/**
 * Branch metadata is deliberately small. The branch owns its own event history,
 * attachments, and permission decisions; only this constrained summary crosses
 * the task boundary.
 */
export interface WorkSessionBranch {
  parentSessionId: string;
  type: WorkSessionBranchType;
  contextSummary: string;
  mergeStatus: WorkSessionBranchMergeStatus;
  createdAt: number;
  updatedAt: number;
  mergedAt?: number;
  mergeEventId?: string;
}

export interface WorkSessionBranchInput {
  parentSessionId: string;
  title?: string;
  agentId?: string;
  contextSummary?: string;
  type?: WorkSessionBranchType;
}

export interface WorkSessionBranchOperationResult {
  parentSession: WorkSession;
  branchSession: WorkSession;
}

export interface WorkSession {
  id: string;
  title: string;
  project?: WorkSessionProject;
  activeAgentId: string;
  modelOverride?: SessionModelOverride;
  pluginIds: string[];
  goal?: Goal;
  branch?: WorkSessionBranch;
  attachments: WorkAttachment[];
  events: WorkEvent[];
  status: WorkSessionStatus;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  archivedAt?: number;
}

export interface WorkSessionSummary {
  id: string;
  title: string;
  activeAgentId: string;
  status: WorkSessionStatus;
  goal?: Pick<Goal, "id" | "title" | "status">;
  parentSessionId?: string;
  branchMergeStatus?: WorkSessionBranchMergeStatus;
  updatedAt: number;
  lastOpenedAt: number;
  eventCount: number;
}

export interface WorkSessionCreateInput {
  title?: string;
  project?: WorkSessionProject;
  agentId?: string;
}

export interface ComposerContext {
  agentId: string;
  modelOverride?: SessionModelOverride;
  thinkingLevel?: ThinkingLevel;
  attachments: ComposerAttachment[];
  pluginIds: string[];
  goalId?: string;
}

// ============================================================
// Agent Event Types (F1.3)
// ============================================================

export type AgentThinkingLevel = "off" | "low" | "medium" | "high";

export interface AgentSessionInit {
  agentId?: string;
  providerId?: string;
  modelId?: string;
  thinkingLevel?: AgentThinkingLevel;
  systemPrompt?: string;
}

export interface AgentPromptRequest {
  /** Persistent Agent Workbuddy session. Omit only for legacy callers. */
  sessionId?: string;
  agentId?: string;
  context?: ComposerContext;
  message: {
    role: "user";
    content: ContentBlock[];
  };
}

export interface AgentPromptResponse {
  sessionId: string;
}

export interface AgentStatus {
  hasProvider: boolean;
  sessionId?: string;
  providerId?: string;
  modelId?: string;
  isGenerating: boolean;
}

export type AgentEventType =
  | "session_ready"
  | "model_changed"
  | "token"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "completed"
  | "aborted"
  | "agent_start"
  | "turn_start"
  | "message_update"
  | "message_end"
  | "tool_execution_start"
  | "tool_execution_update"
  | "tool_execution_end"
  | "agent_end"
  | "agent_settled"
  | "error";

export interface AgentEvent {
  sessionId?: string;
  type: AgentEventType;
  data?: unknown;
  error?: string;
}

// ============================================================
// Project Context Types (F1.9)
// ============================================================

export type ProjectType =
  "node" | "python" | "rust" | "go" | "java" | "cpp" | "mixed" | "unknown";

export interface DependencyInfo {
  name: string;
  version: string;
  isDev?: boolean;
}

export interface ProjectStructure {
  sourceDirs: string[];
  testDirs: string[];
  configFiles: string[];
  entryPoints: string[];
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  totalChanges: number;
}

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
}

export interface ProjectContext {
  rootPath: string;
  type: ProjectType;
  language: string;
  framework?: string;
  packageManager?: string;
  buildSystem?: string;
  testCommand?: string;
  lintCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  dependencies: DependencyInfo[];
  scripts?: Record<string, string>;
  gitInfo?: GitStatus;
  structure: ProjectStructure;
  detectedAt: number;
}

// ============================================================
// Electron API (Preload bridge)
// ============================================================

export interface ElectronAPI {
  // Persistent work sessions (Agent Workbuddy V2)
  createWorkSession: (input?: WorkSessionCreateInput) => Promise<WorkSession>;
  createWorkSessionBranch: (
    input: WorkSessionBranchInput
  ) => Promise<WorkSession>;
  updateWorkSessionBranchSummary: (
    sessionId: string,
    contextSummary: string
  ) => Promise<WorkSession>;
  mergeWorkSessionBranch: (
    sessionId: string
  ) => Promise<WorkSessionBranchOperationResult>;
  discardWorkSessionBranch: (
    sessionId: string
  ) => Promise<WorkSessionBranchOperationResult>;
  listWorkSessions: () => Promise<WorkSessionSummary[]>;
  getWorkSession: (sessionId: string) => Promise<WorkSession>;
  openWorkSession: (sessionId: string) => Promise<WorkSession>;
  recoverWorkSession: () => Promise<WorkSession>;
  renameWorkSession: (sessionId: string, title: string) => Promise<WorkSession>;
  archiveWorkSession: (sessionId: string) => Promise<WorkSession>;
  updateWorkSessionGoal: (
    sessionId: string,
    goal?: GoalInput
  ) => Promise<WorkSession>;
  stopWorkSessionGoal: (sessionId: string) => Promise<WorkSession>;
  replanWorkSessionGoal: (sessionId: string) => Promise<WorkSession>;
  chooseWorkSessionProject: () => Promise<WorkSessionProject | null>;
  updateWorkSessionProject: (
    sessionId: string,
    project?: WorkSessionProject
  ) => Promise<WorkSession>;
  updateWorkSessionAgent: (
    sessionId: string,
    agentId: string
  ) => Promise<WorkSession>;
  onWorkSessionEvent: (
    callback: (event: WorkEvent) => void
  ) => (() => void) | undefined;
  onPermissionRequest: (
    callback: (request: PermissionRequest) => void
  ) => (() => void) | undefined;
  respondToPermission: (decision: PermissionDecision) => Promise<IpcResult>;

  // Agent definitions (F2.1)
  listAgents: () => Promise<AgentListItem[]>;
  getAgentDefinition: (agentId: string) => Promise<AgentDefinition>;

  // Agent
  initAgent: (
    config?: AgentSessionInit
  ) => Promise<IpcResult<AgentPromptResponse>>;
  prompt: (
    request: AgentPromptRequest
  ) => Promise<IpcResult<AgentPromptResponse>>;
  abort: (sessionId?: string) => Promise<IpcResult>;
  steer: (text: string, sessionId?: string) => Promise<IpcResult>;
  setModel: (
    providerId: string,
    modelId: string,
    sessionId?: string
  ) => Promise<IpcResult>;
  getState: () => Promise<AgentStatus>;

  // Agent events
  onAgentEvent: (
    callback: (event: AgentEvent) => void
  ) => (() => void) | undefined;

  // Providers
  listProviders: () => Promise<ProviderConfig[]>;
  createProvider: (config: ProviderCreateInput) => Promise<ProviderConfig>;
  updateProvider: (
    id: string,
    updates: ProviderUpdateInput
  ) => Promise<ProviderConfig>;
  deleteProvider: (id: string) => Promise<void>;
  testProvider: (id: string) => Promise<ProviderConnectionResult>;
  detectModels: (id: string) => Promise<ModelInfo[]>;
  importProviders: (
    providers: ProviderImportInput[]
  ) => Promise<ProviderConfig[]>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<IpcResult>;

  // Model routing and assignment (F1.2 / F1.8)
  getModelAssignments: () => Promise<Record<string, ModelAssignment>>;
  getModelAssignment: (agentId: string) => Promise<ModelAssignment>;
  getActiveModel: (
    agentId: string,
    hasImages: boolean
  ) => Promise<RoutingDecision>;
  saveModelAssignment: (
    agentId: string,
    assignment: ModelAssignment
  ) => Promise<ModelAssignment>;
  resetModelAssignment: (agentId: string) => Promise<ModelAssignment>;

  // Window controls
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;

  // Project
  detectProject: (rootPath: string) => Promise<ProjectContext>;
  getProjectContext: (rootPath: string) => Promise<ProjectContext | null>;
  refreshProjectContext: (rootPath: string) => Promise<ProjectContext>;

  // Git context (F1.10, read-only first slice)
  getGitStatus: (rootPath: string) => Promise<GitStatus | null>;

  // File change review (F1.11)
  listCheckpoints: (sessionId: string) => Promise<Checkpoint[]>;
  listChangesets: (sessionId: string) => Promise<Changeset[]>;
  decideChangesetHunk: (
    sessionId: string,
    changesetId: string,
    path: string,
    hunkIndex: number,
    decision: ChangeHunkDecision
  ) => Promise<Changeset>;
  rollbackCheckpoint: (
    sessionId: string,
    checkpointId: string
  ) => Promise<Changeset[]>;
  getSessionChangesetView: (sessionId: string) => Promise<SessionChangesetView>;
  acceptChangesetFile: (
    sessionId: string,
    path: string
  ) => Promise<SessionChangesetView>;
  rejectChangesetFile: (
    sessionId: string,
    path: string
  ) => Promise<SessionChangesetView>;
  acceptAllChanges: (sessionId: string) => Promise<SessionChangesetView>;
  revertAllChanges: (sessionId: string) => Promise<SessionChangesetView>;
  acceptChangeset: (
    sessionId: string,
    changesetId: string
  ) => Promise<Changeset>;
  rejectChangeset: (
    sessionId: string,
    changesetId: string
  ) => Promise<Changeset>;
  undoLastCheckpoint: (sessionId: string) => Promise<Changeset[]>;

  // Context budget (F1.14)
  getContextUsage: (sessionId: string) => Promise<ContextUsage | undefined>;
  getContextBudgetConfig: () => Promise<ContextBudgetConfig>;
  updateContextBudgetConfig: (
    updates: Partial<ContextBudgetConfig>
  ) => Promise<ContextBudgetConfig>;
  compactContext: (sessionId: string) => Promise<ContextUsage>;

  // Usage observability (F1.15)
  getSessionUsage: (sessionId: string) => Promise<SessionUsage>;
  getUsageReport: (input?: {
    groupBy?: "session" | "agent" | "provider" | "day";
    from?: number;
    to?: number;
  }) => Promise<UsageReport>;
  getMonthlyUsageBudget: () => Promise<MonthlyUsageBudget>;
  updateMonthlyUsageBudget: (
    updates: Partial<MonthlyUsageBudget>
  ) => Promise<MonthlyUsageBudget>;
  setModelPricing: (
    providerId: string,
    modelId: string,
    pricing: ModelPricing | undefined
  ) => Promise<void>;
  listModelPricing: () => Promise<ModelPricingEntry[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
