# Agent Buddy — 桌面端 AI Agent 详细设计

> 基于 Pi Agent Harness (SDK 直嵌模式) + Electron + React + 多厂商 LLM

> **V2 设计补充**：产品体验以 [Agent Workbuddy 需求调整](agent-workbuddy-v2.md) 为准。本文件中以 ChatGPT 风格聊天为中心的目录、组件和流程属于 V1 历史方案；实现前必须先满足 V2 的工作台、会话和 Composer 约定。

---

## V2 Agent Workbuddy 设计约定

### 设计目标与验收口径

设计目标是让用户随时知道 Agent 正在做什么、为什么做、影响什么，并能在权限、文件变更和失败节点进行控制。完整验收路径为：新建任务、选择 Agent/模型、添加附件/插件/目标、发起工作、观察工作流事件、确认或中止高风险操作、审查结果、重启后恢复。

### 信息架构与组件边界

- `layout/` 组织工作导航、项目/任务上下文栏、主工作流区与可折叠上下文审查面板。
- `workbench/` 承载 `WorkSession` 的时间线、工具/权限/变更/测试事件和结果摘要；原 `chat/` 目录中的组件逐步迁移或兼容为工作流渲染组件。
- `composer/` 提供 `AgentComposer`：文件添加、当前会话模型覆盖、插件上下文、目标关联、Thinking 选择与发送/停止。
- `sessions/` 管理主进程持久化会话的列表、恢复、新建、标题和项目关联；渲染进程只缓存展示状态。
- `goals/` 与 `tools/` 分别承载会话目标、任务步骤和工具权限/活动；右侧面板只呈现主进程事件，不直接执行工具。

### V2 数据流

```
Agent Composer
  -> ComposerContext（Agent / 模型覆盖 / 附件 / 插件 / 目标）
  -> preload 最小 IPC
  -> 主进程 WorkSession 服务（持久化、校验、Agent Runtime）
  -> WorkEvent 流（消息、工具、权限、变更、测试、错误、总结）
  -> 工作流时间线 + 右侧上下文审查面板
```

### 主界面布局规范

- 左侧为工作导航：新建任务、会话列表、项目、Agent 和插件入口。
- 顶部为当前项目、会话标题、Agent、实际模型和目标状态。
- 中央为 `WorkEvent` 时间线，不以连续问答气泡作为主要视觉结构。
- 底部为固定 Composer，支持多行文本、`+` 附件、模型、插件、目标、Thinking、发送和停止。
- 右侧为可折叠上下文面板，按目标、工具、文件变更和 Agent 结果切换；面板不得直接执行主进程能力。

### 四个核心对象

```text
WorkSession       项目与可恢复任务边界
ComposerContext   一次工作请求的显式上下文
Goal              会话目标、步骤与完成结果
WorkEvent         所有可审查工作活动的统一记录
```

事件必须由主进程生成并持久化，渲染进程只订阅、展示和发起明确操作。附件首轮仅支持图片、文本和代码文件；插件选择只代表上下文引用，不代表工具授权。

- `WorkSession`、`Goal`、`ComposerContext` 和 `WorkEvent` 是跨进程的 V2 共享概念，接口在实现 Feature 时定义于 `shared/`。
- 会话级模型覆盖优先于 Agent 默认分配；清除覆盖后回到 F1.8 的 Agent 默认配置。
- 文件附件仅通过用户显式选择进入上下文；图片走 F1.2 Vision 路由，文本/代码文件走受限文本上下文，真实本地读写仍通过 F1.6 权限体系。
- 插件选择只声明上下文和可用状态；插件工具执行必须进入 F1.6 的权限/事件链。

### 实现顺序

1. 先实现持久化 `WorkSession`、统一 `WorkEvent` 和会话恢复。
2. 再实现 Agent Workbench 时间线与 Agent Composer 的完整状态闭环。
3. 接入工具权限、会话模型覆盖、目标面板和文件变更审查。
4. 最后接入 Agent 管理、复杂目标编排、插件执行和项目/Git 深度能力。

---

## 一、技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | 31+ |
| 构建工具 | electron-vite | 最新 |
| 前端框架 | React 18 | 18.3+ |
| UI 组件 | Tailwind CSS + 自建组件 | 3.4+ |
| 状态管理 | Zustand | 4.5+ |
| Markdown 渲染 | react-markdown + remark-gfm | 最新 |
| 代码高亮 | Shiki | 1.x |
| 图标 | Lucide React | 最新 |
| Agent SDK | @earendil-works/pi-coding-agent | 最新 |
| LLM SDK | @earendil-works/pi-ai | 最新 |
| LLM Provider | 多厂商 (OpenAI / Anthropic / DeepSeek / Gemini / 自定义中转) | — |
| 设置持久化 | electron-store | 8.x+ |

### 模型配置策略

- **多厂商 Provider 注册**：用户可添加任意数量的 Provider 实例，每个实例独立配置 API Key 和 Base URL
- **中转支持**：每个 Provider 可选填 `baseURL`，支持 OpenAI 兼容格式的中转服务
- **双模型路由**：
  - **Chat Model**：主对话模型，处理纯文本消息
  - **Vision Model**：独立配置的图像识别模型，当用户上传图片或工具返回图片时自动切换
- **Fallback**：Vision Model 未配置时自动回退到 Chat Model

---

## 二、完整目录结构

