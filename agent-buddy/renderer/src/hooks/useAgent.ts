import { useCallback, useEffect } from "react";
import type { AgentEvent, ContentBlock, ImageAttachment } from "@shared/types";
import { useChatStore } from "@stores/chatStore";

export function useAgent() {
  const setAgentStatus = useChatStore((state) => state.setAgentStatus);
  const appendToken = useChatStore((state) => state.appendToken);
  const completeTurn = useChatStore((state) => state.completeTurn);
  const abortTurn = useChatStore((state) => state.abortTurn);
  const setError = useChatStore((state) => state.setError);
  const setSessionId = useChatStore((state) => state.setSessionId);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.getState();
      setAgentStatus(status);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [setAgentStatus, setError]);

  useEffect(() => {
    const handleEvent = (event: AgentEvent) => {
      if (event.sessionId) setSessionId(event.sessionId);
      switch (event.type) {
        case "session_ready":
        case "model_changed":
          void refreshStatus();
          break;
        case "token":
          if (typeof event.data === "string") appendToken(event.data);
          break;
        case "completed":
          completeTurn();
          void refreshStatus();
          break;
        case "aborted":
          abortTurn();
          void refreshStatus();
          break;
        case "error":
          setError(event.error ?? "Agent 运行失败");
          void refreshStatus();
          break;
        default:
          break;
      }
    };

    const unsubscribe = window.electronAPI.onAgentEvent(handleEvent);
    void refreshStatus();
    window.addEventListener("focus", refreshStatus);
    return () => {
      unsubscribe?.();
      window.removeEventListener("focus", refreshStatus);
    };
  }, [
    abortTurn,
    appendToken,
    completeTurn,
    refreshStatus,
    setError,
    setSessionId,
  ]);

  const sendMessage = useCallback(
    async (content: string, images: ImageAttachment[] = []) => {
      const message = content.trim();
      const state = useChatStore.getState();
      if ((!message && images.length === 0) || state.status === "generating")
        return;

      const blocks: ContentBlock[] = [];
      if (message) blocks.push({ type: "text", text: message });
      blocks.push(
        ...images.map((image) => ({
          type: "image" as const,
          source: { data: image.data, media_type: image.mimeType },
        }))
      );
      state.beginTurn(message, images);
      const result = await window.electronAPI.prompt({
        agentId: "default",
        message: { role: "user", content: blocks },
      });
      if (!result.success || !result.data) {
        state.setError(result.error ?? "Agent 运行失败");
        return;
      }
      state.setSessionId(result.data.sessionId);
    },
    []
  );

  const abort = useCallback(async () => {
    const sessionId = useChatStore.getState().sessionId;
    await window.electronAPI.abort(sessionId);
  }, []);

  return { refreshStatus, sendMessage, abort };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Agent 状态读取失败";
}
