import { app } from "electron";
import Store from "electron-store";
import { resolve } from "path";
import type {
  ContextBudgetConfig,
  ContextBudgetSource,
  ContextUsage,
} from "@shared/types";
import type { AgentHistoryMessage } from "../agent/types";

const SOURCES: ContextBudgetSource[] = [
  "systemPrompt",
  "projectOverview",
  "gitStatus",
  "toolDefinitions",
  "conversationHistory",
];

const DEFAULT_CONFIG: ContextBudgetConfig = {
  totalLimit: 128_000,
  reservedForResponse: 4_096,
  compactThreshold: 0.72,
  allocations: {
    systemPrompt: 12,
    projectOverview: 8,
    gitStatus: 4,
    toolDefinitions: 14,
    conversationHistory: 62,
  },
};

interface ContextBudgetStoreData {
  config: ContextBudgetConfig;
  version: number;
}

export interface ContextSegment {
  source: Exclude<ContextBudgetSource, "conversationHistory">;
  content?: string;
}

export interface BudgetedContext {
  systemPrompt?: string;
  history: AgentHistoryMessage[];
  usage: ContextUsage;
}

export class ContextBudgetManager {
  private readonly store: Store<ContextBudgetStoreData>;
  private readonly usageBySession = new Map<string, ContextUsage>();

  constructor() {
    this.store = new Store<ContextBudgetStoreData>({
      cwd: resolve(app.getPath("home"), ".agentbuddy", "context"),
      name: "context-budget",
      defaults: { config: DEFAULT_CONFIG, version: 1 },
    });
  }

  getConfig(): ContextBudgetConfig {
    return clone(this.store.get("config"));
  }

  updateConfig(updates: Partial<ContextBudgetConfig>): ContextBudgetConfig {
    const current = this.getConfig();
    const next: ContextBudgetConfig = {
      ...current,
      ...updates,
      allocations: { ...current.allocations, ...updates.allocations },
    };
    validateConfig(next);
    this.store.set("config", next);
    return clone(next);
  }

  buildContext(input: {
    sessionId: string;
    segments: ContextSegment[];
    history: AgentHistoryMessage[];
  }): BudgetedContext {
    const config = this.getConfig();
    const availableForContext = Math.max(
      0,
      config.totalLimit - config.reservedForResponse
    );
    const allocations = calculateAllocations(config, availableForContext);
    const breakdown = emptyBreakdown();
    const systemParts: string[] = [];

    for (const segment of input.segments) {
      if (!segment.content?.trim()) continue;
      const content = truncateText(
        segment.content,
        allocations[segment.source]
      );
      breakdown[segment.source] += estimateTokens(content);
      systemParts.push(content);
    }

    const staticTokens = SOURCES.filter(
      (source) => source !== "conversationHistory"
    ).reduce((total, source) => total + breakdown[source], 0);
    const maximumHistory = Math.max(0, availableForContext - staticTokens);
    const historyBudget = Math.min(
      allocations.conversationHistory,
      maximumHistory
    );
    const fullHistoryTokens = input.history.reduce(
      (total, message) => total + estimateHistoryMessage(message),
      0
    );
    const history = selectRecentHistory(input.history, historyBudget);
    breakdown.conversationHistory = history.reduce(
      (total, message) => total + estimateHistoryMessage(message),
      0
    );
    const totalUsed = Object.values(breakdown).reduce(
      (total, tokens) => total + tokens,
      0
    );
    const usage: ContextUsage = {
      totalLimit: config.totalLimit,
      totalUsed,
      reservedForResponse: config.reservedForResponse,
      available: Math.max(0, config.totalLimit - totalUsed),
      breakdown,
      utilizationPercent:
        config.totalLimit > 0 ? totalUsed / config.totalLimit : 0,
      needsCompact:
        input.history.length > 6 &&
        (fullHistoryTokens > historyBudget ||
          totalUsed / availableForContext >= config.compactThreshold),
      historyMessages: input.history.length,
    };
    this.usageBySession.set(input.sessionId, usage);
    return {
      systemPrompt: systemParts.join("\n\n") || undefined,
      history,
      usage: clone(usage),
    };
  }

