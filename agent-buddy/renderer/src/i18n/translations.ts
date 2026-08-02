/**
 * Agent Buddy — i18n Translation Keys
 *
 * All UI-facing strings live here. Add new keys to BOTH locale objects.
 * Keep keys organized by feature/section (dot-notation grouping).
 */
import type { Locale } from "@shared/types";

// ============================================================
// Translation Key Type (auto-derived from zh-CN)
// ============================================================

export const zhCN = {
  // === App ===
  "app.name": "Agent Buddy",
  "app.tagline": "开发者专属的 AI 协作平台",

  // === TitleBar ===
  "titlebar.chat": "聊天",
  "titlebar.agents": "Agent",
  "titlebar.knowledge": "知识库",
  "titlebar.settings": "设置",
  "titlebar.minimize": "最小化",
  "titlebar.maximize": "最大化",
  "titlebar.close": "关闭",

  // === Sidebar ===
  "sidebar.newSession": "新建会话",
  "sidebar.collapse": "收起侧边栏",
  "sidebar.expand": "展开侧边栏",

  // === Welcome Screen ===
  "welcome.title": "Agent Buddy",
  "welcome.subtitle": "开发者专属的 AI 协作平台",
  "welcome.startChatting": "开始对话",
  "welcome.startChattingDesc": "配置 Provider 并开始对话",
  "welcome.settings": "设置",
  "welcome.settingsDesc": "管理模型、主题和快捷键",
  "welcome.knowledge": "知识库",
  "welcome.knowledgeDesc": "浏览你的个人知识库",
  "welcome.featureMultiProvider": "多 Provider",
  "welcome.featureVisionModel": "视觉模型",
  "welcome.featureMcpTools": "MCP 工具",
  "welcome.featureCodeGraph": "代码知识图谱",
  "welcome.featureGit": "Git 集成",
  "welcome.featureWorkflows": "工作流",

  // === Agent / Chat (F1.3) ===
  "agentGuide.title": "先配置一个 Provider",
  "agentGuide.description": "Agent 需要可用的 LLM Provider 才能开始对话。",
  "agentGuide.openSettings": "前往 Provider 设置",
  "chat.title": "Agent 对话",
  "chat.status.ready": "就绪",
  "chat.status.generating": "Agent 正在工作",
  "chat.emptyTitle": "准备开始协作",
  "chat.emptyDescription":
    "描述一个问题、目标或需要修改的代码，Agent 会在这里回应。",
  "chat.placeholder": "输入消息，Enter 发送，Shift+Enter 换行",
  "chat.stop": "停止生成",
  "chat.send": "发送",
  "chat.addImage": "添加图片",
  "chat.removeImage": "移除图片",
  "chat.agent": "Agent",
  "chat.thinking": "正在思考",
  "chat.copyCode": "复制代码",
  "chat.copied": "已复制",
  "chat.scrollToBottom": "滚到底部",
  "chat.inputHint": "当前会话保存在内存中，关闭应用后不会保留。",
  "vision.using": "图片将使用 Vision Model",
  "vision.fallback": "图片将使用 Chat Model（回退）",
  "vision.error": "未配置 Vision Model，图片暂时无法发送",
  "vision.openSettings": "前往模型设置",

  // === Settings Dialog ===
  "settings.title": "设置",
  "settings.tabs.providers": "Provider",
  "settings.tabs.models": "模型",
  "settings.tabs.appearance": "外观",
  "settings.tabs.shortcuts": "快捷键",

  // === Appearance Tab ===
  "appearance.theme": "主题",
  "appearance.themeLight": "浅色",
  "appearance.themeDark": "深色",
  "appearance.themeSystem": "跟随系统",
  "appearance.fontSize": "字号",
  "appearance.fontSizeHint": "调整整个应用的基础字号",
  "appearance.language": "语言",
  "appearance.languageHint": "切换界面语言，立即生效",
  "appearance.colorPreview": "调色板预览",
  "appearance.colorPrimary": "主色",
  "appearance.colorAccent": "强调色",
  "appearance.colorSuccess": "成功",
  "appearance.colorWarning": "警告",
  "appearance.colorDanger": "危险",
  "appearance.colorInfo": "信息",

  // === Settings — Providers Tab (stub) ===
  "providers.title": "Provider 管理",
  "providers.desc": "添加和配置 LLM Provider（OpenAI、Anthropic、DeepSeek 等）",
  "providers.comingSoon": "将在 Feature F1.7 中实现",
  "providers.add": "添加 Provider",
  "providers.empty.title": "还没有 Provider",
  "providers.empty.description": "添加一个 Provider 以开始配置模型",
  "providers.editor.emptyTitle": "选择一个 Provider",
  "providers.editor.emptyDescription":
    "从左侧选择配置，或创建一个新的 Provider",
  "providers.editor.createTitle": "创建 Provider",
  "providers.editor.editTitle": "编辑 Provider",
  "providers.editor.description": "连接信息仅在主进程中解密和使用",
  "providers.type": "Provider 类型",
  "providers.name": "显示名称",
  "providers.namePlaceholder": "例如：团队 OpenAI",
  "providers.apiKey": "API Key",
  "providers.apiKeyHint": "密钥会使用系统加密存储",
  "providers.apiKeyEditHint": "留空则保持现有密钥不变",
  "providers.showAPIKey": "显示 API Key",
  "providers.hideAPIKey": "隐藏 API Key",
  "providers.baseURL": "Base URL",
  "providers.baseURLHint": "留空则使用该 Provider 的官方地址",
  "providers.baseURLCustomHint": "Custom 类型必须填写 OpenAI 兼容地址",
  "providers.models": "模型列表",
  "providers.modelsHint": "可以手动维护，也可以保存后自动探测",
  "providers.addModel": "添加模型",
  "providers.modelId": "模型 ID",
  "providers.contextWindow": "上下文窗口",
  "providers.vision": "视觉",
  "providers.removeModel": "移除模型",
  "providers.detect": "自动探测模型",
  "providers.test": "测试连接",
  "providers.delete": "删除",
  "providers.create": "创建",
  "providers.save": "保存",
  "providers.status.connected": "已连接",
  "providers.status.untested": "未测试",
  "providers.status.error": "连接失败",
  "providers.validation.name": "名称不能为空",
  "providers.validation.apiKey": "API Key 不能为空",
  "providers.validation.baseURL": "Custom 类型必须填写 Base URL",
  "providers.deleteConfirm": "确定删除“{name}”吗？使用它的 Agent 可能会失效。",
  "providers.discardChanges": "有未保存的修改，确定放弃吗？",

  // === Settings — Models Tab (stub) ===
  "models.title": "模型分配",
  "models.desc": "为每个 Agent 分配聊天模型和视觉模型",
  "models.comingSoon": "将在 Feature F1.8 中实现",
  "models.agent": "Agent 配置",
  "models.defaultAgent": "默认 Agent",
  "models.provider": "Provider",
  "models.model": "Model",
  "models.chatModel": "Chat Model",
  "models.visionModel": "Vision Model",
  "models.visionDescription": "图片消息将优先使用视觉模型",
  "models.enableVision": "启用 Vision Model",
  "models.chooseProvider": "选择 Provider",
  "models.chooseModel": "选择模型",
  "models.visionFallbackHint": "未配置 Vision Model，图片将回退到 Chat Model。",
  "models.visionRequiredHint": "未配置 Vision Model，图片消息将被提示拦截。",
  "models.behavior": "图片行为",
  "models.autoSwitch": "图片自动切换",
  "models.autoSwitchDescription": "检测到图片时自动切换到 Vision Model",
  "models.fallback": "回退到 Chat Model",
  "models.fallbackDescription":
    "未配置 Vision Model 时仍使用 Chat Model 处理图片",
  "models.retry": "Provider 错误重试",
  "models.retryDescription": "Provider 返回临时错误时自动重试一次",
  "models.thinking": "Thinking Level",
  "models.thinking.off": "关闭",
  "models.thinking.low": "低",
  "models.thinking.medium": "中",
  "models.thinking.high": "高",
  "models.saveButton": "保存配置",
  "models.resetButton": "重置默认",
  "models.saved": "模型配置已保存",
  "models.reset": "已恢复默认配置",
  "models.saveError": "模型配置保存失败",
  "models.noProvidersTitle": "还没有可用 Provider",
  "models.noProvidersDescription":
    "先添加 Provider 和模型，才能配置 Agent 的模型分配。",
  "models.openProviders": "前往 Provider 设置",

  // === Settings — Shortcuts Tab ===
  "shortcuts.title": "键盘快捷键",
  "shortcuts.sendMessage": "发送消息",
  "shortcuts.newLine": "换行",
  "shortcuts.abortGeneration": "中止生成",
  "shortcuts.clearConversation": "清空对话",
  "shortcuts.focusSearch": "聚焦搜索",
  "shortcuts.commandPalette": "命令面板",
  "shortcuts.newSession": "新建会话",
  "shortcuts.switchSession": "切换会话/项目",
  "shortcuts.quickAgentSwitch": "快速切换 Agent",
  "shortcuts.acceptAllChanges": "接受所有变更",
  "shortcuts.rejectAllChanges": "拒绝所有变更",
  "shortcuts.rollbackCheckpoint": "回滚到 Checkpoint",
  "shortcuts.toggleDiffView": "切换 Diff 视图",
  "shortcuts.toggleInlineMode": "切换 Inline / 面板模式",

  // === Common ===
  "common.comingSoon": "即将推出",
} as const;

