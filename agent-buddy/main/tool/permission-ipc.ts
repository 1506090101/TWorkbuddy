import { ipcMain, type BrowserWindow } from "electron";
import type { PermissionDecision } from "@shared/types";
import { getPermissionManager } from "./permission-manager";

export function registerPermissionIpcHandlers(_window: BrowserWindow): void {
  const manager = getPermissionManager();
  ipcMain.handle(
    "tool:permission-response",
    (_event, decision: PermissionDecision) => {
      try {
        manager.respond(decision);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "权限决定失败",
        };
      }
    }
  );
}
