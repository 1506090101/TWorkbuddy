/**
 * F0.5: Preload script — Safe IPC bridge via contextBridge
 *
 * Exposes a typed API to the renderer process.
 * Renderer never has direct Node.js access.
 */
import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentDefinition,
  AgentPromptRequest,
  ChangeHunkDecision,
  AgentSessionInit,
  AgentEvent,
  GoalInput,
  WorkSessionBranchInput,
  ModelAssignment,
  PermissionDecision,
  ProviderCreateInput,
  ProviderImportInput,
  ProviderUpdateInput,
  WorkSessionCreateInput,
  WorkSessionProject,
} from "@shared/types";

const electronAPI = {
  // === Persistent work sessions (Agent Workbuddy V2) ===
  createWorkSession: (input?: WorkSessionCreateInput) =>
    ipcRenderer.invoke("work-session:create", input),
  createWorkSessionBranch: (input: WorkSessionBranchInput) =>
    ipcRenderer.invoke("work-session:create-branch", input),
  updateWorkSessionBranchSummary: (sessionId: string, contextSummary: string) =>
    ipcRenderer.invoke(
      "work-session:update-branch-summary",
      sessionId,
      contextSummary
    ),
  mergeWorkSessionBranch: (sessionId: string) =>
    ipcRenderer.invoke("work-session:merge-branch", sessionId),
  discardWorkSessionBranch: (sessionId: string) =>
    ipcRenderer.invoke("work-session:discard-branch", sessionId),
  listWorkSessions: () => ipcRenderer.invoke("work-session:list"),
  getWorkSession: (sessionId: string) =>
    ipcRenderer.invoke("work-session:get", sessionId),
  openWorkSession: (sessionId: string) =>
    ipcRenderer.invoke("work-session:open", sessionId),
  recoverWorkSession: () => ipcRenderer.invoke("work-session:recover"),
  renameWorkSession: (sessionId: string, title: string) =>
    ipcRenderer.invoke("work-session:rename", sessionId, title),
  archiveWorkSession: (sessionId: string) =>
    ipcRenderer.invoke("work-session:archive", sessionId),
  updateWorkSessionGoal: (sessionId: string, goal?: GoalInput) =>
    ipcRenderer.invoke("work-session:update-goal", sessionId, goal),
  stopWorkSessionGoal: (sessionId: string) =>
    ipcRenderer.invoke("work-session:stop-goal", sessionId),
  replanWorkSessionGoal: (sessionId: string) =>
    ipcRenderer.invoke("work-session:replan-goal", sessionId),
  chooseWorkSessionProject: () =>
    ipcRenderer.invoke("work-session:choose-project"),
  updateWorkSessionProject: (sessionId: string, project?: WorkSessionProject) =>
    ipcRenderer.invoke("work-session:update-project", sessionId, project),
  updateWorkSessionAgent: (sessionId: string, agentId: string) =>
    ipcRenderer.invoke("work-session:update-agent", sessionId, agentId),
  onWorkSessionEvent: (callback: (event: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("work-session:event", handler);
    return () => {
      ipcRenderer.removeListener("work-session:event", handler);
    };
  },
  onPermissionRequest: (callback: (request: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("tool:permission-request", handler);
    return () => {
      ipcRenderer.removeListener("tool:permission-request", handler);
    };
  },
  respondToPermission: (decision: PermissionDecision) =>
    ipcRenderer.invoke("tool:permission-response", decision),

  // === Agent definitions (F2.1) ===
  listAgents: () => ipcRenderer.invoke("agent:list"),
  getAgentDefinition: (agentId: string): Promise<AgentDefinition> =>
    ipcRenderer.invoke("agent:get-definition", agentId),

  // === Agent (stubs — will be implemented in F1.3) ===
  initAgent: (config?: AgentSessionInit) =>
    ipcRenderer.invoke("agent:init", config),
  prompt: (request: AgentPromptRequest) =>
    ipcRenderer.invoke("agent:prompt", request),
  abort: (sessionId?: string) => ipcRenderer.invoke("agent:abort", sessionId),
  steer: (text: string, sessionId?: string) =>
    ipcRenderer.invoke("agent:steer", text, sessionId),
  setModel: (providerId: string, modelId: string, sessionId?: string) =>
    ipcRenderer.invoke("agent:set-model", providerId, modelId, sessionId),
  getState: () => ipcRenderer.invoke("agent:get-status"),

  // === Agent events ===
  onAgentEvent: (callback: (event: AgentEvent) => void) => {
    const handler = (_event: unknown, data: AgentEvent) => callback(data);
    ipcRenderer.on("agent:event", handler);
    return () => {
      ipcRenderer.removeListener("agent:event", handler);
    };
  },

  // === Providers (F1.1) ===
  listProviders: () => ipcRenderer.invoke("provider:list"),
  createProvider: (config: ProviderCreateInput) =>
    ipcRenderer.invoke("provider:create", config),
  updateProvider: (id: string, updates: ProviderUpdateInput) =>
    ipcRenderer.invoke("provider:update", id, updates),
  deleteProvider: (id: string) => ipcRenderer.invoke("provider:delete", id),
  testProvider: (id: string) =>
    ipcRenderer.invoke("provider:test-connection", id),
  detectModels: (id: string) =>
    ipcRenderer.invoke("provider:detect-models", id),
  importProviders: (providers: ProviderImportInput[]) =>
    ipcRenderer.invoke("provider:import", providers),

  // === Settings ===
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: unknown) =>
    ipcRenderer.invoke("settings:save", settings),

  // === Model routing and assignment (F1.2 / F1.8) ===
  getModelAssignments: () => ipcRenderer.invoke("model:get-assignments"),
  getModelAssignment: (agentId: string) =>
    ipcRenderer.invoke("model:get-assignment", agentId),
  getActiveModel: (agentId: string, hasImages: boolean) =>
    ipcRenderer.invoke("model:get-active-model", agentId, hasImages),
  saveModelAssignment: (agentId: string, assignment: ModelAssignment) =>
    ipcRenderer.invoke("model:save-assignment", agentId, assignment),
  resetModelAssignment: (agentId: string) =>
    ipcRenderer.invoke("model:reset-assignment", agentId),

  // === Window controls ===
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowMaximize: () => ipcRenderer.send("window:maximize"),
  windowClose: () => ipcRenderer.send("window:close"),

  // === Project context (F1.9) ===
  detectProject: (rootPath: string) =>
    ipcRenderer.invoke("project:detect", rootPath),
  getProjectContext: (rootPath: string) =>
    ipcRenderer.invoke("project:get-context", rootPath),
  refreshProjectContext: (rootPath: string) =>
    ipcRenderer.invoke("project:refresh", rootPath),

  // === Git context (F1.10) ===
  getGitStatus: (rootPath: string) =>
    ipcRenderer.invoke("git:status", rootPath),

  // === File change review (F1.11) ===
  listCheckpoints: (sessionId: string) =>
    ipcRenderer.invoke("change:list-checkpoints", sessionId),
  listChangesets: (sessionId: string) =>
    ipcRenderer.invoke("change:list-changesets", sessionId),
  getSessionChangesetView: (sessionId: string) =>
    ipcRenderer.invoke("change:get-session-view", sessionId),
  acceptChangesetFile: (sessionId: string, path: string) =>
    ipcRenderer.invoke("change:accept-file", sessionId, path),
  rejectChangesetFile: (sessionId: string, path: string) =>
    ipcRenderer.invoke("change:reject-file", sessionId, path),
  acceptAllChanges: (sessionId: string) =>
    ipcRenderer.invoke("change:accept-all", sessionId),
  revertAllChanges: (sessionId: string) =>
    ipcRenderer.invoke("change:revert-all", sessionId),
  decideChangesetHunk: (
    sessionId: string,
    changesetId: string,
    path: string,
    hunkIndex: number,
    decision: ChangeHunkDecision
  ) =>
    ipcRenderer.invoke(
      "change:decide-hunk",
      sessionId,
      changesetId,
      path,
      hunkIndex,
      decision
    ),
  rollbackCheckpoint: (sessionId: string, checkpointId: string) =>
    ipcRenderer.invoke("change:rollback-checkpoint", sessionId, checkpointId),
  acceptChangeset: (sessionId: string, changesetId: string) =>
    ipcRenderer.invoke("change:accept-changeset", sessionId, changesetId),
  rejectChangeset: (sessionId: string, changesetId: string) =>
    ipcRenderer.invoke("change:reject-changeset", sessionId, changesetId),
  undoLastCheckpoint: (sessionId: string) =>
    ipcRenderer.invoke("change:undo-last-checkpoint", sessionId),

  // === Context budget (F1.14) ===
  getContextUsage: (sessionId: string) =>
    ipcRenderer.invoke("context:get-usage", sessionId),
  getContextBudgetConfig: () => ipcRenderer.invoke("context:get-config"),
  updateContextBudgetConfig: (updates: unknown) =>
    ipcRenderer.invoke("context:update-config", updates),
  compactContext: (sessionId: string) =>
    ipcRenderer.invoke("context:compact", sessionId),

  // === Usage observability (F1.15) ===
  getSessionUsage: (sessionId: string) =>
    ipcRenderer.invoke("usage:get-session", sessionId),
  getUsageReport: (input?: unknown) =>
    ipcRenderer.invoke("usage:get-report", input),
  getMonthlyUsageBudget: () => ipcRenderer.invoke("usage:get-budget"),
  updateMonthlyUsageBudget: (updates: unknown) =>
    ipcRenderer.invoke("usage:update-budget", updates),
  setModelPricing: (providerId: string, modelId: string, pricing: unknown) =>
    ipcRenderer.invoke("usage:set-pricing", providerId, modelId, pricing),
  listModelPricing: () => ipcRenderer.invoke("usage:list-pricing"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
