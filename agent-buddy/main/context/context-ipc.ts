import { ipcMain } from "electron";
import type { ContextBudgetConfig } from "@shared/types";
import { getAgentSessionManager } from "../agent/agent-session-manager";
import { getContextBudgetManager } from "./context-budget-manager";

export function registerContextIpcHandlers(): void {
  const manager = getContextBudgetManager();
  ipcMain.handle("context:get-usage", (_event, sessionId: string) =>
    manager.getUsage(sessionId)
  );
  ipcMain.handle("context:get-config", () => manager.getConfig());
  ipcMain.handle(
    "context:update-config",
    (_event, updates: Partial<ContextBudgetConfig>) =>
      manager.updateConfig(updates)
  );
  ipcMain.handle("context:compact", (_event, sessionId: string) =>
    getAgentSessionManager().compactContext(sessionId)
  );
}
