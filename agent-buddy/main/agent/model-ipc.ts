import { ipcMain } from "electron";
import type { ModelAssignment } from "@shared/types";
import { getAgentSessionManager } from "./agent-session-manager";
import { getModelConfigStore } from "./model-config-store";

export function registerModelIpcHandlers(): void {
  const store = getModelConfigStore();
  const sessions = getAgentSessionManager();

  ipcMain.handle("model:get-assignments", () => store.getAssignments());
  ipcMain.handle("model:get-assignment", (_event, agentId: string) =>
    store.getAssignment(agentId)
  );
  ipcMain.handle(
    "model:get-active-model",
    (_event, agentId: string, hasImages: boolean) =>
      store.getActiveModel(agentId, hasImages)
  );
  ipcMain.handle(
    "model:save-assignment",
    (_event, agentId: string, assignment: ModelAssignment) => {
      const saved = store.saveAssignment(agentId, assignment);
      sessions.applyAssignment(agentId, saved);
      return saved;
    }
  );
  ipcMain.handle("model:reset-assignment", (_event, agentId: string) => {
    const reset = store.resetAssignment(agentId);
    sessions.applyAssignment(agentId, reset);
    return reset;
  });
}