```
agent-buddy/
├── package.json                    # 根包配置
├── electron.vite.config.ts         # electron-vite 构建配置
├── tsconfig.json                   # TypeScript 根配置
├── tsconfig.node.json              # 主进程 TS 配置
├── tsconfig.web.json               # 渲染进程 TS 配置
├── tailwind.config.js              # Tailwind 配置
├── postcss.config.js               # PostCSS 配置
│
├── main/                           # Electron 主进程
│   ├── index.ts                    # 应用入口：窗口创建、生命周期
│   ├── agent.ts                    # Pi SDK 集成核心：AgentSession + 模型路由
│   ├── ipc.ts                      # IPC 通信处理器
│   ├── provider-manager.ts         # 多厂商 Provider 注册表管理
│   ├── settings.ts                 # 设置持久化 (electron-store)
│   └── tools/                      # 自定义工具
│       ├── index.ts                # 工具注册入口
│       ├── file-picker.ts          # 系统文件选择器
│       ├── notification.ts         # 系统通知
│       └── clipboard.ts            # 剪贴板操作
│
├── preload/                        # Preload 脚本
│   └── index.ts                    # contextBridge：安全暴露 IPC API
│
├── renderer/                       # React 前端
│   ├── index.html                  # HTML 入口
│   └── src/
│       ├── main.tsx                # React 入口
│       ├── App.tsx                 # 根组件：布局编排
│       ├── index.css               # 全局样式 + Tailwind
│       │
│       ├── components/             # UI 组件
│       │   ├── layout/
│       │   │   ├── AppLayout.tsx       # 整体布局（侧边栏 + 主区域）
│       │   │   ├── Sidebar.tsx         # 左侧会话列表
│       │   │   └── TitleBar.tsx        # 自定义标题栏
│       │   │
│       │   ├── chat/
│       │   │   ├── ChatView.tsx        # 消息列表容器（滚动 + 自动跟随）
│       │   │   ├── MessageBubble.tsx   # 单条消息（区分 user/assistant/tool）
│       │   │   ├── MarkdownRenderer.tsx# Markdown + 代码高亮渲染
│       │   │   ├── ToolCallCard.tsx    # 工具调用展示（可折叠）
│       │   │   ├── ThinkingIndicator.tsx # "正在思考..." 动画
│       │   │   ├── ImageAttachment.tsx # 图片附件预览 + 上传
│       │   │   └── InputBar.tsx        # 输入框 + 发送/停止按钮 + 图片上传
│       │   │
│       │   ├── controls/
│       │   │   ├── ModelSelector.tsx       # 模型切换下拉框（含厂商图标）
│       │   │   ├── VisionModelBadge.tsx    # 视觉模型状态标识
│       │   │   ├── ThinkingLevelSelector.tsx # 推理深度切换
│       │   │   └── SettingsButton.tsx      # 设置入口
│       │   │
│       │   ├── settings/
│       │   │   ├── SettingsDialog.tsx          # 设置弹窗（Tab 切换）
│       │   │   ├── ProviderList.tsx            # Provider 列表 + 增删改
│       │   │   ├── ProviderForm.tsx            # 单个 Provider 编辑表单
│       │   │   ├── ModelAssignmentPanel.tsx     # Chat/Vision 模型分配面板
│       │   │   └── FallbackSettings.tsx        # 回退策略配置
│       │   │
│       │   └── common/
│       │       ├── Button.tsx          # 通用按钮
│       │       ├── Tooltip.tsx         # 悬浮提示
│       │       └── Spinner.tsx         # 加载动画
│       │
│       ├── hooks/
│       │   ├── useAgent.ts         # Agent 事件订阅 + 状态同步
│       │   ├── useAutoScroll.ts    # 聊天列表自动滚动
│       │   ├── useProviders.ts     # Provider 列表读取/变更
│       │   └── useImageUpload.ts   # 图片上传 + base64 编码
│       │
│       ├── stores/
│       │   ├── chatStore.ts        # 聊天消息状态 (Zustand)
│       │   ├── sessionStore.ts     # 会话列表状态
│       │   ├── settingsStore.ts    # 设置状态（模型分配、回退策略等）
│       │   └── providerStore.ts    # Provider 注册表状态 (Zustand)
│       │
│       ├── types/
│       │   ├── messages.ts         # 消息类型定义（含图片附件）
│       │   ├── events.ts           # Agent 事件类型映射
│       │   ├── provider.ts         # Provider / Model 类型定义
│       │   └── ipc.ts              # IPC 通道类型定义
│       │
│       └── utils/
│           ├── markdown.ts         # Markdown 预处理工具
│           ├── modelIcons.ts       # 厂商图标映射
│           └── format.ts           # 格式化工具（时间、token 等）
│
└── resources/                      # 静态资源
    ├── icon.png                    # 应用图标
    └── icon.ico                    # Windows 图标
```

---

## 三、核心文件设计

### 3.0 `renderer/src/types/provider.ts` — Provider 与模型类型定义

```typescript
/** 支持的 Provider 类型 */
export type ProviderType =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "gemini"
  | "mistral"
  | "openrouter"
  | "custom"; // OpenAI 兼容格式（中转站等）

/** 单个 Provider 实例配置 */
export interface ProviderConfig {
  id: string;                    // 唯一 ID (crypto.randomUUID)
  type: ProviderType;            // 厂商类型
  name: string;                  // 显示名称（如 "我的 OpenAI 中转"）
  apiKey: string;                // API Key
  baseURL?: string;              // 自定义 Base URL（中转地址，留空则用官方）
  models: string[];              // 可用模型列表
  status: "connected" | "untested" | "error";
  lastError?: string;
}

/** 模型分配策略 */
export interface ModelAssignment {
  chatModel: ModelRef | null;       // 主对话模型
  visionModel: ModelRef | null;     // 视觉模型（可选）
  autoSwitchOnImage: boolean;       // 检测到图片时自动切换到 vision model
  fallbackToChatForImages: boolean; // vision 未配置时回退到 chat model
  retryOnProviderError: boolean;    // provider 报错时自动切换备用 provider
}

/** 对某个 Provider 下的某个模型的引用 */
export interface ModelRef {
  providerId: string;   // 指向 ProviderConfig.id
  modelId: string;      // 模型标识（如 "gpt-4o"）
}

/** 设置文件完整结构 */
export interface AppSettings {
  providers: ProviderConfig[];
  modelAssignment: ModelAssignment;
  thinkingLevel: "off" | "low" | "medium" | "high";
  uiTheme: "light" | "dark";
}

/** 默认设置 */
export const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  modelAssignment: {
    chatModel: null,
    visionModel: null,
    autoSwitchOnImage: true,
    fallbackToChatForImages: true,
    retryOnProviderError: false,
  },
  thinkingLevel: "off",
  uiTheme: "light",
};
```

### 3.1 `main/settings.ts` — 设置持久化

