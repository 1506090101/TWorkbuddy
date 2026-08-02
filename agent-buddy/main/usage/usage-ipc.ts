import { ipcMain } from "electron";
import type { ModelPricing, MonthlyUsageBudget } from "@shared/types";
import { getUsageTracker, type UsageReportInput } from "./usage-tracker";

const GROUPS = new Set(["session", "agent", "provider", "day"]);

export function registerUsageIpcHandlers(): void {
  const tracker = getUsageTracker();
  ipcMain.handle("usage:get-session", (_event, sessionId: string) => {
    if (!sessionId?.trim()) throw new Error("会话标识不能为空");
    return tracker.getSessionUsage(sessionId);
  });
  ipcMain.handle("usage:get-report", (_event, input: unknown) =>
    tracker.getReport(parseReportInput(input))
  );
  ipcMain.handle("usage:get-budget", () => tracker.getMonthlyBudget());
  ipcMain.handle("usage:update-budget", (_event, updates: unknown) =>
    tracker.updateMonthlyBudget(parseBudgetUpdates(updates))
  );
  ipcMain.handle(
    "usage:set-pricing",
    (_event, providerId: string, modelId: string, pricing: unknown) =>
      tracker.setModelPricing(providerId, modelId, parsePricing(pricing))
  );
  ipcMain.handle("usage:list-pricing", () => tracker.listModelPricing());
}

function parseReportInput(value: unknown): UsageReportInput {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error("用量查询参数无效");
  const { groupBy, from, to } = value;
  if (
    groupBy !== undefined &&
    (typeof groupBy !== "string" || !GROUPS.has(groupBy))
  ) {
    throw new Error("不支持的用量分组方式");
  }
  if (
    from !== undefined &&
    (typeof from !== "number" || !Number.isFinite(from))
  ) {
    throw new Error("开始时间无效");
  }
  if (to !== undefined && (typeof to !== "number" || !Number.isFinite(to))) {
    throw new Error("结束时间无效");
  }
  return { groupBy: groupBy as UsageReportInput["groupBy"], from, to };
}

function parseBudgetUpdates(value: unknown): Partial<MonthlyUsageBudget> {
  if (!isRecord(value)) throw new Error("预算更新参数无效");
  const updates: Partial<MonthlyUsageBudget> = {};
  if (value.monthlyLimitUsd !== undefined) {
    if (typeof value.monthlyLimitUsd !== "number")
      throw new Error("月度预算无效");
    updates.monthlyLimitUsd = value.monthlyLimitUsd;
  }
  if (value.alertThreshold !== undefined) {
    if (typeof value.alertThreshold !== "number")
      throw new Error("预算阈值无效");
    updates.alertThreshold = value.alertThreshold;
  }
  return updates;
}

function parsePricing(value: unknown): ModelPricing | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("模型定价参数无效");
  if (
    typeof value.inputUsdPerMillion !== "number" ||
    typeof value.outputUsdPerMillion !== "number"
  ) {
    throw new Error("模型定价必须包含输入和输出价格");
  }
  return {
    inputUsdPerMillion: value.inputUsdPerMillion,
    outputUsdPerMillion: value.outputUsdPerMillion,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
