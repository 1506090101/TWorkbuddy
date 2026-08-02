import { ipcMain, type BrowserWindow } from "electron";
import type {
  AgentPromptRequest,
  AgentSessionInit,
  ComposerContext,
} from "@shared/types";
import { getProviderManager } from "../providers/provider-manager";
import { getAgentDefinitionManager } from "./agent-definition-manager";
import { getAgentSessionManager } from "./agent-session-manager";
import { getWorkSessionManager } from "../work-session/work-session-manager";

export function registerAgentIpcHandlers(window: BrowserWindow): void {
  const manager = getAgentSessionManager();
  const workSessions = getWorkSessionManager();
  const definitions = getAgentDefinitionManager();

  ipcMain.handle("agent:list", () => definitions.list());
  ipcMain.handle("agent:get-definition", (_event, agentId: string) =>
    definitions.get(agentId)
  );

  ipcMain.handle("agent:init", async (_event, config?: AgentSessionInit) => {
    const workSession = workSessions.create({ agentId: config?.agentId });
    try {
      const data = await manager.createSession(config, window, workSession.id);
      return { success: true, data };
    } catch (error) {
      workSessions.recordFailure(workSession.id, error);
      return toAgentError(error);
    }
  });

  ipcMain.handle(
    "agent:prompt",
    async (_event, request: AgentPromptRequest) => {
      let workSessionId: string | undefined;
      try {
        const context = normalizeComposerContext(request);
        const workSession = request.sessionId
          ? workSessions.get(request.sessionId)
          : workSessions.create({ agentId: context.agentId });
        workSessionId = workSession.id;
        workSessions.updateComposerContext(workSession.id, context);
        workSessions.recordUserTask(
          workSession.id,
          getPromptText(request),
          context
        );
        const sessionId = await manager.getOrCreateSession(
          workSession.id,
          context.agentId,
          window,
          {
            agentId: context.agentId,
            providerId: context.modelOverride?.providerId,
            modelId: context.modelOverride?.modelId,
            thinkingLevel:
              context.modelOverride?.thinkingLevel ?? context.thinkingLevel,
          }
        );
        manager.startPrompt(sessionId, { ...request, sessionId, context });
        return { success: true, data: { sessionId } };
      } catch (error) {
        if (workSessionId) workSessions.recordFailure(workSessionId, error);
        return toAgentError(error);
      }
    }
  );

  ipcMain.handle("agent:abort", (_event, sessionId?: string) => {
    manager.abort(sessionId);
    return { success: true };
  });

  ipcMain.handle("agent:steer", (_event, text: string, sessionId?: string) => {
    try {
      manager.steer(sessionId, text);
      return { success: true };
    } catch (error) {
      return toAgentError(error);
    }
  });

  ipcMain.handle(
    "agent:set-model",
    (_event, providerId: string, modelId: string, sessionId?: string) => {
      try {
        const activeSessionId = sessionId ?? manager.getStatus().sessionId;
        if (!activeSessionId) throw new Error("SESSION_NOT_FOUND");
        manager.setModel(activeSessionId, providerId, modelId);
        return { success: true };
      } catch (error) {
        return toAgentError(error);
      }
    }
  );

  ipcMain.handle("agent:get-status", () => manager.getStatus());
}

function normalizeComposerContext(
  request: AgentPromptRequest
): ComposerContext {
  const context: ComposerContext = {
    agentId: request.context?.agentId ?? request.agentId ?? "default",
    modelOverride: request.context?.modelOverride,
    thinkingLevel: request.context?.thinkingLevel,
    attachments: request.context?.attachments ?? [],
    pluginIds: request.context?.pluginIds ?? [],
    goalId: request.context?.goalId,
  };
  if (!Array.isArray(context.attachments) || context.attachments.length > 32) {
    throw new Error("附件数量超出限制");
  }
  for (const attachment of context.attachments) {
    if (
      !attachment.id ||
      !attachment.name ||
      !attachment.data ||
      !["image", "text", "code"].includes(attachment.kind)
    ) {
      throw new Error("附件信息无效");
    }
    if (attachment.kind === "image") {
      if (
        attachment.encoding !== "base64" ||
        attachment.size > 20 * 1024 * 1024
      ) {
        throw new Error(`图片附件超出限制：${attachment.name}`);
      }
      if (!/^image\/(png|jpeg|gif|webp)$/i.test(attachment.mimeType)) {
        throw new Error(`不支持的图片类型：${attachment.mimeType}`);
      }
    } else if (
      attachment.encoding !== "utf8" ||
      attachment.size > 2 * 1024 * 1024 ||
      attachment.data.includes("\u0000")
    ) {
      throw new Error(`文本附件无效或超出限制：${attachment.name}`);
    }
  }
  if (context.modelOverride) {
    const provider = getProviderManager()
      .list()
      .find((item) => item.id === context.modelOverride?.providerId);
    if (
      !provider?.models.some(
        (model) => model.id === context.modelOverride?.modelId
      )
    ) {
      throw new Error("当前会话选择的模型不可用，请重新选择");
    }
  }
  if (!getAgentDefinitionManager().has(context.agentId)) {
    throw new Error("当前 Agent 不可用，请重新选择");
  }
  return context;
}

function getPromptText(request: AgentPromptRequest): string {
  return request.message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function toAgentError(error: unknown) {
  const message = error instanceof Error ? error.message : "Agent 运行失败";
  if (message === "NO_PROVIDER_CONFIGURED") {
    return {
      success: false,
      error: "NO_PROVIDER",
      message: "请先配置至少一个 LLM Provider",
    };
  }
  return { success: false, error: message, message };
}
