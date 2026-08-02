# Pi Agent Harness 项目分析 & 桌面端 Agent Buddy 构建指南

## 一、项目概述

**Pi** 是由 earendil-works（作者 Mario Zechner，libGDX 框架创建者）开发的开源 AI Agent 工具包，采用 MIT 许可证，GitHub 上已有 7.7 万+ Star。

- **仓库地址**：https://github.com/earendil-works/pi
- **官网**：https://pi.dev
- **文档**：https://pi.dev/docs/latest
- **语言**：TypeScript
- **架构**：npm workspaces monorepo
- **许可**：MIT

### 核心定位

Pi 不是一个单一的 CLI 工具，而是一套**模块化的 AI Agent 底座**。它的设计哲学是：

> **核心尽量少做判断，扩展点尽量多暴露。**

它故意不内置以下功能（这些是 Claude Code / Cursor 等工具的标准配置）：
- 无内置 sub-agents
- 无 plan mode
- 无内置 to-do list
- 无权限弹窗系统
- 无内置 MCP 支持

这不是缺陷，而是设计选择——这些能力不应该硬编码进核心，而应该通过扩展机制实现。

---

## 二、四层架构详解

### 第 1 层：`@earendil-works/pi-ai` — 统一 LLM API

**职责**：屏蔽不同 LLM 提供商的差异，提供统一调用接口。

**核心能力**：
- 支持 30+ 个 LLM 提供商（OpenAI、Anthropic、Google、DeepSeek、Mistral、Groq、xAI、Amazon Bedrock 等）
- 支持任何 OpenAI 兼容 API（Ollama、vLLM、LM Studio 等）
- 支持 OAuth 认证（Anthropic Claude Pro/Max、OpenAI Codex、GitHub Copilot、OpenRouter）
- 12 种流式事件类型（text_delta、thinking_delta、toolcall_start/delta/end 等）
- 内置 Token 和成本追踪
- 仅包含支持 function calling 的模型（agentic 工作流必需）

**关键 API**：
```typescript
import { createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

const models = createModels();
models.setProvider(anthropicProvider());
const model = models.getModel("anthropic", "claude-sonnet-4-6");

// 统一流式调用
const stream = models.streamSimple(model, context, options);
```

### 第 2 层：`@earendil-works/pi-agent-core` — Agent 运行时

**职责**：提供有状态的 Agent 循环、工具调用、状态管理和事件流。

**核心概念**：

1. **Agent 循环**：`调用 LLM → 解析工具调用 → 执行工具 → 收集结果 → 决定下一步 → 重复`
2. **消息流**：`AgentMessage[] → transformContext() → convertToLlm() → Message[] → LLM`
3. **事件流**：完整的生命周期事件（agent_start/end、turn_start/end、message_start/update/end、tool_execution_start/update/end）

**Agent 配置选项**：
```typescript
const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model,
    thinkingLevel: "medium",
    tools: [...],
    messages: [],
  },
  streamFn: models.streamSimple.bind(models),  // 必需
  convertToLlm: (messages) => messages.filter(...),  // 自定义消息转换
  transformContext: async (messages) => pruneOldMessages(messages),  // 上下文裁剪
  toolExecution: "parallel",  // 或 "sequential"
  beforeToolCall: async ({ toolCall, args }) => { ... },  // 工具调用前钩子
  afterToolCall: async ({ toolCall, result }) => { ... },  // 工具调用后钩子
});
```

**工具定义**：
```typescript
const myTool: AgentTool = {
  name: "my_tool",
  label: "My Tool",
  description: "Does something useful",
  parameters: Type.Object({ input: Type.String() }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    return {
      content: [{ type: "text", text: `Result: ${params.input}` }],
      details: {},
    };
  },
};
```

**引导和后续消息**（Steering & Follow-up）：
- `agent.steer()` — 在工具运行时中断 Agent，注入新指令
- `agent.followUp()` — Agent 正常停止后排入新工作

**会话管理**：
- SQLite 存储后端（独立包 `@earendil-works/pi-storage-sqlite-node`）
- 支持会话分支（branch）
- 支持上下文压缩（compaction）

### 第 3 层：`@earendil-works/pi-coding-agent` — 编码代理

