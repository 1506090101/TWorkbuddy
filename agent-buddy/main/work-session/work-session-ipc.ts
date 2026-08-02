import { dialog, ipcMain, type BrowserWindow } from "electron";
import { basename } from "path";
import type {
  GoalInput,
  WorkSessionBranchInput,
  WorkSessionCreateInput,
  WorkSessionProject,
} from "@shared/types";
import { getAgentDefinitionManager } from "../agent/agent-definition-manager";
import { getWorkSessionManager } from "./work-session-manager";

export function registerWorkSessionIpcHandlers(window: BrowserWindow): void {
  const manager = getWorkSessionManager();
  const unsubscribe = manager.subscribe((event) => {
    if (!window.isDestroyed())
      window.webContents.send("work-session:event", event);
  });
  window.once("closed", unsubscribe);

  ipcMain.handle(
    "work-session:create",
    (_event, input?: WorkSessionCreateInput) => {
      if (input?.agentId) getAgentDefinitionManager().get(input.agentId);
      return manager.create(input);
    }
  );
  ipcMain.handle("work-session:list", () => manager.list());
  ipcMain.handle(
    "work-session:create-branch",
    (_event, input: WorkSessionBranchInput) => {
      if (input.agentId) getAgentDefinitionManager().get(input.agentId);
      return manager.createBranch(input);
    }
  );
  ipcMain.handle(
    "work-session:update-branch-summary",
    (_event, sessionId: string, contextSummary: string) =>
      manager.updateBranchSummary(sessionId, contextSummary)
  );
  ipcMain.handle("work-session:merge-branch", (_event, sessionId: string) =>
    manager.mergeBranch(sessionId)
  );
  ipcMain.handle("work-session:discard-branch", (_event, sessionId: string) =>
    manager.discardBranch(sessionId)
  );
  ipcMain.handle("work-session:get", (_event, sessionId: string) =>
    manager.get(sessionId)
  );
  ipcMain.handle("work-session:open", (_event, sessionId: string) =>
    manager.open(sessionId)
  );
  ipcMain.handle("work-session:recover", () => manager.recover());
  ipcMain.handle(
    "work-session:rename",
    (_event, sessionId: string, title: string) =>
      manager.rename(sessionId, title)
  );
  ipcMain.handle("work-session:archive", (_event, sessionId: string) =>
    manager.archive(sessionId)
  );
  ipcMain.handle(
    "work-session:update-goal",
    (_event, sessionId: string, goal?: GoalInput) =>
      manager.updateGoal(sessionId, goal)
  );
  ipcMain.handle("work-session:stop-goal", (_event, sessionId: string) =>
    manager.stopGoal(sessionId)
  );
  ipcMain.handle("work-session:replan-goal", (_event, sessionId: string) =>
    manager.replanGoal(sessionId)
  );
  ipcMain.handle("work-session:choose-project", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "选择项目目录",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const rootPath = result.filePaths[0];
    const project: WorkSessionProject = {
      rootPath,
      name: basename(rootPath),
    };
    return project;
  });
  ipcMain.handle(
    "work-session:update-project",
    (_event, sessionId: string, project?: WorkSessionProject) =>
      manager.updateProject(sessionId, project)
  );
  ipcMain.handle(
    "work-session:update-agent",
    (_event, sessionId: string, agentId: string) => {
      const agent = getAgentDefinitionManager().get(agentId);
      return manager.updateAgent(sessionId, agent.id, agent.name);
    }
  );
}
