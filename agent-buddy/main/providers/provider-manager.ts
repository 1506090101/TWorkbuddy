import { randomUUID } from "crypto";
import { app, ipcMain, safeStorage } from "electron";
import Store from "electron-store";
import { join } from "path";
import type {
  ContentBlock,
  ModelInfo,
  ProviderConfig,
  ProviderConnectionResult,
  ProviderCreateInput,
  ProviderImportInput,
  ProviderStatus,
  ProviderType,
  ProviderUpdateInput,
} from "@shared/types";

interface ProviderStoreData {
  providers: ProviderConfig[];
  version: number;
}

export interface ProviderChatMessage {
  role: "system" | "user" | "assistant";
  content: ContentBlock[];
}

export interface ProviderChatRequest {
  url: string;
  init: RequestInit;
}

const PROVIDER_BASE_URLS: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  mistral: "https://api.mistral.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "",
};

const DEFAULT_TEST_MODELS: Record<ProviderType, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  deepseek: "deepseek-chat",
  gemini: "gemini-1.5-flash",
  mistral: "mistral-small-latest",
  openrouter: "openai/gpt-4o-mini",
  custom: "gpt-4o-mini",
};

export class ProviderManager {
  private readonly store: Store<ProviderStoreData>;
  private readonly providers = new Map<string, ProviderConfig>();

  constructor() {
    this.store = new Store<ProviderStoreData>({
      cwd: join(app.getPath("home"), ".agentbuddy", "config"),
      name: "providers",
      defaults: { providers: [], version: 1 },
      encryptionKey: "agent-buddy-providers",
    });
    this.loadProviders();
  }

  list(): ProviderConfig[] {
    return [...this.providers.values()].map((provider) =>
      this.toPublicConfig(provider)
    );
  }

  create(input: ProviderCreateInput): ProviderConfig {
    const config = this.createRuntimeConfig(input);
    this.providers.set(config.id, config);
    this.persist();
    return this.toPublicConfig(config);
  }

  update(id: string, changes: ProviderUpdateInput): ProviderConfig {
    const existing = this.getProvider(id);
    const apiKey = changes.apiKey?.trim() || existing.apiKey;
    const updated: ProviderConfig = {
      ...existing,
      ...changes,
      apiKey,
      baseURL: this.normalizeBaseURL(changes.baseURL ?? existing.baseURL),
      models: changes.models
        ? this.normalizeModels(changes.models)
        : existing.models,
      updatedAt: Date.now(),
    };

    this.validateProvider(updated);
    this.providers.set(id, updated);
    this.persist();
    return this.toPublicConfig(updated);
  }

  delete(id: string): void {
    this.getProvider(id);
    this.providers.delete(id);
    this.persist();
  }

  import(configs: ProviderImportInput[]): ProviderConfig[] {
    const imported = configs.map((config) => {
      const runtimeConfig = this.createRuntimeConfig(config, config.id);
      this.providers.set(runtimeConfig.id, runtimeConfig);
      return this.toPublicConfig(runtimeConfig);
    });
    this.persist();
    return imported;
  }

  getModel(
    providerId: string,
    modelId: string
  ): {
    modelId: string;
    envVars: Record<string, string>;
  } {
    const provider = this.getProvider(providerId);
    const envVars: Record<string, string> = {};
    const apiKeyVariables: Record<ProviderType, string> = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      gemini: "GEMINI_API_KEY",
      mistral: "MISTRAL_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      custom: "OPENAI_API_KEY",
    };

    envVars[apiKeyVariables[provider.type]] = provider.apiKey;
    if (provider.baseURL) {
      const baseURLVariables: Record<ProviderType, string> = {
        openai: "OPENAI_BASE_URL",
        anthropic: "ANTHROPIC_BASE_URL",
        deepseek: "DEEPSEEK_BASE_URL",
        gemini: "GEMINI_BASE_URL",
        mistral: "MISTRAL_BASE_URL",
        openrouter: "OPENROUTER_BASE_URL",
        custom: "OPENAI_BASE_URL",
      };
      envVars[baseURLVariables[provider.type]] = provider.baseURL;
    }