**职责**：在 Agent 运行时之上构建完整的交互式编码代理。

**核心功能**：
- 内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`
- 技能系统（Skills）：Markdown 格式的可复用指令
- 扩展系统（Extensions）：TypeScript 模块，注册工具、命令、事件
- 提示模板（Prompt Templates）：斜杠命令展开
- 主题系统
- 会话持久化和分支
- 上下文压缩
- 自动重试
- 自更新

**SDK 快速开始**：
```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Hello!");
```

### 第 4 层：`@earendil-works/pi-tui` — 终端 UI

**职责**：差分渲染的终端 UI 组件库。桌面端应用通常不需要这一层。

---

## 三、集成方式对比

### 方案 A：SDK 直嵌模式（推荐 Electron 应用）

**原理**：在 Electron 主进程中直接 import Pi 的 npm 包，通过 TypeScript API 调用。

**架构**：
```
Electron 主进程
  └─ createAgentSession()
       └─ AgentSession
            ├─ subscribe(event => ...)
            ├─ prompt(text)
            ├─ steer(text)
            └─ followUp(text)

Electron 渲染进程 (React/Vue)
  └─ IPC → 主进程 → AgentSession
```

**优点**：
- 类型安全，直接访问 Agent 状态
- 无进程间通信开销
- 可直接自定义工具、扩展、技能
- 完整的 SDK API 支持

**缺点**：
- 绑定 Node.js / Electron 生态
- Agent 崩溃可能影响整个应用

**适用场景**：Electron 桌面应用

### 方案 B：RPC 子进程模式（推荐 Tauri / 其他语言）

**原理**：通过 `pi --mode rpc` 启动 Pi 子进程，通过 stdin/stdout 的 JSONL 协议通信。

**架构**：
```
Tauri / 任意前端
  └─ spawn("pi", ["--mode", "rpc", "--no-session"])
       ├─ stdin  → JSON 命令 (prompt, steer, abort, ...)
       └─ stdout → JSON 事件 (message_update, tool_execution_*, ...)
