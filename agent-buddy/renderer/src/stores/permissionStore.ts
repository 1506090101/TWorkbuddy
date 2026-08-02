import { create } from "zustand";
import type { PermissionDecision, PermissionRequest } from "@shared/types";

interface PermissionState {
  request: PermissionRequest | null;
  error: string | null;
  setRequest: (request: PermissionRequest) => void;
  respond: (action: PermissionDecision["action"]) => Promise<void>;
  clear: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  request: null,
  error: null,
  setRequest: (request) => set({ request, error: null }),
  respond: async (action) => {
    const request = get().request;
    if (!request) return;
    const result = await window.electronAPI.respondToPermission({
      requestId: request.id,
      action,
      category: request.category,
    });
    if (result.success) set({ request: null, error: null });
    else set({ error: result.error ?? "权限决定失败" });
  },
  clear: () => set({ request: null, error: null }),
}));
