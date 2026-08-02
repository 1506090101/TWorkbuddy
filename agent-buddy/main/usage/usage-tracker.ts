import { randomUUID } from "crypto";
import { app } from "electron";
import Store from "electron-store";
import { resolve } from "path";
import type {
  ModelPricing,
  ModelPricingEntry,
  ModelUsageRecord,
  MonthlyUsageBudget,
  SessionUsage,
  UsageReport,
} from "@shared/types";

const MILLION = 1_000_000;
const RETENTION_MONTHS = 12;
const DEFAULT_BUDGET: MonthlyUsageBudget = {
  monthlyLimitUsd: 20,
  alertThreshold: 0.8,
};

type UsageGroup = "session" | "agent" | "provider" | "day";

export interface UsageReportInput {
  groupBy?: UsageGroup;
  from?: number;
  to?: number;
}

interface UsageStoreData {
  records: ModelUsageRecord[];
  monthlyBudget: MonthlyUsageBudget;
  pricing: Record<string, ModelPricing>;
  alertedMonth?: string;
  version: number;
}

export interface UsageRecordInput extends Omit<
  ModelUsageRecord,
  "id" | "timestamp" | "costUsd" | "priced"
> {}

export interface UsageRecordResult {
  record: ModelUsageRecord;
  budgetAlert?: {
    spendUsd: number;
    budget: MonthlyUsageBudget;
  };
}

export class UsageTracker {
  private readonly store: Store<UsageStoreData>;

  constructor() {
    this.store = new Store<UsageStoreData>({
      cwd: resolve(app.getPath("home"), ".agentbuddy", "usage"),
      name: "usage-records",
      defaults: {
        records: [],
        monthlyBudget: DEFAULT_BUDGET,
        pricing: {},
        version: 1,
      },
    });
  }

  record(input: UsageRecordInput): UsageRecordResult {
    validateUsageInput(input);
    this.pruneExpiredRecords();

    const pricing =
      this.store.get("pricing")[pricingKey(input.providerId, input.modelId)];
    const costUsd = pricing
      ? (input.inputTokens * pricing.inputUsdPerMillion +
          input.outputTokens * pricing.outputUsdPerMillion) /
        MILLION
      : 0;
    const record: ModelUsageRecord = {
      ...input,
      id: `usage_${randomUUID()}`,
      timestamp: Date.now(),
      costUsd,
      priced: Boolean(pricing),
    };
    this.store.set("records", [...this.store.get("records"), record]);

    const budgetAlert = this.checkBudgetAlert(record.timestamp);
    return { record: clone(record), budgetAlert };
  }

  getSessionUsage(sessionId: string): SessionUsage {
    const records = this.store
      .get("records")
      .filter((record) => record.sessionId === sessionId);
    return {
      sessionId,
      tokens: sum(
        records,
        (record) => record.inputTokens + record.outputTokens
      ),
      costUsd: sum(records, (record) => record.costUsd),
      requests: records.length,
      pricedRequests: records.filter((record) => record.priced).length,
    };
  }

  getReport(input: UsageReportInput = {}): UsageReport {
    const to = input.to ?? Date.now();
    const from = input.from ?? to - 30 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      throw new Error("用量查询时间范围无效");
    }
    const groupBy = input.groupBy ?? "session";
    const records = this.store
      .get("records")
      .filter((record) => record.timestamp >= from && record.timestamp <= to);
    const groups = new Map<string, ModelUsageRecord[]>();
    for (const record of records) {
      const key = getGroupKey(record, groupBy);
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }

