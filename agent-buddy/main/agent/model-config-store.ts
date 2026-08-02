import { app } from "electron";
import Store from "electron-store";
import { join } from "path";
import type {
  ModelAssignment,
  ModelRef,
  ProviderConfig,
  RoutingDecision,
} from "@shared/types";
import { getProviderManager } from "../providers/provider-manager";
import { routeModel } from "./model-router";

interface ModelAssignmentStoreData {
  assignments: Record<string, ModelAssignment>;
  version: number;
}

export const DEFAULT_MODEL_ASSIGNMENT: ModelAssignment = {
  chat: { providerId: "", modelId: "" },
  vision: undefined,
  thinkingLevel: "off",
  autoSwitchOnImage: true,
  fallbackToChatForImages: false,
  retryOnProviderError: true,
};

export class ModelConfigStore {
  private readonly store: Store<ModelAssignmentStoreData>;
  private assignments: Record<string, ModelAssignment>;

  constructor() {
    this.store = new Store<ModelAssignmentStoreData>({
      cwd: join(app.getPath("home"), ".agentbuddy", "config"),
      name: "model-assignments",
      defaults: { assignments: {}, version: 1 },
    });
    this.assignments = this.store.get("assignments");
  }

  getAssignments(): Record<string, ModelAssignment> {
    const result: Record<string, ModelAssignment> = {};
    for (const [agentId, assignment] of Object.entries(this.assignments)) {
      result[agentId] = this.syncAssignment(assignment);
    }
    const changed = JSON.stringify(this.assignments) !== JSON.stringify(result);
    this.assignments = result;
    if (changed) this.persist();
    return cloneAssignments(result);
  }

  getAssignment(agentId: string): ModelAssignment {
    if (!agentId.trim()) throw new Error("Agent ID 不能为空");
    const existing = this.assignments[agentId];
    const assignment = this.syncAssignment(
      existing ?? this.defaultForProviders(getProviderManager().list())
    );
    this.assignments[agentId] = assignment;
    if (JSON.stringify(existing) !== JSON.stringify(assignment)) this.persist();
    return cloneAssignment(assignment);
  }

  saveAssignment(
    agentId: string,
    assignment: ModelAssignment
  ): ModelAssignment {
    if (!agentId.trim()) throw new Error("Agent ID 不能为空");
    const synced = this.syncAssignment(assignment);
    if (!synced.chat.providerId || !synced.chat.modelId) {
      throw new Error("请先配置 Chat Model");
    }
    this.assignments[agentId] = synced;
    this.persist();
    return cloneAssignment(synced);
  }

  resetAssignment(agentId: string): ModelAssignment {
    if (!agentId.trim()) throw new Error("Agent ID 不能为空");
    const assignment = this.defaultForProviders(getProviderManager().list());
    this.assignments[agentId] = assignment;
    this.persist();
    return cloneAssignment(assignment);
  }

  getActiveModel(agentId: string, hasImages: boolean): RoutingDecision {
    return routeModel([], this.getAssignment(agentId), hasImages);
  }

  private persist(): void {
    this.store.set("assignments", this.assignments);
  }

  private syncAssignment(
    assignment?: Partial<ModelAssignment>
  ): ModelAssignment {
    const providers = getProviderManager().list();
    const chat = this.resolveModel(assignment?.chat, providers);
    const vision = assignment?.vision
      ? this.resolveModel(assignment.vision, providers)
      : undefined;
    const thinkingLevel: ModelAssignment["thinkingLevel"] = [
      "off",
      "low",
      "medium",
      "high",
    ].includes(assignment?.thinkingLevel ?? "")
      ? (assignment?.thinkingLevel ?? "off")
      : "off";

    return {
      chat: chat ?? { providerId: "", modelId: "" },
      vision,
      thinkingLevel,
      autoSwitchOnImage:
        typeof assignment?.autoSwitchOnImage === "boolean"
          ? assignment.autoSwitchOnImage
          : true,
      fallbackToChatForImages:
        typeof assignment?.fallbackToChatForImages === "boolean"
          ? assignment.fallbackToChatForImages
          : false,
      retryOnProviderError:
        typeof assignment?.retryOnProviderError === "boolean"
          ? assignment.retryOnProviderError
          : true,
    };
  }

  private defaultForProviders(providers: ProviderConfig[]): ModelAssignment {
    const provider = providers.find((item) => item.status !== "error");
    const model = provider?.models[0];
    return {
      ...DEFAULT_MODEL_ASSIGNMENT,
      chat:
        provider && model
          ? { providerId: provider.id, modelId: model.id }
          : { providerId: "", modelId: "" },
    };
  }

  private resolveModel(
    model: ModelRef | undefined,
    providers: ProviderConfig[]
  ): ModelRef | undefined {
    if (!model?.providerId || !model.modelId) return undefined;
    const provider = providers.find(
      (item) => item.id === model.providerId && item.status !== "error"
    );
    if (!provider?.models.some((item) => item.id === model.modelId)) {
      return undefined;
    }
    return { providerId: model.providerId, modelId: model.modelId };
  }
}

let modelConfigStore: ModelConfigStore | undefined;

export function getModelConfigStore(): ModelConfigStore {
  modelConfigStore ??= new ModelConfigStore();
  return modelConfigStore;
}

function cloneAssignment(assignment: ModelAssignment): ModelAssignment {
  return {
    ...assignment,
    chat: { ...assignment.chat },
    vision: assignment.vision ? { ...assignment.vision } : undefined,
  };
}

function cloneAssignments(
  assignments: Record<string, ModelAssignment>
): Record<string, ModelAssignment> {
  return Object.fromEntries(
    Object.entries(assignments).map(([agentId, assignment]) => [
      agentId,
      cloneAssignment(assignment),
    ])
  );
}