```typescript
import Store from "electron-store";
import { DEFAULT_SETTINGS, type AppSettings, type ProviderConfig } from "../renderer/src/types/provider";

const store = new Store<AppSettings>({
  name: "agent-buddy-settings",
  defaults: DEFAULT_SETTINGS,
});

/** 读取完整设置 */
export function getSettings(): AppSettings {
  return {
    providers: store.get("providers"),
    modelAssignment: store.get("modelAssignment"),
    thinkingLevel: store.get("thinkingLevel"),
    uiTheme: store.get("uiTheme"),
  };
}

/** 保存完整设置 */
export function saveSettings(settings: Partial<AppSettings>): void {
  if (settings.providers !== undefined) store.set("providers", settings.providers);
  if (settings.modelAssignment !== undefined) store.set("modelAssignment", settings.modelAssignment);
  if (settings.thinkingLevel !== undefined) store.set("thinkingLevel", settings.thinkingLevel);
  if (settings.uiTheme !== undefined) store.set("uiTheme", settings.uiTheme);
}

/** Provider 增删改 */
export function addProvider(config: Omit<ProviderConfig, "id">): ProviderConfig {
  const providers = store.get("providers");
  const newProvider: ProviderConfig = { ...config, id: crypto.randomUUID() };
  providers.push(newProvider);
  store.set("providers", providers);
  return newProvider;
}

export function updateProvider(id: string, updates: Partial<ProviderConfig>): void {
  const providers = store.get("providers");
  const idx = providers.findIndex((p) => p.id === id);
  if (idx >= 0) {
    providers[idx] = { ...providers[idx], ...updates };
    store.set("providers", providers);
  }
}

export function removeProvider(id: string): void {
  const providers = store.get("providers").filter((p) => p.id !== id);
  store.set("providers", providers);
  // 同时清理 modelAssignment 中对此 provider 的引用
  const ma = store.get("modelAssignment");
  if (ma.chatModel?.providerId === id) ma.chatModel = null;
  if (ma.visionModel?.providerId === id) ma.visionModel = null;
  store.set("modelAssignment", ma);
}
```

### 3.2 `main/provider-manager.ts` — 多厂商 Provider 管理器

```typescript
import { getModel, type Model } from "@earendil-works/pi-ai";
import { getSettings, updateProvider } from "./settings";
import type { ProviderConfig, ProviderType } from "../renderer/src/types/provider";

/**
 * Provider 管理器
 * 负责将用户配置的 Provider 转换为 Pi 可用的 Model 对象
 */
export class ProviderManager {
  private providers: Map<string, ProviderConfig> = new Map();

  /** 从设置文件加载所有 Provider */
  reload(): void {
    const settings = getSettings();
    this.providers.clear();
    for (const p of settings.providers) {
      this.providers.set(p.id, p);
    }
  }

  /** 获取所有 Provider */
  getProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  /** 根据 ID 获取 Provider */
  getProvider(id: string): ProviderConfig | undefined {
    return this.providers.get(id);
  }

  /**
   * 获取 Pi Model 对象
   * 关键：如果 Provider 配置了 baseURL，通过环境变量注入中转地址
   */
  getModel(providerId: string, modelId: string): Model | null {
    const config = this.providers.get(providerId);
    if (!config) return null;

    // 设置环境变量（Pi-ai 内部会读取这些）
    const envKey = this.getEnvKeyName(config.type);
    process.env[envKey] = config.apiKey;

    // 如果配置了自定义 baseURL，设置对应的环境变量
    if (config.baseURL) {
      const baseURLKey = this.getBaseURLEnvName(config.type);
      if (baseURLKey) {
        process.env[baseURLKey] = config.baseURL;
      }
    }

    // 通过 pi-ai 获取 Model 对象
    const model = getModel(config.type, modelId);
    return model ?? null;
  }

  /** 获取 Provider 类型对应的环境变量名 */
  private getEnvKeyName(type: ProviderType): string {
    const map: Record<ProviderType, string> = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      gemini: "GEMINI_API_KEY",
      mistral: "MISTRAL_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      custom: "OPENAI_API_KEY", // custom 走 OpenAI 兼容接口
    };
    return map[type];
  }

  /** 获取 baseURL 对应的环境变量名（pi-ai 支持的） */
  private getBaseURLEnvName(type: ProviderType): string | null {
    const map: Partial<Record<ProviderType, string>> = {
      openai: "OPENAI_BASE_URL",
      anthropic: "ANTHROPIC_BASE_URL",
      deepseek: "DEEPSEEK_BASE_URL",
      custom: "OPENAI_BASE_URL",
    };
    return map[type] ?? null;
  }

  /**
   * 测试 Provider 连接
   * 发一个简单请求验证 API Key 和 baseURL 是否有效
   */
  async testConnection(providerId: string): Promise<{ success: boolean; error?: string }> {
    const config = this.providers.get(providerId);
    if (!config) return { success: false, error: "Provider not found" };

    try {
      const model = this.getModel(providerId, config.models[0] ?? "gpt-4o-mini");
      if (!model) return { success: false, error: "Model not found" };

      // 发一个最简单的 complete 调用来测试
      const { complete } = await import("@earendil-works/pi-ai");
      await complete({
        model,
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 1,
      });

      updateProvider(providerId, { status: "connected", lastError: undefined });
      return { success: true };
    } catch (err: any) {
      updateProvider(providerId, { status: "error", lastError: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * 自动探测 Provider 可用模型列表
   * 通过调用 /models 接口获取
   */
  async detectModels(providerId: string): Promise<string[]> {
    const config = this.providers.get(providerId);
    if (!config) return [];

    const baseURL = config.baseURL || this.getDefaultBaseURL(config.type);
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${config.apiKey}`,
    };

    try {
      const resp = await fetch(`${baseURL}/models`, { headers });
      const data = await resp.json();
      const models = (data.data || []).map((m: any) => m.id);
      updateProvider(providerId, { models });
      return models;
    } catch {
      return [];
    }
  }

  private getDefaultBaseURL(type: ProviderType): string {
    const map: Record<ProviderType, string> = {
      openai: "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com/v1",
      deepseek: "https://api.deepseek.com/v1",
      gemini: "https://generativelanguage.googleapis.com/v1",
      mistral: "https://api.mistral.ai/v1",
      openrouter: "https://openrouter.ai/api/v1",
      custom: "", // 必须由用户填写
    };
    return map[type];
  }
}