export const en = {
  // === App ===
  "app.name": "Agent Buddy",
  "app.tagline": "Developer-focused AI collaboration platform",

  // === TitleBar ===
  "titlebar.chat": "Chat",
  "titlebar.agents": "Agents",
  "titlebar.knowledge": "Knowledge",
  "titlebar.settings": "Settings",
  "titlebar.minimize": "Minimize",
  "titlebar.maximize": "Maximize",
  "titlebar.close": "Close",

  // === Sidebar ===
  "sidebar.newSession": "New Session",
  "sidebar.collapse": "Collapse sidebar",
  "sidebar.expand": "Expand sidebar",

  // === Welcome Screen ===
  "welcome.title": "Agent Buddy",
  "welcome.subtitle": "Developer-focused AI collaboration platform",
  "welcome.startChatting": "Start Chatting",
  "welcome.startChattingDesc": "Configure providers and start a conversation",
  "welcome.settings": "Settings",
  "welcome.settingsDesc": "Manage models, themes, and shortcuts",
  "welcome.knowledge": "Knowledge",
  "welcome.knowledgeDesc": "Browse your personal knowledge base",
  "welcome.featureMultiProvider": "Multi-Provider",
  "welcome.featureVisionModel": "Vision Model",
  "welcome.featureMcpTools": "MCP Tools",
  "welcome.featureCodeGraph": "Code Knowledge Graph",
  "welcome.featureGit": "Git Integration",
  "welcome.featureWorkflows": "Workflows",

  // === Agent / Chat (F1.3) ===
  "agentGuide.title": "Configure a provider first",
  "agentGuide.description":
    "An available LLM provider is required to start chatting.",
  "agentGuide.openSettings": "Open Provider Settings",
  "chat.title": "Agent Chat",
  "chat.status.ready": "Ready",
  "chat.status.generating": "Agent is working",
  "chat.emptyTitle": "Ready to collaborate",
  "chat.emptyDescription":
    "Describe a problem, goal, or code change and the Agent will respond here.",
  "chat.placeholder":
    "Write a message, Enter to send, Shift+Enter for a new line",
  "chat.stop": "Stop generation",
  "chat.send": "Send",
  "chat.addImage": "Add image",
  "chat.removeImage": "Remove image",
  "chat.agent": "Agent",
  "chat.thinking": "Thinking",
  "chat.copyCode": "Copy code",
  "chat.copied": "Copied",
  "chat.scrollToBottom": "Scroll to bottom",
  "chat.inputHint":
    "This session is kept in memory and will not survive app restart.",
  "vision.using": "Images will use the Vision Model",
  "vision.fallback": "Images will use the Chat Model (fallback)",
  "vision.error": "Configure a Vision Model before sending images",
  "vision.openSettings": "Open Model Settings",

  // === Settings Dialog ===
  "settings.title": "Settings",
  "settings.tabs.providers": "Providers",
  "settings.tabs.models": "Models",
  "settings.tabs.appearance": "Appearance",
  "settings.tabs.shortcuts": "Shortcuts",

  // === Appearance Tab ===
  "appearance.theme": "Theme",
  "appearance.themeLight": "Light",
  "appearance.themeDark": "Dark",
  "appearance.themeSystem": "System",
  "appearance.fontSize": "Font Size",
  "appearance.fontSizeHint":
    "Changes the base font size for the entire application",
  "appearance.language": "Language",
  "appearance.languageHint": "Switch the interface language, applies instantly",
  "appearance.colorPreview": "Color Palette Preview",
  "appearance.colorPrimary": "Primary",
  "appearance.colorAccent": "Accent",
  "appearance.colorSuccess": "Success",
  "appearance.colorWarning": "Warning",
  "appearance.colorDanger": "Danger",
  "appearance.colorInfo": "Info",

  // === Settings — Providers Tab (stub) ===
  "providers.title": "Provider Management",
  "providers.desc":
    "Add and configure LLM providers (OpenAI, Anthropic, DeepSeek, etc.)",
  "providers.comingSoon": "This will be implemented in Feature F1.7",
  "providers.add": "Add Provider",
  "providers.empty.title": "No providers yet",
  "providers.empty.description": "Add a provider to configure models",
  "providers.editor.emptyTitle": "Select a provider",
  "providers.editor.emptyDescription": "Choose a provider or create a new one",
  "providers.editor.createTitle": "Create Provider",
  "providers.editor.editTitle": "Edit Provider",
  "providers.editor.description":
    "Credentials are decrypted and used only in the main process",
  "providers.type": "Provider type",
  "providers.name": "Display name",
  "providers.namePlaceholder": "For example: Team OpenAI",
  "providers.apiKey": "API Key",
  "providers.apiKeyHint": "The key is encrypted using the operating system",
  "providers.apiKeyEditHint": "Leave empty to keep the current key",
  "providers.showAPIKey": "Show API Key",
  "providers.hideAPIKey": "Hide API Key",
  "providers.baseURL": "Base URL",
  "providers.baseURLHint": "Leave empty to use the official endpoint",
  "providers.baseURLCustomHint":
    "Custom providers require an OpenAI-compatible URL",
  "providers.models": "Models",
  "providers.modelsHint":
    "Maintain models manually or detect them after saving",
  "providers.addModel": "Add model",
  "providers.modelId": "Model ID",
  "providers.contextWindow": "Context window",
  "providers.vision": "Vision",
  "providers.removeModel": "Remove model",
  "providers.detect": "Auto-detect models",
  "providers.test": "Test connection",
  "providers.delete": "Delete",
  "providers.create": "Create",
  "providers.save": "Save",
  "providers.status.connected": "Connected",
  "providers.status.untested": "Untested",
  "providers.status.error": "Connection failed",
  "providers.validation.name": "Name is required",
  "providers.validation.apiKey": "API Key is required",
  "providers.validation.baseURL": "Custom providers require a Base URL",
  "providers.deleteConfirm":
    "Delete “{name}”? Agents using it may stop working.",
  "providers.discardChanges": "You have unsaved changes. Discard them?",

  // === Settings — Models Tab (stub) ===
  "models.title": "Model Assignment",
  "models.desc": "Assign Chat and Vision models for each Agent",
  "models.comingSoon": "This will be implemented in Feature F1.8",
  "models.agent": "Agent configuration",
  "models.defaultAgent": "Default Agent",
  "models.provider": "Provider",
  "models.model": "Model",
  "models.chatModel": "Chat Model",
  "models.visionModel": "Vision Model",
  "models.visionDescription": "Image messages will prefer the vision model",
  "models.enableVision": "Enable Vision Model",
  "models.chooseProvider": "Choose a provider",
  "models.chooseModel": "Choose a model",
  "models.visionFallbackHint":
    "Without a Vision Model, images fall back to the Chat Model.",
  "models.visionRequiredHint":
    "Without a Vision Model, image messages will be blocked.",
  "models.behavior": "Image behavior",
  "models.autoSwitch": "Auto-switch on image",
  "models.autoSwitchDescription":
    "Switch to the Vision Model when an image is detected",
  "models.fallback": "Fallback to Chat Model",
  "models.fallbackDescription":
    "Use the Chat Model for images when no Vision Model is configured",
  "models.retry": "Retry provider errors",
  "models.retryDescription": "Retry a transient provider error once",
  "models.thinking": "Thinking Level",
  "models.thinking.off": "Off",
  "models.thinking.low": "Low",
  "models.thinking.medium": "Medium",
  "models.thinking.high": "High",
  "models.saveButton": "Save configuration",
  "models.resetButton": "Reset default",
  "models.saved": "Model configuration saved",
  "models.reset": "Default configuration restored",
  "models.saveError": "Could not save model configuration",
  "models.noProvidersTitle": "No available providers",
  "models.noProvidersDescription":
    "Add a provider and model before assigning Agent models.",
  "models.openProviders": "Open Provider Settings",

  // === Settings — Shortcuts Tab ===
  "shortcuts.title": "Keyboard Shortcuts",
  "shortcuts.sendMessage": "Send message",
  "shortcuts.newLine": "New line",
  "shortcuts.abortGeneration": "Abort generation",
  "shortcuts.clearConversation": "Clear conversation",
  "shortcuts.focusSearch": "Focus search",
  "shortcuts.commandPalette": "Command Palette",
  "shortcuts.newSession": "New session",
  "shortcuts.switchSession": "Switch session/project",
  "shortcuts.quickAgentSwitch": "Quick agent switch",
  "shortcuts.acceptAllChanges": "Accept all changes",
  "shortcuts.rejectAllChanges": "Reject all changes",
  "shortcuts.rollbackCheckpoint": "Rollback to checkpoint",
  "shortcuts.toggleDiffView": "Toggle Diff view",
  "shortcuts.toggleInlineMode": "Toggle Inline / panel mode",

  // === Common ===
  "common.comingSoon": "Coming soon",
} as const;

// ============================================================
// Types
// ============================================================

export type TranslationKey = keyof typeof zhCN;
export type Translations = Record<TranslationKey, string>;

export const translations: Record<Locale, Translations> = {
  "zh-CN": zhCN as Translations,
  en: en as Translations,
};

export const SUPPORTED_LOCALES: Array<{
  value: Locale;
  label: string;
  flag: string;
}> = [
  { value: "zh-CN", label: "简体中文", flag: "🇨🇳" },
  { value: "en", label: "English", flag: "🇺🇸" },
];