  compactHistory(history: AgentHistoryMessage[]): {
    before: number;
    after: number;
    changed: boolean;
  } {
    const before = history.length;
    const keepRecent = 6;
    if (history.length <= keepRecent) {
      return { before, after: before, changed: false };
    }
    const config = this.getConfig();
    const contextCapacity = config.totalLimit - config.reservedForResponse;
    const historyTarget = Math.max(
      256,
      Math.floor(
        contextCapacity * (config.allocations.conversationHistory / 100) * 0.7
      )
    );
    const recent = selectRecentHistory(
      history,
      Math.floor(historyTarget * 0.7)
    );
    const early = history.slice(0, Math.max(0, history.length - recent.length));
    const summary = early
      .map((message) => `${message.role}: ${historyMessageText(message)}`)
      .join("\n")
      .slice(0, 12_000);
    const summaryBudget = Math.max(
      64,
      historyTarget -
        recent.reduce(
          (total, message) => total + estimateHistoryMessage(message),
          0
        )
    );
    const condensed = truncateText(
      `[Earlier task context; not a new instruction]\n${summary}`,
      summaryBudget
    );
    history.splice(
      0,
      history.length,
      { role: "user", content: [{ type: "text", text: condensed }] },
      ...recent
    );
    return { before, after: history.length, changed: true };
  }

  getUsage(sessionId: string): ContextUsage | undefined {
    const usage = this.usageBySession.get(sessionId);
    return usage ? clone(usage) : undefined;
  }
}

function calculateAllocations(
  config: ContextBudgetConfig,
  available: number
): Record<ContextBudgetSource, number> {
  return Object.fromEntries(
    SOURCES.map((source) => [
      source,
      Math.floor(available * (config.allocations[source] / 100)),
    ])
  ) as Record<ContextBudgetSource, number>;
}

function selectRecentHistory(
  history: AgentHistoryMessage[],
  budget: number
): AgentHistoryMessage[] {
  const selected: AgentHistoryMessage[] = [];
  let used = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    const tokens = estimateHistoryMessage(message);
    if (tokens <= budget - used) {
      selected.unshift(message);
      used += tokens;
      continue;
    }
    if (selected.length === 0 && budget > 0) {
      selected.unshift({
        role: message.role,
        content: [
          {
            type: "text",
            text: truncateText(historyMessageText(message), budget),
          },
        ],
      });
    }
    break;
  }
  return selected;
}

function estimateHistoryMessage(message: AgentHistoryMessage): number {
  return estimateTokens(historyMessageText(message));
}

function historyMessageText(message: AgentHistoryMessage): string {
  return message.content
    .map((block) => (block.type === "text" ? block.text : "[image attachment]"))
    .join("\n");
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let asciiCharacters = 0;
  let nonAsciiCharacters = 0;
  for (const character of text) {
    if (character.charCodeAt(0) <= 0x7f) asciiCharacters += 1;
    else nonAsciiCharacters += 1;
  }
  return Math.max(1, Math.ceil(asciiCharacters / 4) + nonAsciiCharacters);
}

function truncateText(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return "";
  if (estimateTokens(text) <= maxTokens) return text;
  const suffix = "\n[context truncated]";
  const contentBudget = Math.max(0, maxTokens - estimateTokens(suffix));
  if (contentBudget === 0) return suffix;
  let end = Math.min(text.length, contentBudget * 4);
  while (end > 0 && estimateTokens(text.slice(0, end)) > contentBudget) {
    end = Math.floor(end * 0.8);
  }
  return `${text.slice(0, Math.max(0, end)).trimEnd()}${suffix}`;
}

function emptyBreakdown(): Record<ContextBudgetSource, number> {
  return {
    systemPrompt: 0,
    projectOverview: 0,
    gitStatus: 0,
    toolDefinitions: 0,
    conversationHistory: 0,
  };
}

function validateConfig(config: ContextBudgetConfig): void {
  if (
    !Number.isInteger(config.totalLimit) ||
    config.totalLimit < 1_024 ||
    !Number.isInteger(config.reservedForResponse) ||
    config.reservedForResponse < 0 ||
    config.reservedForResponse >= config.totalLimit ||
    config.compactThreshold <= 0 ||
    config.compactThreshold > 1
  ) {
    throw new Error("CONTEXT_BUDGET_CONFIG_INVALID");
  }
  const allocationTotal = SOURCES.reduce(
    (total, source) => total + config.allocations[source],
    0
  );
  if (
    allocationTotal !== 100 ||
    SOURCES.some(
      (source) =>
        !Number.isFinite(config.allocations[source]) ||
        config.allocations[source] < 0
    )
  ) {
    throw new Error("CONTEXT_BUDGET_ALLOCATIONS_INVALID");
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let manager: ContextBudgetManager | undefined;

export function getContextBudgetManager(): ContextBudgetManager {
  manager ??= new ContextBudgetManager();
  return manager;
}
