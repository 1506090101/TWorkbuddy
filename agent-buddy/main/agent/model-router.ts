import type {
  ContentBlock,
  ModelAssignment,
  RoutingDecision,
} from "@shared/types";

export function hasImageContent(blocks: ContentBlock[]): boolean {
  return blocks.some((block) => block.type === "image");
}

export function routeModel(
  messageBlocks: ContentBlock[],
  assignment: ModelAssignment,
  contextHasImages: boolean
): RoutingDecision {
  if (!assignment.chat.providerId || !assignment.chat.modelId) {
    throw new Error("请先配置 Chat Model");
  }
  const containsImages = hasImageContent(messageBlocks) || contextHasImages;

  if (!containsImages) {
    return {
      useModel: "chat",
      reason: "纯文本消息",
      modelAssignment: assignment.chat,
    };
  }

  if (!assignment.autoSwitchOnImage) {
    return {
      useModel: "chat",
      reason: "自动切换已禁用",
      modelAssignment: assignment.chat,
    };
  }

  if (assignment.vision?.providerId && assignment.vision.modelId) {
    return {
      useModel: "vision",
      reason: "消息含图片，切换至 Vision Model",
      modelAssignment: assignment.vision,
    };
  }

  if (assignment.fallbackToChatForImages) {
    return {
      useModel: "chat",
      reason: "未配置 Vision Model，回退至 Chat Model",
      modelAssignment: assignment.chat,
    };
  }

  throw new Error("请配置 Vision Model 后重试");
}
