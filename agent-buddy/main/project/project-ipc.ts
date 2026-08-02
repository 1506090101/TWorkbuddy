import { ipcMain } from "electron";
import { getProjectDetector } from "./project-detector";

export function registerProjectIpcHandlers(): void {
  const detector = getProjectDetector();

  ipcMain.handle("project:detect", (_event, rootPath: string) =>
    detector.detect(rootPath)
  );
  ipcMain.handle("project:get-context", (_event, rootPath: string) =>
    detector.getCached(rootPath)
  );
  ipcMain.handle("project:refresh", (_event, rootPath: string) =>
    detector.detect(rootPath, true)
  );
}
