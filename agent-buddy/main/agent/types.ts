import type {
  AgentThinkingLevel,
  ContentBlock,
  ProviderType,
} from "@shared/types";

export interface AgentSessionConfig {
  agentId: string;
  providerId: string;
  modelId: string;
  thinkingLevel: AgentThinkingLevel;
  systemPrompt?: string;
}

export interface AgentHistoryMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface AgentRuntimeSession {
  id: string;
  agentId: string;
  providerId: string;
  providerType: ProviderType;
  modelId: string;
  thinkingLevel: AgentThinkingLevel;
  systemPrompt?: string;
  history: AgentHistoryMessage[];
  steerInstruction?: string;
  abortController: AbortController | null;
  isGenerating: boolean;
}
