import { create } from "zustand";
import type {
  ModelInfo,
  ProviderConfig,
  ProviderConnectionResult,
  ProviderCreateInput,
  ProviderUpdateInput,
} from "@shared/types";

interface ProviderState {
  providers: ProviderConfig[];
  isLoading: boolean;
  error: string | null;
  loadProviders: () => Promise<void>;
  createProvider: (input: ProviderCreateInput) => Promise<ProviderConfig>;
  updateProvider: (
    id: string,
    changes: ProviderUpdateInput
  ) => Promise<ProviderConfig>;
  deleteProvider: (id: string) => Promise<void>;
  detectModels: (id: string) => Promise<ModelInfo[]>;
  testProvider: (id: string) => Promise<ProviderConnectionResult>;
}

function getProviderAPI() {
  if (!window.electronAPI) {
    throw new Error("Provider 服务仅能在桌面应用中使用");
  }
  return window.electronAPI;
}

export const useProviderStore = create<ProviderState>((set) => ({
  providers: [],
  isLoading: false,
  error: null,

  loadProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const providers = await getProviderAPI().listProviders();
      set({ providers });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  createProvider: async (input) => {
    try {
      const provider = await getProviderAPI().createProvider(input);
      set((state) => ({
        providers: [...state.providers, provider],
        error: null,
      }));
      return provider;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ error: message });
      throw new Error(message);
    }
  },

  updateProvider: async (id, changes) => {
    try {
      const provider = await getProviderAPI().updateProvider(id, changes);
      set((state) => ({
        providers: state.providers.map((item) =>
          item.id === id ? provider : item
        ),
        error: null,
      }));
      return provider;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ error: message });
      throw new Error(message);
    }
  },

  deleteProvider: async (id) => {
    try {
      await getProviderAPI().deleteProvider(id);
      set((state) => ({
        providers: state.providers.filter((provider) => provider.id !== id),
        error: null,
      }));
    } catch (error) {
      const message = getErrorMessage(error);
      set({ error: message });
      throw new Error(message);
    }
  },

  detectModels: async (id) => {
    try {
      const models = await getProviderAPI().detectModels(id);
      set({ error: null });
      return models;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ error: message });
      throw new Error(message);
    }
  },

  testProvider: async (id) => {
    try {
      const result = await getProviderAPI().testProvider(id);
      const providers = await getProviderAPI().listProviders();
      set({ providers, error: null });
      return result;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ error: message });
      throw new Error(message);
    }
  },
}));

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生未知错误";
}