```

**优点**：
- 语言无关（Python、Rust、Go 都可以用）
- 进程隔离，Agent 崩溃不影响主应用
- Pi 独立升级

**缺点**：
- 需要实现 JSONL 协议解析（注意：不能用 Node.js readline，要在 U+2028/U+2029 处分割）
- 进程间通信有序列化开销
- 部分高级功能需要通过命令间接访问

**适用场景**：Tauri、Flutter、原生应用、多语言集成

### 方案 C：JSON 事件流模式（最简单）

**原理**：`pi --mode json "your prompt"` 一次性输出所有事件为 JSON 行。

**适用场景**：简单的单次任务、CI/CD 集成、脚本自动化

---

## 四、桌面端 Agent Buddy 构建路线图

### 阶段 1：MVP — 基础聊天界面（1-2 周）

**目标**：一个能和 AI 对话的桌面应用

**技术选型建议**：
- **框架**：Electron + React（如果选 SDK 模式）或 Tauri + React（如果选 RPC 模式）
- **UI 库**：shadcn/ui 或 Ant Design
- **状态管理**：Zustand（轻量）或 Redux Toolkit

**实现步骤**：

1. **项目初始化**
   ```bash
   # Electron 方案
   npx create-electron-vite my-agent-buddy
   cd my-agent-buddy
   npm install @earendil-works/pi-coding-agent @earendil-works/pi-ai
   ```

2. **主进程：创建 Agent Session**
   ```typescript
   // main/agent.ts
   import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

   let session: AgentSession | null = null;

   export async function initAgent() {
     const modelRuntime = await ModelRuntime.create();
     const result = await createAgentSession({
       sessionManager: SessionManager.inMemory(),
       modelRuntime,
     });
     session = result.session;
     return session;
   }

   export async function prompt(text: string) {
     if (!session) throw new Error("Agent not initialized");
     await session.prompt(text);
   }
   ```

3. **主进程：事件转发到渲染进程**
   ```typescript
   // main/ipc.ts
   import { ipcMain, BrowserWindow } from "electron";

   export function setupAgentEvents(session: AgentSession, win: BrowserWindow) {
     session.subscribe((event) => {
       win.webContents.send("agent-event", event);
     });
   }
   ```

4. **渲染进程：聊天 UI**
   ```typescript
   // renderer/components/Chat.tsx
   import { useEffect, useState } from "react";
   import { ipcRenderer } from "electron";

   function Chat() {
     const [messages, setMessages] = useState([]);
     const [input, setInput] = useState("");

     useEffect(() => {
       const handler = (_event: any, data: any) => {
         if (data.type === "message_update") {
           const delta = data.assistantMessageEvent;
           if (delta.type === "text_delta") {
             // 流式追加文本
             setMessages(prev => updateLastMessage(prev, delta.delta));
           }
         }
       };
       ipcRenderer.on("agent-event", handler);
       return () => ipcRenderer.removeListener("agent-event", handler);
     }, []);

     const send = () => {
       if (!input.trim()) return;
       setMessages(prev => [...prev, { role: "user", content: input }]);
       ipcRenderer.invoke("agent-prompt", input);
       setInput("");
     };

     return (
       <div>
         <div className="messages">
           {messages.map((m, i) => (
             <div key={i} className={m.role}>{m.content}</div>
           ))}
         </div>
         <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()} />
       </div>
     );
   }
   ```

### 阶段 2：工具系统 — 文件操作和命令执行（2-3 周）

**目标**：Agent 可以读写文件、执行命令

**实现要点**：

1. **启用内置工具**
   ```typescript
   const { session } = await createAgentSession({
     tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
     sessionManager: SessionManager.inMemory(),
     modelRuntime,
   });
   ```

2. **工具执行 UI**：展示工具调用过程和结果
   ```typescript
   session.subscribe((event) => {
     if (event.type === "tool_execution_start") {
       // 显示 "正在执行: read file.txt..."
     }
     if (event.type === "tool_execution_end") {
       // 显示工具结果
     }
   });
   ```

3. **权限确认**（重要！）
   ```typescript
   const agent = new Agent({
     beforeToolCall: async ({ toolCall, args }) => {
       if (toolCall.name === "bash") {
         // 通过 IPC 请求用户确认
         const approved = await requestUserApproval(args.command);
         if (!approved) return { block: true, reason: "User denied" };
       }
     },
   });
   ```

### 阶段 3：会话管理 — 持久化和历史（1-2 周）

**目标**：保存对话历史，支持恢复和分支

**实现要点**：

1. **持久化会话**
   ```typescript
   const { session } = await createAgentSession({
     sessionManager: SessionManager.create(process.cwd()),
   });
   ```

2. **会话列表 UI**：侧边栏显示历史会话
3. **会话分支**：从历史消息创建分支
4. **上下文压缩**：自动压缩长对话

### 阶段 4：自定义工具和扩展（2-3 周）

**目标**：添加桌面端特有的工具和能力

**自定义工具示例**：
```typescript
import { defineTool, Type } from "@earendil-works/pi-coding-agent";

// 打开系统文件选择器
const openFilePicker = defineTool({
  name: "open_file_picker",
  label: "Open File Picker",
  description: "Open system file picker dialog",
  parameters: Type.Object({
    filters: Type.Optional(Type.Array(Type.Object({
      name: Type.String(),
      extensions: Type.Array(Type.String()),
    }))),
  }),
  execute: async (_id, params) => {
    const result = await electron.dialog.showOpenDialog({
      filters: params.filters,
      properties: ["openFile"],
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result.filePaths) }],
      details: {},
    };
  },
});

// 系统通知
const showNotification = defineTool({
  name: "show_notification",
  label: "Show Notification",
  description: "Show a system notification",
  parameters: Type.Object({
    title: Type.String(),
    body: Type.String(),
  }),
  execute: async (_id, params) => {
    new electron.Notification({ title: params.title, body: params.body }).show();
    return { content: [{ type: "text", text: "Notification sent" }], details: {} };
  },
});

