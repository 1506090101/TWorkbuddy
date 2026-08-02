/**
 * F0.5: IPC Handlers — Window controls + stubs
 *
 * Window controls are registered immediately.
 * Agent/Provider/Settings handlers will be added in F1.1, F1.3.
 */
import { ipcMain, BrowserWindow } from "electron";
import { registerAgentIpcHandlers } from "./agent/agent-ipc";
import { registerModelIpcHandlers } from "./agent/model-ipc";
import { registerProviderIpcHandlers } from "./providers/provider-manager";
import { registerWorkSessionIpcHandlers } from "./work-session/work-session-ipc";
import { registerPermissionIpcHandlers } from "./tool/permission-ipc";
import { registerProjectIpcHandlers } from "./project/project-ipc";
import { registerGitIpcHandlers } from "./git/git-ipc";
import { registerChangeIpcHandlers } from "./change/change-ipc";
import { registerContextIpcHandlers } from "./context/context-ipc";
import { registerUsageIpcHandlers } from "./usage/usage-ipc";

export function registerIpcHandlers(win: BrowserWindow): void {
  // === Window controls ===
  ipcMain.on("window:minimize", () => {
    win.minimize();
  });

  ipcMain.on("window:maximize", () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on("window:close", () => {
    win.close();
  });

  // === Agent session runtime (F1.3) ===
  registerWorkSessionIpcHandlers(win);
  registerPermissionIpcHandlers(win);
  registerAgentIpcHandlers(win);
  registerModelIpcHandlers();
  registerProjectIpcHandlers();
  registerGitIpcHandlers();
  registerChangeIpcHandlers();
  registerContextIpcHandlers();
  registerUsageIpcHandlers();

  // === Provider registry (F1.1) ===
  registerProviderIpcHandlers();

  // === Settings stubs ===
  ipcMain.handle("settings:get", async () => {
    return {
      providers: [],
      modelAssignment: {
        chat: { providerId: "", modelId: "" },
        vision: undefined,
        thinkingLevel: "off",
        autoSwitchOnImage: true,
        fallbackToChatForImages: false,
        retryOnProviderError: true,
      },
      thinkingLevel: "off",
      themeMode: "system",
    };
  });

  ipcMain.handle("settings:save", async () => {
    return { success: true };
  });
}