export const providerManager = new ProviderManager();
```

### 3.3 `main/agent.ts` — Pi SDK 集成核心（含模型路由）

```typescript
import { createAgentSession, SessionManager, type AgentSession } from "@earendil-works/pi-coding-agent";
import { type Model } from "@earendil-works/pi-ai";
import { BrowserWindow } from "electron";
import { providerManager } from "./provider-manager";
import { getSettings } from "./settings";
import { customTools } from "./tools";
import type { ModelRef } from "../renderer/src/types/provider";

let session: AgentSession | null = null;
let currentModelRole: "chat" | "vision" = "chat";

/**
 * 初始化 Agent Session
 * 从设置文件读取 Provider 配置，创建 session
 */
export async function initAgent(win: BrowserWindow): Promise<void> {
  // 1. 加载 Provider 配置
  providerManager.reload();

  const settings = getSettings();

  // 2. 获取默认 chat model
  const chatModel = resolveModel(settings.modelAssignment.chatModel);
  if (!chatModel) {
    throw new Error(
      "No chat model configured. Please add a provider and assign a chat model in Settings."
    );
  }

  // 3. 创建 Agent Session
  const result = await createAgentSession({
    model: chatModel,
    thinkingLevel: settings.thinkingLevel,
    tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
    customTools,
    sessionManager: SessionManager.inMemory(),
  });

  session = result.session;
  currentModelRole = "chat";

  // 4. 订阅事件，转发到渲染进程
  session.subscribe((event) => {
    win.webContents.send("agent:event", event);
  });
}

/**
 * 根据 ModelRef 解析为 Pi Model 对象
 */
function resolveModel(ref: ModelRef | null): Model | null {
  if (!ref) return null;
  return providerManager.getModel(ref.providerId, ref.modelId);
}

/**
 * 发送用户消息（核心路由逻辑）
 * - 如果消息包含图片 → 切换到 vision model
 * - 否则 → 使用 chat model
 */
export async function prompt(
  text: string,
  images?: Array<{ data: string; mimeType: string }>
): Promise<void> {
  if (!session) throw new Error("Agent not initialized");

  const settings = getSettings();
  const hasImages = images && images.length > 0;

  // === 模型路由 ===
  if (hasImages && settings.modelAssignment.autoSwitchOnImage) {
    const visionModel = resolveModel(settings.modelAssignment.visionModel);
    if (visionModel) {
      // 切换到 vision model
      if (currentModelRole !== "vision") {
        await session.setModel(visionModel);
        currentModelRole = "vision";
      }
    } else if (settings.modelAssignment.fallbackToChatForImages) {
      // 回退到 chat model（如果 chat model 支持视觉）
      const chatModel = resolveModel(settings.modelAssignment.chatModel);
      if (chatModel && currentModelRole !== "chat") {
        await session.setModel(chatModel);
        currentModelRole = "chat";
      }
    } else {
      throw new Error("Vision model not configured. Set a vision model or enable fallback in Settings.");
    }
  } else {
    // 纯文本消息 → 确保 chat model
    const chatModel = resolveModel(settings.modelAssignment.chatModel);
    if (chatModel && currentModelRole !== "chat") {
      await session.setModel(chatModel);
      currentModelRole = "chat";
    }
  }

  // 构建消息内容（含图片）
  if (hasImages) {
    // Pi 支持多模态消息：text + image content blocks
    const content = [
      { type: "text", text },
      ...images!.map((img) => ({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.data },
      })),
    ];
    await session.prompt(content as any);
  } else {
    await session.prompt(text);
  }
}

/**
 * 中止当前生成
 */
export async function abort(): Promise<void> {
  if (!session) return;
  await session.abort();
}

/**
 * 流式传输期间插入引导消息
 */
export async function steer(text: string): Promise<void> {
  if (!session) return;
  await session.steer(text);
}

/**
 * 手动切换模型（通过侧边栏下拉框）
 */
export async function setModel(providerId: string, modelId: string): Promise<void> {
  if (!session) return;
  const model = providerManager.getModel(providerId, modelId);
  if (model) {
    await session.setModel(model);
    // 用户手动切换后，重置路由角色
    currentModelRole = "chat";
  }
}

/**
 * 获取当前状态
 */
export function getState() {
  if (!session) return null;
  const settings = getSettings();
  return {
    isStreaming: session.isStreaming,
    model: session.model,
    thinkingLevel: session.thinkingLevel,
    messageCount: session.messages.length,
    currentModelRole,
    chatModel: settings.modelAssignment.chatModel,
    visionModel: settings.modelAssignment.visionModel,
  };
}