const { session } = await createAgentSession({
  customTools: [openFilePicker, showNotification],
  tools: ["read", "bash", "open_file_picker", "show_notification"],
});
```

### 阶段 5：高级功能（3-4 周）

1. **多模型切换**：UI 上支持切换 LLM 提供商和模型
2. **技能系统**：加载自定义 SKILL.md 文件
3. **扩展系统**：加载 TypeScript 扩展
4. **主题系统**：自定义 UI 主题
5. **设置管理**：全局和项目级设置
6. **安全沙箱**：容器化执行（参考 Pi 的 Gondolin / Docker / OpenShell 方案）

---

## 五、安全注意事项

### 1. 权限系统

Pi 默认**无内置权限系统**，以启动它的用户权限运行。在桌面端应用中，你必须自己实现权限控制：

```typescript
const agent = new Agent({
  beforeToolCall: async ({ toolCall, args }) => {
    // 危险命令需要用户确认
    if (toolCall.name === "bash") {
      const dangerous = ["rm", "del", "format", "sudo", "chmod"];
      const isDangerous = dangerous.some(cmd => args.command.includes(cmd));
      if (isDangerous) {
        const approved = await requestUserApproval(
          `执行命令: ${args.command}`,
          "此命令可能危险，是否允许？"
        );
        if (!approved) return { block: true, reason: "User denied dangerous command" };
      }
    }
    // 文件写入需要确认
    if (toolCall.name === "write" || toolCall.name === "edit") {
      const approved = await requestUserApproval(
        `修改文件: ${args.path}`,
        "是否允许修改此文件？"
      );
      if (!approved) return { block: true, reason: "User denied file modification" };
    }
  },
});
```

### 2. API 密钥管理

- 不要在前端代码中硬编码 API 密钥
- 使用 `ModelRuntime` 的认证管理
- 支持 OAuth 流程（如 Anthropic Claude Pro 订阅）

### 3. 供应链安全

Pi 本身有很强的供应链加固：
- 依赖版本精确锁定
- `.npmrc` 设置 `save-exact=true` 和 `min-release-age=2`
- CI 使用 `npm ci --ignore-scripts`
- 发布包包含 shrinkwrap

你的应用也应该遵循类似实践。

---

## 六、与 WorkBuddy 的对比

| 维度 | Pi | WorkBuddy |
|------|-----|-----------|
| **定位** | Agent 底座 / 工具包 | 完整的 AI 桌面助手 |
| **UI** | 终端 TUI | 桌面 GUI |
| **语言** | TypeScript | TypeScript |
| **LLM 支持** | 30+ providers | 多 provider |
| **工具系统** | 内置 + 自定义 | 内置 + MCP + Skills |
| **权限系统** | 无（需自建） | 有 |
| **扩展机制** | TypeScript 扩展 | Skills + MCP |
| **会话管理** | SQLite + 分支 | 有 |
| **许可** | MIT | 专有 |

---

## 七、推荐技术栈

| 组件 | 推荐 | 理由 |
|------|------|------|
| **桌面框架** | Electron | Pi 是 TypeScript，SDK 直嵌最方便 |
| **前端框架** | React + Vite | 生态成熟，社区大 |
| **UI 库** | shadcn/ui | 美观、可定制、无运行时依赖 |
| **状态管理** | Zustand | 轻量，适合事件驱动的状态 |
| **Markdown 渲染** | react-markdown + remark-gfm | Agent 输出大量 Markdown |
| **代码高亮** | Shiki | 支持大量语言，VS Code 同款 |
| **终端模拟器** | xterm.js | 展示 bash 工具输出 |
| **图标** | Lucide React | 轻量美观 |

---

## 八、核心结论

1. **Pi 是构建桌面 Agent 的理想底座**：模块化设计、MIT 许可、30+ LLM 支持、完整的工具和扩展系统。

2. **推荐 SDK 直嵌模式**：如果你用 Electron，直接 `npm install @earendil-works/pi-coding-agent` 并通过 `createAgentSession()` API 集成，可获得最大的灵活性和类型安全。

3. **必须自建权限系统**：Pi 故意不内置权限控制，桌面应用必须通过 `beforeToolCall` 钩子实现用户确认流程。

4. **可渐进式构建**：从基础聊天 → 工具系统 → 会话管理 → 自定义工具 → 高级功能，逐步迭代。

5. **Pi 的 Skills 机制值得参考**：把"该怎么做某类任务"写成 Markdown 说明书，让 Agent 按需读取使用，而不是硬编码进核心。
