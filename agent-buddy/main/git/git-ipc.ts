import { ipcMain } from "electron";
import { getGitManager } from "./git-manager";

export function registerGitIpcHandlers(): void {
  ipcMain.handle("git:status", (_event, rootPath: string) =>
    getGitManager().getStatus(rootPath)
  );
}