export function getSession(): AgentSession | null {
  return session;
}
```

### 3.4 `main/ipc.ts` — IPC 通信处理器（含 Provider 管理）

```typescript
import { ipcMain, BrowserWindow } from "electron";
import { initAgent, prompt, abort, steer, setModel, getState } from "./agent";
import {
  getSettings,
  saveSettings,
  addProvider,
  updateProvider,
  removeProvider,
} from "./settings";
import { providerManager } from "./provider-manager";

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(win: BrowserWindow): void {
  // ─── Agent 相关 ───

  ipcMain.handle("agent:init", async () => {
    await initAgent(win);
    return { success: true };
  });

  // 发送消息（支持图片）
  ipcMain.handle("agent:prompt", async (
    _event,
    text: string,
    images?: Array<{ data: string; mimeType: string }>
  ) => {
    await prompt(text, images);
    return { success: true };
  });

  ipcMain.handle("agent:abort", async () => {
    await abort();
    return { success: true };
  });

  ipcMain.handle("agent:steer", async (_event, text: string) => {
    await steer(text);
    return { success: true };
  });

  ipcMain.handle("agent:set-model", async (_event, providerId: string, modelId: string) => {
    await setModel(providerId, modelId);
    return { success: true };
  });

  ipcMain.handle("agent:get-state", async () => {
    return getState();
  });

  // ─── Provider 管理相关 ───

  // 获取所有 Provider
  ipcMain.handle("providers:list", async () => {
    return providerManager.getProviders();
  });

  // 添加 Provider
  ipcMain.handle("providers:add", async (_event, config: Omit<ProviderConfig, "id">) => {
    return addProvider(config);
  });

  // 更新 Provider
  ipcMain.handle("providers:update", async (_event, id: string, updates: Partial<ProviderConfig>) => {
    updateProvider(id, updates);
    providerManager.reload();
    return { success: true };
  });

  // 删除 Provider
  ipcMain.handle("providers:remove", async (_event, id: string) => {
    removeProvider(id);
    providerManager.reload();
    return { success: true };
  });

  // 测试 Provider 连接
  ipcMain.handle("providers:test", async (_event, id: string) => {
    return await providerManager.testConnection(id);
  });

  // 自动探测可用模型
  ipcMain.handle("providers:detect-models", async (_event, id: string) => {
    return await providerManager.detectModels(id);
  });

  // ─── 设置相关 ───

  ipcMain.handle("settings:get", async () => {
    return getSettings();
  });

  ipcMain.handle("settings:save", async (_event, settings: Partial<AppSettings>) => {
    saveSettings(settings);
    providerManager.reload();
    return { success: true };
  });
}
```

### 3.5 `main/index.ts` — 应用入口

```typescript
import { app, BrowserWindow } from "electron";
import { join } from "path";
import { registerIpcHandlers } from "./ipc";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",  // macOS 风格；Windows 可改为 "default"
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // 开发模式加载 dev server，生产模式加载打包文件
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  // 1. 创建窗口
  createWindow();
  if (!mainWindow) return;

  // 2. 注册 IPC 处理器
  registerIpcHandlers(mainWindow);

  // 3. 窗口加载完成后初始化 Agent
  mainWindow.webContents.once("did-finish-load", async () => {
    try {
      await mainWindow?.webContents.executeJavaScript(
        'window.electronAPI?.initAgent?.()'
      );
    } catch (e) {
      console.error("Failed to init agent:", e);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

### 3.6 `preload/index.ts` — 安全 IPC 桥接

```typescript
import { contextBridge, ipcRenderer } from "electron";
import type { ProviderConfig, AppSettings } from "../renderer/src/types/provider";

// 图片附件类型
interface ImageAttachment {
  data: string;       // base64 编码
  mimeType: string;   // "image/png" | "image/jpeg" | ...
}

const electronAPI = {
  // ─── Agent 相关 ───
  initAgent: () => ipcRenderer.invoke("agent:init"),

  // 发送消息（支持图片附件）
  prompt: (text: string, images?: ImageAttachment[]) =>
    ipcRenderer.invoke("agent:prompt", text, images),

  abort: () => ipcRenderer.invoke("agent:abort"),
  steer: (text: string) => ipcRenderer.invoke("agent:steer", text),
  setModel: (providerId: string, modelId: string) =>
    ipcRenderer.invoke("agent:set-model", providerId, modelId),
  getState: () => ipcRenderer.invoke("agent:get-state"),

  // 监听 Agent 事件
  onAgentEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("agent:event", handler);
    return () => ipcRenderer.removeListener("agent:event", handler);
  },

  // ─── Provider 管理相关 ───
  listProviders: () => ipcRenderer.invoke("providers:list"),
  addProvider: (config: Omit<ProviderConfig, "id">) =>
    ipcRenderer.invoke("providers:add", config),
  updateProvider: (id: string, updates: Partial<ProviderConfig>) =>
    ipcRenderer.invoke("providers:update", id, updates),
  removeProvider: (id: string) => ipcRenderer.invoke("providers:remove", id),
  testProvider: (id: string) => ipcRenderer.invoke("providers:test", id),
  detectModels: (id: string) => ipcRenderer.invoke("providers:detect-models", id),

  // ─── 设置相关 ───
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke("settings:save", settings),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
```

### 3.7 `renderer/src/stores/providerStore.ts` — Provider 状态管理

```typescript
import { create } from "zustand";
import type { ProviderConfig, AppSettings, ModelAssignment } from "../types/provider";

interface ProviderState {
  providers: ProviderConfig[];
  settings: AppSettings | null;
  loaded: boolean;

  // Actions
  load: () => Promise<void>;
  addProvider: (config: Omit<ProviderConfig, "id">) => Promise<void>;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  testProvider: (id: string) => Promise<{ success: boolean; error?: string }>;
  detectModels: (id: string) => Promise<string[]>;
  saveModelAssignment: (assignment: Partial<ModelAssignment>) => Promise<void>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  settings: null,
  loaded: false,

  load: async () => {
    const [providers, settings] = await Promise.all([
      window.electronAPI.listProviders(),
      window.electronAPI.getSettings(),
    ]);
    set({ providers, settings, loaded: true });
  },

  addProvider: async (config) => {
    await window.electronAPI.addProvider(config);
    await get().load();
  },

  updateProvider: async (id, updates) => {
    await window.electronAPI.updateProvider(id, updates);
    await get().load();
  },

  removeProvider: async (id) => {
    await window.electronAPI.removeProvider(id);
    await get().load();
  },

  testProvider: async (id) => {
    return await window.electronAPI.testProvider(id);
  },

  detectModels: async (id) => {
    const models = await window.electronAPI.detectModels(id);
    await get().load();
    return models;
  },

  saveModelAssignment: async (assignment) => {
    const current = get().settings;
    if (!current) return;
    const newAssignment = { ...current.modelAssignment, ...assignment };
    await window.electronAPI.saveSettings({ modelAssignment: newAssignment });
    await get().load();
  },
}));
```

### 3.8 `renderer/src/stores/chatStore.ts` — Zustand 状态管理（含图片支持）

```typescript
import { create } from "zustand";

// 图片附件类型
interface ImageAttachment {
  id: string;
  data: string;       // base64
  mimeType: string;
  name: string;
}

// 消息类型
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "toolResult";
  content: string;              // 文本内容（流式追加）
  images?: ImageAttachment[];   // 图片附件（仅 user 消息）
  toolCalls?: ToolCallInfo[];   // 工具调用列表
  isStreaming?: boolean;        // 是否正在流式生成
  timestamp: number;
  error?: string;
  modelUsed?: string;           // 记录此消息使用的模型（chat / vision）
}

interface ToolCallInfo {
  id: string;
  name: string;
  args: any;
  result?: string;
  isError?: boolean;
  isStreaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  isAgentRunning: boolean;

  // Actions
  addUserMessage: (text: string, images?: Array<{ data: string; mimeType: string }>) => void;
  startAssistantMessage: () => void;
  appendTextDelta: (delta: string) => void;
  finishAssistantMessage: () => void;
  addToolCall: (toolCall: ToolCallInfo) => void;
  updateToolCall: (id: string, updates: Partial<ToolCallInfo>) => void;
  setAgentRunning: (running: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isAgentRunning: false,

  addUserMessage: (text, images) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          images: images?.map((img, i) => ({
            id: `img-${Date.now()}-${i}`,
            data: img.data,
            mimeType: img.mimeType,
            name: `image-${i + 1}`,
          })),
          timestamp: Date.now(),
        },
      ],
    })),

  startAssistantMessage: () =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          isStreaming: true,
          timestamp: Date.now(),
        },
      ],
    })),

  appendTextDelta: (delta) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant" && last.isStreaming) {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + delta,
        };
      }
      return { messages };
    }),

  finishAssistantMessage: () =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          isStreaming: false,
        };
      }
      return { messages };
    }),

  addToolCall: (toolCall) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          toolCalls: [...(last.toolCalls || []), toolCall],
        };
      }
      return { messages };
    }),

  updateToolCall: (id, updates) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.toolCalls) {
        const tc = last.toolCalls.find((t) => t.id === id);
        if (tc) {
          Object.assign(tc, updates);
          messages[messages.length - 1] = { ...last };
        }
      }
      return { messages };
    }),

  setAgentRunning: (running) => set({ isAgentRunning: running }),

  clearMessages: () => set({ messages: [] }),
}));
```

### 3.9 `renderer/src/hooks/useAgent.ts` — Agent 事件订阅

```typescript
import { useEffect } from "react";
import { useChatStore } from "../stores/chatStore";

/**
 * 订阅 Agent 事件，自动更新 chatStore
 */
export function useAgent() {
  const {
    addUserMessage,
    startAssistantMessage,
    appendTextDelta,
    finishAssistantMessage,
    addToolCall,
    updateToolCall,
    setAgentRunning,
  } = useChatStore();

  useEffect(() => {
    // 通过 preload 暴露的 API 订阅事件
    const unsubscribe = window.electronAPI.onAgentEvent((event) => {
      switch (event.type) {
        case "agent_start":
          setAgentRunning(true);
          break;

        case "turn_start":
          // 每个 turn 开始时创建新的 assistant 消息
          startAssistantMessage();
          break;

        case "message_update":
          const delta = event.assistantMessageEvent;
          if (delta.type === "text_delta") {
            appendTextDelta(delta.delta);
          }
          // thinking_delta 可以选择展示或忽略
          break;

        case "message_end":
          if (event.message.role === "assistant") {
            finishAssistantMessage();
          }
          break;

        case "tool_execution_start":
          addToolCall({
            id: event.toolCallId,
            name: event.toolName,
            args: event.args,
            isStreaming: true,
          });
          break;

        case "tool_execution_update":
          // 可选：展示工具流式输出
          break;

        case "tool_execution_end":
          updateToolCall(event.toolCallId, {
            result: typeof event.result === "string"
              ? event.result
              : JSON.stringify(event.result, null, 2),
            isError: event.isError,
            isStreaming: false,
          });
          break;

        case "agent_end":
        case "agent_settled":
          setAgentRunning(false);
          break;
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);
}

/**
 * 发送消息的便捷函数（支持图片）
 */
export async function sendMessage(
  text: string,
  images?: Array<{ data: string; mimeType: string }>
) {
  const store = useChatStore.getState();
  store.addUserMessage(text, images);
  await window.electronAPI.prompt(text, images);
}

/**
 * 中止生成
 */
export async function abortAgent() {
  await window.electronAPI.abort();
}
```

### 3.10 `renderer/src/components/chat/ChatView.tsx` — 聊天主视图

```tsx
import { useEffect, useRef } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { MessageBubble } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";

export function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const isRunning = useChatStore((s) => s.isAgentRunning);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { autoScroll, scrollToBottom } = useAutoScroll(scrollRef);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <h2 className="text-2xl font-medium mb-2">Agent Buddy</h2>
              <p>输入消息开始对话</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isRunning && messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <ThinkingIndicator />
          )}
        </div>
      </div>

      {/* 自动滚动按钮 */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-8 w-10 h-10 rounded-full
                     bg-white border border-gray-200 shadow-md
                     flex items-center justify-center hover:bg-gray-50"
        >
          ↓
        </button>
      )}
    </div>
  );
}
```

### 3.11 `renderer/src/components/chat/MessageBubble.tsx` — 消息气泡

```tsx
import { type ChatMessage } from "../../stores/chatStore";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallCard } from "./ToolCallCard";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${isUser ? "order-2" : ""}`}>
        {/* 头像 */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
            ${isUser ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}`}>
            {isUser ? "我" : "AI"}
          </div>
          <span className="text-xs text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* 消息内容 */}
        <div className={`rounded-2xl px-4 py-3
          ${isUser
            ? "bg-blue-500 text-white rounded-tr-sm"
            : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>

          {isUser ? (
            <>
              {/* 图片附件 */}
              {message.images && message.images.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {message.images.map((img) => (
                    <img
                      key={img.id}
                      src={`data:${img.mimeType};base64,${img.data}`}
                      alt={img.name}
                      className="max-w-48 max-h-48 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </>
          ) : (
            <>
              <MarkdownRenderer content={message.content} />

              {/* 流式光标 */}
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
              )}

              {/* 工具调用 */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.toolCalls.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 3.12 `renderer/src/components/chat/InputBar.tsx` — 输入栏（含图片上传）

```tsx
import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../../stores/chatStore";
import { sendMessage, abortAgent } from "../../hooks/useAgent";
import { useProviderStore } from "../../stores/providerStore";
import { Send, Square, ImagePlus, X } from "lucide-react";

interface PendingImage {
  data: string;
  mimeType: string;
  name: string;
  previewUrl: string;
}

export function InputBar() {
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const isRunning = useChatStore((s) => s.isAgentRunning);
  const settings = useProviderStore((s) => s.settings);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自适应高度
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  // 检查是否配置了 vision model
  const hasVisionModel = !!settings?.modelAssignment.visionModel;
  const visionModelName = settings?.modelAssignment.visionModel
    ? `${settings.modelAssignment.visionModel.modelId} (vision)`
    : null;

  const handleImageSelect = async (files: FileList | null) => {
    if (!files) return;
    const newImages: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const data = await fileToBase64(file);
      newImages.push({
        data,
        mimeType: file.type,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPendingImages((prev) => [...prev, ...newImages]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || isRunning) return;
    setInput("");
    const images = pendingImages.map((img) => ({
      data: img.data,
      mimeType: img.mimeType,
    }));
    pendingImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setPendingImages([]);
    await sendMessage(text, images.length > 0 ? images : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 粘贴图片
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      handleImageSelect(imageFiles as unknown as FileList);
    }
  };

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      <div className="max-w-3xl mx-auto">
        {/* 图片预览区 */}
        {pendingImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.previewUrl}
                  alt={img.name}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                />
                <button
                  onClick={() => setPendingImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white
                             flex items-center justify-center opacity-0 group-hover:opacity-100
                             transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {/* Vision model 状态提示 */}
            <div className="flex items-center text-xs text-gray-400 ml-1">
              {hasVisionModel ? (
                <span className="text-amber-600">
                  Will use: {visionModelName}
                </span>
              ) : (
                <span className="text-gray-400">
                  Vision model not set, will use chat model
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* 图片上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500
                       flex items-center justify-center hover:bg-gray-50
                       transition-colors shrink-0"
            title="Upload image"
          >
            <ImagePlus size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleImageSelect(e.target.files)}
          />

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行, 可粘贴图片)"
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200
                         px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-200
                         focus:border-transparent
                         placeholder:text-gray-400"
              style={{ maxHeight: "200px" }}
            />
          </div>

          {isRunning ? (
            <button
              onClick={abortAgent}
              className="w-10 h-10 rounded-xl bg-red-500 text-white
                         flex items-center justify-center hover:bg-red-600
                         transition-colors shrink-0"
              title="Stop"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && pendingImages.length === 0}
              className="w-10 h-10 rounded-xl bg-blue-500 text-white
                         flex items-center justify-center hover:bg-blue-600
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors shrink-0"
              title="Send"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 工具函数：File → base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 去掉 "data:image/png;base64," 前缀
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

### 3.13 `renderer/src/App.tsx` — 根组件

```tsx
import { useEffect } from "react";
import { useAgent } from "./hooks/useAgent";
import { useProviderStore } from "./stores/providerStore";
import { AppLayout } from "./components/layout/AppLayout";
import { ChatView } from "./components/chat/ChatView";
import { InputBar } from "./components/chat/InputBar";
import { Sidebar } from "./components/layout/Sidebar";

export default function App() {
  // 初始化 Agent 事件订阅
  useAgent();

  // 加载 Provider 设置（首次启动必须）
  const loadProviders = useProviderStore((s) => s.load);
  const providersLoaded = useProviderStore((s) => s.loaded);

  useEffect(() => {
    loadProviders().then(() => {
      // Provider 加载完成后初始化 Agent
      window.electronAPI.initAgent().catch(console.error);
    });
  }, []);

  if (!providersLoaded) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <AppLayout>
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <ChatView />
        <InputBar />
      </div>
    </AppLayout>
  );
}
```

---

## 四、V1 ChatGPT 风格 UI 设计规范（历史基线）

### 布局

```
┌──────────────────────────────────────────┐
│  TitleBar (拖拽区域 + 窗口控制)            │
├────────┬─────────────────────────────────┤
│        │                                 │
│ Side   │   ChatView (滚动区域)            │
│ bar    │                                 │
│        │   ┌─────────────────────┐       │
│ 会话    │   │ 用户消息 (右对齐)      │       │
│ 列表    │   └─────────────────────┘       │
│        │   ┌─────────────────────┐       │
│        │   │ AI 回复 (左对齐)       │       │
│        │   │  Markdown 渲染        │       │
│        │   │  工具调用卡片         │       │
│        │   └─────────────────────┘       │
│        │                                 │
├────────┴─────────────────────────────────┤
│  InputBar (输入框 + 发送/停止按钮)         │
└──────────────────────────────────────────┘
```

### 色彩

| 元素 | 颜色 |
|------|------|
| 背景 | `#ffffff` (纯白) |
| 侧边栏背景 | `#f9f9f9` |
| 用户消息气泡 | `#3b82f6` (蓝色) + 白色文字 |
| AI 消息气泡 | `#f3f4f6` (浅灰) + 深色文字 |
| 边框 | `#e5e7eb` |
| 主按钮 | `#3b82f6` (蓝色) |
| 危险按钮 | `#ef4444` (红色，停止按钮) |
| 链接 | `#2563eb` |

### 排版

- 消息正文：14px，行高 1.6
- 代码块：13px，monospace，浅灰背景
- 时间戳：11px，灰色
- 工具调用标题：12px，中等粗细

### 交互

- **Enter** 发送消息
- **Shift+Enter** 换行
- 输入框自适应高度（最大 200px）
- 消息列表自动滚动到底部（用户向上滚动时暂停自动滚动）
- AI 回复时显示流式光标动画
- 工具调用卡片可折叠/展开

---

## 五、实现步骤（按顺序）

### Step 1: 项目初始化 (30 分钟)

```bash
# 创建 electron-vite 项目
npm create @quick-start/electron agent-buddy -- --template react-ts
cd agent-buddy

# 安装 Pi SDK
npm install @earendil-works/pi-coding-agent @earendil-works/pi-ai

# 安装前端依赖
npm install zustand react-markdown remark-gfm lucide-react

# 安装设置持久化
npm install electron-store

# 安装 Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 2: 类型定义和设置层 (45 分钟)

1. 编写 `types/provider.ts` — Provider/ModelAssignment/AppSettings 类型
2. 编写 `main/settings.ts` — electron-store 持久化（增删改查 Provider、保存模型分配）
3. 编写 `main/provider-manager.ts` — Provider 管理器（getModel、testConnection、detectModels）

### Step 3: 主进程集成 (1 小时)

1. 编写 `main/agent.ts` — Pi SDK 初始化 + 模型路由逻辑（chat/vision 自动切换）
2. 编写 `main/ipc.ts` — IPC 处理器（agent + providers + settings 三组通道）
3. 编写 `preload/index.ts` — contextBridge 桥接（暴露完整 API）
4. 修改 `main/index.ts` — app ready 时初始化

### Step 4: 状态管理和事件订阅 (45 分钟)

1. 编写 `stores/providerStore.ts` — Provider 列表和设置状态
2. 编写 `stores/chatStore.ts` — 消息状态（含图片附件字段）
3. 编写 `hooks/useAgent.ts` — 事件订阅 + sendMessage（支持图片）

### Step 5: 设置面板 UI (1.5 小时)

1. `SettingsDialog.tsx` — 设置弹窗（Tab: Providers / Model assignment）
2. `ProviderList.tsx` — Provider 列表（状态指示 + 编辑/删除）
3. `ProviderForm.tsx` — Provider 编辑表单（type/apiKey/baseURL/models + 测试 + 自动探测）
4. `ModelAssignmentPanel.tsx` — Chat/Vision 模型选择 + 回退策略

### Step 6: 聊天 UI (1.5 小时)

1. `AppLayout.tsx` — 整体布局
2. `ChatView.tsx` — 消息列表 + 自动滚动
3. `MessageBubble.tsx` — 消息气泡（含图片展示）
4. `InputBar.tsx` — 输入栏（图片上传按钮 + 粘贴图片 + 预览 + vision model 提示）
5. `MarkdownRenderer.tsx` — Markdown 渲染
6. `ToolCallCard.tsx` — 工具调用展示
7. `ModelSelector.tsx` — 模型切换下拉框（带厂商图标）

### Step 7: 测试和调试 (1 小时)

1. 打开设置面板，添加一个 Provider（如 OpenAI + API Key）
2. 测试连接，自动探测模型
3. 分配 Chat Model 和 Vision Model
4. 测试纯文本对话
5. 测试图片上传 + 对话（验证自动切换到 vision model）
6. 测试工具调用（读文件、执行命令）
7. 测试中转配置（自定义 baseURL）
8. 测试流式输出和中断

---

## 六、关键设计决策

### 6.1 为什么用多 Provider 注册表而非硬编码单个厂商？

- 用户可能同时使用多个厂商（OpenAI 日常 + Anthropic 做复杂推理 + DeepSeek 省钱）
- 中转服务在国内很常见，需要支持自定义 baseURL
- Pi-ai 已内置 30+ 厂商适配，我们只需暴露 UI 让用户管理配置
- 设置持久化到 electron-store，支持多设备同步（后续可加云同步）

### 6.2 中转支持如何实现？

Pi-ai 的 `getModel()` 内部会读取环境变量来配置 Provider。我们的方案：
1. 用户在设置中填入 `baseURL`（如 `https://relay.example.com/v1`）
2. `providerManager.getModel()` 在调用前设置 `OPENAI_BASE_URL` 等环境变量
3. Pi-ai 内部使用该环境变量构造请求 URL
4. `custom` 类型的 Provider 走 OpenAI 兼容接口，复用 `OPENAI_API_KEY` + `OPENAI_BASE_URL`

### 6.3 视觉模型为什么要单独配置？

- 主对话模型可能用便宜快速的模型（如 deepseek-v3），但它不一定支持图片
- 视觉任务需要专门的 vision-capable 模型（如 gpt-4o、claude-sonnet-4）
- 分开配置让用户可以灵活组合：便宜的文本模型 + 强力的视觉模型
- 自动路由：检测到图片 → 切换 vision model；纯文本 → 回退 chat model

### 6.4 为什么用 Zustand 而非 Redux？

- Pi 的事件流是高频更新（每个 token 一个事件），Zustand 的直接 set() 比 Redux 的 dispatch 链路更短
- 不需要 reducer/action types 的样板代码
- 对流式追加操作更友好

### 6.5 为什么用内存会话而非 SQLite？

MVP 阶段用 `SessionManager.inMemory()` 理由：
- 减少初始复杂度，不需要处理文件 I/O
- 快速验证核心功能
- 后续切换到持久化只需改一行代码

### 6.6 安全模型

MVP 阶段的安全策略：
- `contextIsolation: true` — 渲染进程不能直接访问 Node.js
- `nodeIntegration: false` — 所有 Node.js 操作通过 IPC
- `sandbox: false` — 需要关闭沙箱以便 preload 脚本使用 ipcRenderer
- API Key 存储在 electron-store（明文，后续可加密）
- 工具执行无额外权限限制（MVP 阶段信任用户）

后续阶段需要添加 `beforeToolCall` 钩子实现危险命令确认。

---

## 七、后续扩展路线

| 阶段 | 功能 | 预计工作量 |
|------|------|-----------|
| MVP | 多 Provider 配置 + 双模型路由 + 聊天/图片/工具 | 2 天 |
| v0.2 | 会话持久化 + 历史列表 | 2 天 |
| v0.3 | 自定义工具（文件选择器、通知、剪贴板） | 1 天 |
| v0.4 | 权限确认系统（beforeToolCall） | 1 天 |
| v0.5 | Provider 自动故障转移 + 负载均衡 | 1 天 |
| v0.6 | Skills 加载 + 扩展系统 | 2 天 |
| v0.7 | API Key 加密存储 + 导入/导出设置 | 0.5 天 |
| v1.0 | 上下文压缩 + 会话分支 + 打包发布 | 3 天 |
