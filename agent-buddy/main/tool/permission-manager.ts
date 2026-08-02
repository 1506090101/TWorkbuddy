import { randomUUID } from "crypto";
import type { BrowserWindow } from "electron";
import type {
  PermissionAction,
  PermissionDecision,
  PermissionLevel,
  PermissionRequest,
} from "@shared/types";
import { getWorkSessionManager } from "../work-session/work-session-manager";

interface PermissionInput {
  sessionId: string;
  toolName: string;
  toolLabel: string;
  permission: PermissionLevel;
  params?: Record<string, unknown>;
  impact: string;
  category: string;
}

interface PendingPermission {
  request: PermissionRequest;
  resolve: (action: PermissionAction) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const PERMISSION_TIMEOUT_MS = 30_000;

export class PermissionManager {
  private readonly pending = new Map<string, PendingPermission>();
  private readonly allowedCategories = new Map<string, Set<string>>();

  async request(
    window: BrowserWindow,
    input: PermissionInput
  ): Promise<PermissionAction> {
    const category = input.category.trim().slice(0, 120);
    if (
      input.permission === "auto" ||
      this.allowedCategories.get(input.sessionId)?.has(category)
    ) {
      return "allow";
    }

    const request: PermissionRequest = {
      id: `permission_${randomUUID()}`,
      sessionId: input.sessionId,
      toolName: input.toolName.trim().slice(0, 120),
      toolLabel: input.toolLabel.trim().slice(0, 120),
      permission: input.permission,
      params: sanitizeParams(input.params),
      impact: input.impact.trim().slice(0, 2_000),
      category,
      timestamp: Date.now(),
    };
    getWorkSessionManager().recordPermissionRequest(request);

    return new Promise<PermissionAction>((resolve) => {
      const timeout = setTimeout(() => {
        getWorkSessionManager().recordPermissionDecision(request, {
          requestId: request.id,
          action: "deny",
          category: request.category,
        });
        this.finish(request.id, "deny");
      }, PERMISSION_TIMEOUT_MS);
      this.pending.set(request.id, { request, resolve, timeout });
      if (window.isDestroyed()) {
        this.finish(request.id, "deny");
        return;
      }
      window.webContents.send("tool:permission-request", request);
    });
  }

  respond(decision: PermissionDecision): void {
    const pending = this.pending.get(decision.requestId);
    if (!pending) throw new Error("PERMISSION_REQUEST_NOT_FOUND");
    if (decision.action === "allow_always") {
      const category = decision.category ?? pending.request.category;
      const categories =
        this.allowedCategories.get(pending.request.sessionId) ??
        new Set<string>();
      categories.add(category);
      this.allowedCategories.set(pending.request.sessionId, categories);
    }
    getWorkSessionManager().recordPermissionDecision(pending.request, decision);
    this.finish(decision.requestId, decision.action);
  }

  clearSession(sessionId: string): void {
    this.allowedCategories.delete(sessionId);
    this.cancelPending(sessionId);
  }

  cancelPending(sessionId: string): void {
    for (const [requestId, pending] of this.pending) {
      if (pending.request.sessionId === sessionId) {
        getWorkSessionManager().recordPermissionDecision(pending.request, {
          requestId,
          action: "deny",
          category: pending.request.category,
        });
        this.finish(requestId, "deny");
      }
    }
  }

  private finish(requestId: string, action: PermissionAction): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(requestId);
    pending.resolve(action);
  }
}

function sanitizeParams(
  params?: Record<string, unknown>
): Record<string, unknown> {
  if (!params) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params).slice(0, 32)) {
    if (/api.?key|authorization|password|secret|token/i.test(key)) continue;
    if (typeof value === "string") result[key] = value.slice(0, 500);
    else if (typeof value === "number" || typeof value === "boolean")
      result[key] = value;
    else if (value === null) result[key] = null;
  }
  return result;
}

let manager: PermissionManager | undefined;

export function getPermissionManager(): PermissionManager {
  manager ??= new PermissionManager();
  return manager;
}