    return {
      from,
      to,
      totalTokens: sum(
        records,
        (record) => record.inputTokens + record.outputTokens
      ),
      totalCostUsd: sum(records, (record) => record.costUsd),
      totalRequests: records.length,
      pricedRequests: records.filter((record) => record.priced).length,
      breakdown: [...groups.entries()]
        .map(([key, group]) => ({
          key,
          tokens: sum(
            group,
            (record) => record.inputTokens + record.outputTokens
          ),
          costUsd: sum(group, (record) => record.costUsd),
          requests: group.length,
        }))
        .sort((left, right) => right.tokens - left.tokens),
    };
  }

  getMonthlyBudget(): MonthlyUsageBudget {
    return clone(this.store.get("monthlyBudget"));
  }

  updateMonthlyBudget(
    updates: Partial<MonthlyUsageBudget>
  ): MonthlyUsageBudget {
    const next = { ...this.getMonthlyBudget(), ...updates };
    validateBudget(next);
    this.store.set("monthlyBudget", next);
    return clone(next);
  }

  setModelPricing(
    providerId: string,
    modelId: string,
    pricing: ModelPricing | undefined
  ): void {
    if (!providerId.trim() || !modelId.trim()) {
      throw new Error("Provider 和模型不能为空");
    }
    const allPricing = { ...this.store.get("pricing") };
    const key = pricingKey(providerId, modelId);
    if (!pricing) {
      delete allPricing[key];
    } else {
      validatePricing(pricing);
      allPricing[key] = clone(pricing);
    }
    this.store.set("pricing", allPricing);
  }

  listModelPricing(): ModelPricingEntry[] {
    return Object.entries(this.store.get("pricing"))
      .map(([key, pricing]) => {
        const separator = key.indexOf(":");
        if (separator <= 0 || separator === key.length - 1) return undefined;
        return {
          providerId: key.slice(0, separator),
          modelId: key.slice(separator + 1),
          ...clone(pricing),
        };
      })
      .filter((entry): entry is ModelPricingEntry => Boolean(entry))
      .sort((left, right) =>
        `${left.providerId}:${left.modelId}`.localeCompare(
          `${right.providerId}:${right.modelId}`
        )
      );
  }

  private checkBudgetAlert(
    timestamp: number
  ): UsageRecordResult["budgetAlert"] {
    const budget = this.getMonthlyBudget();
    const month = getMonthKey(timestamp);
    const { from, to } = getMonthRange(timestamp);
    const monthlySpend = this.getReport({
      from,
      to,
      groupBy: "day",
    }).totalCostUsd;
    const threshold = budget.monthlyLimitUsd * budget.alertThreshold;
    if (monthlySpend < threshold || this.store.get("alertedMonth") === month) {
      return undefined;
    }
    this.store.set("alertedMonth", month);
    return { spendUsd: monthlySpend, budget };
  }

  private pruneExpiredRecords(): void {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    const records = this.store.get("records");
    const retained = records.filter(
      (record) => record.timestamp >= cutoff.getTime()
    );
    if (retained.length !== records.length) this.store.set("records", retained);
  }
}

function getGroupKey(record: ModelUsageRecord, groupBy: UsageGroup): string {
  switch (groupBy) {
    case "agent":
      return record.agentId;
    case "provider":
      return record.providerId;
    case "day":
      return new Date(record.timestamp).toISOString().slice(0, 10);
    case "session":
    default:
      return record.sessionId;
  }
}

function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(timestamp: number): { from: number; to: number } {
  const date = new Date(timestamp);
  const from = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime() - 1;
  return { from, to };
}

function pricingKey(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

function sum<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function validateUsageInput(input: UsageRecordInput): void {
  if (
    !input.providerId ||
    !input.modelId ||
    !input.sessionId ||
    !input.agentId
  ) {
    throw new Error("用量记录缺少 Provider、模型、会话或 Agent");
  }
  for (const value of [
    input.inputTokens,
    input.outputTokens,
    input.durationMs,
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("用量记录包含无效数值");
    }
  }
}

function validateBudget(budget: MonthlyUsageBudget): void {
  if (!Number.isFinite(budget.monthlyLimitUsd) || budget.monthlyLimitUsd <= 0) {
    throw new Error("月度预算必须大于 0");
  }
  if (
    !Number.isFinite(budget.alertThreshold) ||
    budget.alertThreshold <= 0 ||
    budget.alertThreshold > 1
  ) {
    throw new Error("预算预警阈值必须在 0 到 1 之间");
  }
}

function validatePricing(pricing: ModelPricing): void {
  for (const value of [
    pricing.inputUsdPerMillion,
    pricing.outputUsdPerMillion,
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("模型定价必须是非负数");
    }
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let tracker: UsageTracker | undefined;

export function getUsageTracker(): UsageTracker {
  tracker ??= new UsageTracker();
  return tracker;
}