    return { modelId, envVars };
  }

  getChatRequest(
    providerId: string,
    modelId: string,
    messages: ProviderChatMessage[],
    systemPrompt: string | undefined,
    signal: AbortSignal
  ): ProviderChatRequest {
    const provider = this.getProvider(providerId);
    const baseURL = this.getBaseURL(provider);
    const headers = this.getHeaders(provider);

    if (provider.type === "gemini") {
      const contents = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: toGeminiParts(message.content),
        }));
      const url = this.withGeminiKey(
        `${baseURL}/models/${modelId}:streamGenerateContent?alt=sse`,
        provider.apiKey
      );
      return {
        url,
        init: {
          method: "POST",
          headers,
          signal,
          body: JSON.stringify({
            contents,
            ...(systemPrompt
              ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
              : {}),
          }),
        },
      };
    }

    if (provider.type === "anthropic") {
      const userMessages = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: toAnthropicContent(message.content),
        }));
      return {
        url: `${baseURL}/messages`,
        init: {
          method: "POST",
          headers,
          signal,
          body: JSON.stringify({
            model: modelId,
            max_tokens: 4096,
            stream: true,
            messages: userMessages,
            ...(systemPrompt ? { system: systemPrompt } : {}),
          }),
        },
      };
    }

    return {
      url: `${baseURL}/chat/completions`,
      init: {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({
          model: modelId,
          stream: true,
          messages: messages.map((message) => ({
            role: message.role,
            content: toOpenAIContent(message.content),
          })),
          ...(systemPrompt ? { system: systemPrompt } : {}),
        }),
      },
    };
  }

  async detectModels(providerId: string): Promise<ModelInfo[]> {
    const provider = this.getProvider(providerId);
    const url = this.getModelsURL(provider);
    const response = await this.fetchWithTimeout(url, {
      headers: this.getHeaders(provider),
    });

    if (!response.ok) {
      throw new Error(
        `模型探测失败：${response.status} ${response.statusText}`
      );
    }

    const data: unknown = await response.json();
    return this.normalizeModels(this.parseModelList(data));
  }

  async testConnection(providerId: string): Promise<ProviderConnectionResult> {
    const provider = this.getProvider(providerId);
    const startedAt = Date.now();

    try {
      const response = await this.fetchWithTimeout(
        this.getTestURL(provider),
        this.getTestRequest(provider)
      );
      const duration = Date.now() - startedAt;
      const result: ProviderConnectionResult = response.ok
        ? { success: true, duration, message: `连接成功（${duration}ms）` }
        : {
            success: false,
            duration,
            message: `连接失败：${response.status} ${response.statusText}`,
          };
      this.updateConnectionStatus(provider, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startedAt;
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "连接超时（10 秒）"
          : `连接失败：${this.getErrorMessage(error)}`;
      const result = { success: false, duration, message };
      this.updateConnectionStatus(provider, result);
      return result;
    }
  }

  private loadProviders(): void {
    for (const saved of this.store.get("providers")) {
      if (!saved.id || !saved.apiKey) continue;

      const provider: ProviderConfig = {
        ...saved,
        apiKey: this.decryptApiKey(saved.apiKey),
        baseURL: this.normalizeBaseURL(saved.baseURL),
        models: this.normalizeModels(saved.models ?? []),
      };
      this.providers.set(provider.id, provider);
    }
  }

  private persist(): void {
    const encryptedProviders = [...this.providers.values()].map((provider) => ({
      ...provider,
      apiKey: this.encryptApiKey(provider.apiKey),
    }));
    this.store.set("providers", encryptedProviders);
  }

  private createRuntimeConfig(
    input: ProviderCreateInput,
    preferredId?: string
  ): ProviderConfig {
    const now = Date.now();
    const config: ProviderConfig = {
      id:
        preferredId && !this.providers.has(preferredId)
          ? preferredId
          : `provider_${randomUUID()}`,
      name: input.name.trim(),
      type: input.type,
      apiKey: input.apiKey.trim(),
      baseURL: this.normalizeBaseURL(input.baseURL),
      models: this.normalizeModels(input.models),
      status: "untested",
      createdAt: now,
      updatedAt: now,
    };
    this.validateProvider(config);
    return config;
  }

  private validateProvider(provider: ProviderConfig): void {
    if (!provider.name) throw new Error("Provider 名称不能为空");
    if (!provider.apiKey) throw new Error("API Key 不能为空");
    if (provider.type === "custom" && !provider.baseURL) {
      throw new Error("Custom Provider 必须填写 Base URL");
    }
  }

  private normalizeModels(models: ModelInfo[]): ModelInfo[] {
    const modelIds = new Set<string>();
    return models.reduce<ModelInfo[]>((result, model) => {
      const id = model.id?.trim();
      if (!id || modelIds.has(id)) return result;

      modelIds.add(id);
      result.push({
        id,
        name: model.name?.trim() || id,
        contextWindow: model.contextWindow,
        supportsVision: model.supportsVision ?? false,
        supportsStreaming: model.supportsStreaming ?? true,
        description: model.description?.trim() || undefined,
      });
      return result;
    }, []);
  }

  private toPublicConfig(provider: ProviderConfig): ProviderConfig {
    return {
      ...provider,
      apiKey: provider.apiKey ? "••••••••" : "",
      models: provider.models.map((model) => ({ ...model })),
    };
  }

  private getProvider(id: string): ProviderConfig {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Provider “${id}” 不存在`);
    return provider;
  }

  private encryptApiKey(apiKey: string): string {
    if (!safeStorage.isEncryptionAvailable()) return apiKey;
    return safeStorage.encryptString(apiKey).toString("base64");
  }

  private decryptApiKey(apiKey: string): string {
    if (!safeStorage.isEncryptionAvailable()) return apiKey;
    try {
      return safeStorage.decryptString(Buffer.from(apiKey, "base64"));
    } catch {
      // Supports legacy values written before native encryption was available.
      return apiKey;
    }
  }

  private normalizeBaseURL(baseURL?: string): string | undefined {
    const normalized = baseURL?.trim().replace(/\/+$/, "");
    return normalized || undefined;
  }

  private getBaseURL(provider: ProviderConfig): string {
    const baseURL = provider.baseURL || PROVIDER_BASE_URLS[provider.type];
    if (!baseURL) throw new Error("Provider 缺少 Base URL");
    return baseURL;
  }

  private getHeaders(provider: ProviderConfig): Record<string, string> {
    if (provider.type === "gemini")
      return { "Content-Type": "application/json" };
    if (provider.type === "anthropic") {
      return {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      };
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    };
  }

  private getModelsURL(provider: ProviderConfig): string {
    const url = `${this.getBaseURL(provider)}/models`;
    return provider.type === "gemini"
      ? this.withGeminiKey(url, provider.apiKey)
      : url;
  }

  private getTestURL(provider: ProviderConfig): string {
    const modelId =
      provider.models[0]?.id || DEFAULT_TEST_MODELS[provider.type];
    const baseURL = this.getBaseURL(provider);
    if (provider.type === "gemini") {
      return this.withGeminiKey(
        `${baseURL}/models/${modelId}:generateContent`,
        provider.apiKey
      );
    }
    return provider.type === "anthropic"
      ? `${baseURL}/messages`
      : `${baseURL}/chat/completions`;
  }

  private getTestRequest(provider: ProviderConfig): RequestInit {
    const modelId =
      provider.models[0]?.id || DEFAULT_TEST_MODELS[provider.type];
    if (provider.type === "gemini") {
      return {
        method: "POST",
        headers: this.getHeaders(provider),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      };
    }
    if (provider.type === "anthropic") {
      return {
        method: "POST",
        headers: this.getHeaders(provider),
        body: JSON.stringify({
          model: modelId,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      };
    }
    return {
      method: "POST",
      headers: this.getHeaders(provider),
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    };
  }

  private parseModelList(data: unknown): ModelInfo[] {
    const response = data as {
      data?: unknown[];
      models?: unknown[];
    };
    const rawModels = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.models)
        ? response.models
        : Array.isArray(data)
          ? data
          : [];

    return rawModels.flatMap((rawModel) => {
      if (!rawModel || typeof rawModel !== "object") return [];
      const model = rawModel as Record<string, unknown>;
      const rawId = typeof model.id === "string" ? model.id : model.name;
      if (typeof rawId !== "string") return [];

      const id = rawId.replace(/^models\//, "");
      return [
        {
          id,
          name:
            (typeof model.display_name === "string" && model.display_name) ||
            (typeof model.displayName === "string" && model.displayName) ||
            id,
          contextWindow:
            typeof model.context_window === "number"
              ? model.context_window
              : typeof model.contextWindow === "number"
                ? model.contextWindow
                : undefined,
          supportsVision:
            model.supports_vision === true ||
            model.supportsVision === true ||
            /vision|image|gemini/i.test(id),
          supportsStreaming:
            typeof model.supports_streaming === "boolean"
              ? model.supports_streaming
              : typeof model.supportsStreaming === "boolean"
                ? model.supportsStreaming
                : true,
          description:
            typeof model.description === "string"
              ? model.description
              : undefined,
        },
      ];
    });
  }

  private async fetchWithTimeout(
    input: string,
    init: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private withGeminiKey(url: string, apiKey: string): string {
    const parsedURL = new URL(url);
    parsedURL.searchParams.set("key", apiKey);
    return parsedURL.toString();
  }

  private updateConnectionStatus(
    provider: ProviderConfig,
    result: ProviderConnectionResult
  ): void {
    const status: ProviderStatus = result.success ? "connected" : "error";
    this.providers.set(provider.id, {
      ...provider,
      status,
      statusMessage: result.message,
      updatedAt: Date.now(),
    });
    this.persist();
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "发生未知错误";
  }
}

function toOpenAIContent(
  blocks: ContentBlock[]
): string | Array<Record<string, unknown>> {
  if (blocks.length === 1 && blocks[0]?.type === "text") {
    return blocks[0].text;
  }
  return blocks.map((block) =>
    block.type === "text"
      ? { type: "text", text: block.text }
      : {
          type: "image_url",
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        }
  );
}

function toAnthropicContent(
  blocks: ContentBlock[]
): Array<Record<string, unknown>> {
  return blocks.map((block) =>
    block.type === "text"
      ? { type: "text", text: block.text }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: block.source.media_type,
            data: block.source.data,
          },
        }
  );
}

function toGeminiParts(blocks: ContentBlock[]): Array<Record<string, unknown>> {
  return blocks.map((block) =>
    block.type === "text"
      ? { text: block.text }
      : {
          inlineData: {
            mimeType: block.source.media_type,
            data: block.source.data,
          },
        }
  );
}

let providerManager: ProviderManager | undefined;

export function getProviderManager(): ProviderManager {
  providerManager ??= new ProviderManager();
  return providerManager;
}

export function registerProviderIpcHandlers(): void {
  const manager = getProviderManager();

  ipcMain.handle("provider:list", () => manager.list());
  ipcMain.handle("provider:create", (_event, config: ProviderCreateInput) =>
    manager.create(config)
  );
  ipcMain.handle(
    "provider:update",
    (_event, id: string, changes: ProviderUpdateInput) =>
      manager.update(id, changes)
  );
  ipcMain.handle("provider:delete", (_event, id: string) => manager.delete(id));
  ipcMain.handle("provider:detect-models", (_event, id: string) =>
    manager.detectModels(id)
  );
  ipcMain.handle("provider:test-connection", (_event, id: string) =>
    manager.testConnection(id)
  );
  ipcMain.handle("provider:import", (_event, configs: ProviderImportInput[]) =>
    manager.import(configs)
  );
}
