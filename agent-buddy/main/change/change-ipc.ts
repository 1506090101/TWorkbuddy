import { ipcMain } from "electron";
import type { ChangeHunkDecision } from "@shared/types";
import { getChangeManager } from "./change-manager";

export function registerChangeIpcHandlers(): void {
  const manager = getChangeManager();
  ipcMain.handle("change:list-checkpoints", (_event, sessionId: string) =>
    manager.listCheckpoints(sessionId)
  );
  ipcMain.handle("change:list-changesets", (_event, sessionId: string) =>
    manager.listChangesets(sessionId)
  );
  ipcMain.handle("change:get-session-view", (_event, sessionId: string) =>
    manager.getSessionChangesetView(sessionId)
  );
  ipcMain.handle(
    "change:accept-file",
    (_event, sessionId: string, path: string) =>
      manager.acceptFile(sessionId, path)
  );
  ipcMain.handle(
    "change:reject-file",
    (_event, sessionId: string, path: string) =>
      manager.rejectFile(sessionId, path)
  );
  ipcMain.handle("change:accept-all", (_event, sessionId: string) =>
    manager.acceptAll(sessionId)
  );
  ipcMain.handle("change:revert-all", (_event, sessionId: string) =>
    manager.revertAll(sessionId)
  );
  ipcMain.handle(
    "change:accept-changeset",
    (_event, sessionId: string, changesetId: string) =>
      manager.acceptChangeset(sessionId, changesetId)
  );
  ipcMain.handle(
    "change:reject-changeset",
    (_event, sessionId: string, changesetId: string) =>
      manager.rejectChangeset(sessionId, changesetId)
  );
  ipcMain.handle("change:undo-last-checkpoint", (_event, sessionId: string) =>
    manager.undoLastCheckpoint(sessionId)
  );
  ipcMain.handle(
    "change:decide-hunk",
    (
      _event,
      sessionId: string,
      changesetId: string,
      path: string,
      hunkIndex: number,
      decision: ChangeHunkDecision
    ) => manager.decideHunk(sessionId, changesetId, path, hunkIndex, decision)
  );
  ipcMain.handle(
    "change:rollback-checkpoint",
    (_event, sessionId: string, checkpointId: string) =>
      manager.rollbackCheckpoint(sessionId, checkpointId)
  );
}
