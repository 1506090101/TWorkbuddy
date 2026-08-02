import { create } from "zustand";
import type { AgentStatus, ChatMessage, ImageAttachment } from "@shared/types";

type ChatStatus = "idle" | "generating" | "error";

interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
  sessionId?: string;
  hasProvider: boolean;
  providerId?: string;
  modelId?: string;
  currentAssistantId?: string;
  setAgentStatus: (status: AgentStatus) => void;
  beginTurn: (content: string, images?: ImageAttachment[]) => void;
  setSessionId: (sessionId: string) => void;
  appendToken: (token: string) => void;
  completeTurn: () => void;
  abortTurn: () => void;
  setError: (message: string) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  status: "idle",
  error: null,
  hasProvider: false,

  setAgentStatus: (status) =>
    set({
      hasProvider: status.hasProvider,
      sessionId: status.sessionId,
      providerId: status.providerId,
      modelId: status.modelId,
      status: status.isGenerating ? "generating" : "idle",
    }),

  beginTurn: (content, images = []) => {
    const now = Date.now();
    const assistantId = `assistant_${now}`;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `user_${now}`,
          role: "user",
          content,
          images: images.length > 0 ? images : undefined,
          timestamp: now,
        },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: now,
          isStreaming: true,
        },
      ],
      currentAssistantId: assistantId,
      status: "generating",
      error: null,
    }));
  },

  setSessionId: (sessionId) => set({ sessionId }),

  appendToken: (token) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === state.currentAssistantId
          ? { ...message, content: message.content + token }
          : message
      ),
      status: "generating",
    })),

  completeTurn: () =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === state.currentAssistantId
          ? { ...message, isStreaming: false }
          : message
      ),
      currentAssistantId: undefined,
      status: "idle",
    })),

  abortTurn: () =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === state.currentAssistantId
          ? { ...message, isStreaming: false }
          : message
      ),
      currentAssistantId: undefined,
      status: "idle",
    })),

  setError: (message) =>
    set((state) => ({
      messages: state.messages.map((item) =>
        item.id === state.currentAssistantId
          ? { ...item, isStreaming: false, error: message }
          : item
      ),
      currentAssistantId: undefined,
      status: "error",
      error: message,
    })),

  clearError: () => set({ error: null }),
}));
