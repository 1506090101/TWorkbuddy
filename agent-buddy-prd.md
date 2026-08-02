# Agent Buddy — 产品需求文档 (PRD)

> 开发者专属的多 Agent AI 协作平台
> 基于 Pi Agent Harness · Electron · React
> **V2 需求基线**：以 [Agent Workbuddy 需求调整](agent-workbuddy-v2.md) 为工作台体验、会话、Composer 和目标能力的权威补充；本 PRD 的旧聊天表述保留为历史背景。

---

## V2 需求调整（当前开发基线）

### 产品定位

Agent Buddy 的产品形态是面向开发任务的 Agent Workbuddy，而不是通用 LLM 聊天工具。用户从项目和任务开始，选择 Agent、模型、文件、插件与目标；Agent 负责理解项目、调用工具、修改文件和执行验证，用户持续审查、确认、停止或干预。对话只承担任务输入、决策记录和结果回顾。

### 核心用户流程

`新建任务 → 选择项目/Agent/模型 → 添加图片或文本/代码文件 → 设置目标 → 选择插件上下文 → 发起工作 → 查看思考/工具/权限/变更/测试事件 → 确认或中止 → 查看结果并恢复会话`。

首轮文件支持图片、文本和代码文件；插件首轮提供入口和上下文模型，真实执行遵循 F1.6/F7.x。会话由主进程持久化，应用重启后必须可恢复。

### 工作台信息架构

| 区域 | V2 职责 |
|------|---------|
| 左侧工作导航 | 新建任务、会话列表、项目、Agent、插件等入口；会话显示运行和目标状态 |
| 顶部上下文栏 | 当前项目、会话标题、Agent、实际模型、目标状态 |
| 中央工作流 | 按时间展示任务、思考、工具调用、权限、文件变更、测试、错误和总结 |
| 底部 Composer | 多行输入、`+` 附件、模型、插件、目标、Thinking、发送/停止和上下文状态 |
| 右侧面板 | 目标、步骤、工具活动、文件变更、Agent 结果；可折叠且不绕过主进程 |

默认采用紧凑浅色工作台风格，保留深色主题能力。Codex Desktop 只作为信息架构和交互参考，不复制品牌、文案或像素级视觉。

### MVP 目标与验收

MVP 必须完成“新建任务到可审查结果”的垂直闭环：用户能选择 Agent/模型、添加文件/插件/目标，看到 Agent 工作过程，在关键操作处确认或干预，并在重启后恢复会话。所有状态变化均由主进程持久化并产生 `WorkEvent`，不能只更新 renderer 或伪装成聊天气泡。

### 概念模型

- `WorkSession`：项目、Agent、模型、目标、消息、附件和执行状态的持久化边界。
- `ComposerContext`：一次提交的模型、附件、插件、目标和会话覆盖配置。
- `Goal`：标题、描述、状态、步骤和完成结果，按会话保存。
- `WorkEvent`：消息、工具调用、权限请求、文件变更、测试、错误和总结事件。

### 迁移说明

原“聊天 UI”“InputBar”分别迁移为“Agent 工作流消息流”“Agent Composer”；旧聊天气泡、消息列表和 V1 技术方案仅保留为历史背景与兼容参考。已有 Provider、Vision 路由和 Agent Session 继续作为底座，新增需求不得破坏既有安全、持久化和 IPC 边界。

---

## 一、产品定位

### 1.1 一句话定义

Agent Buddy 是面向开发任务的本地 Agent 工作台：用户在一个可恢复的项目会话中组织目标、模型、文件、插件和工具，让 Agent 完成理解、执行、变更与验证，并在全过程保持可见、可审查、可中止和可继续。对话是任务输入和工作记录，不是产品的唯一体验。

### 1.2 核心差异化

| 维度 | ChatGPT/Claude 网页版 | Cursor/Copilot | OpenClaw/Hermes | Agent Buddy |
|------|----------------------|----------------|-----------------|-------------|
| 本地工具执行 | 不支持 | 有限（IDE 内） | 完整 | 完整（文件/终端/自定义/MCP） |
| 模型配置自由度 | 固定 Provider | 固定 Provider | 多模型 | 多厂商 + 中转 + Per-Agent + 视觉路由 |
| 多 Agent 协作 | 不支持 | 不支持 | 多 Agent 路由 | 自定义 Agent + 会话分支 + 目标编排 |
| 长期记忆 | 有限 | 无 | 有（Hermes 四层） | 项目级 + 用户级 + 行为学习 |
| 个人知识库 | 无 | 无 | 无 | RAG 检索 + 自动积累 + 可分享 |
| MCP 工具生态 | 不支持 | 不支持 | Hermes 支持 | 原生支持（MCP Server 自动发现注册） |
| 定时工作流 | 不支持 | 不支持 | Cron + Webhook | Cron + Webhook + 自然语言配置 |
| 消息平台集成 | 不支持 | 不支持 | 核心能力 | 微信/QQ/钉钉/飞书 + 跨渠道记忆 |
| 目标规划编排 | 不支持 | 不支持 | 有限 | 目标拆解 + 任务跟踪 + 子 Agent 委派 |
| 可扩展性 | 无 | 插件有限 | Skills + 插件 | Skills + 自定义工具 + Agent 定义 + MCP |

**V2 体验原则**：参考 Codex Desktop 的紧凑工作台信息架构，而非复制其界面；产品主界面以“工作导航 + 上下文栏 + 工作流时间线 + Agent Composer + 可折叠审查面板”为核心。

### 1.3 目标用户

- **主要用户**：开发者个人使用
- **使用场景**：功能开发、Bug 修复、代码审核、技术调研、知识管理、定时自动化、远程消息触发任务
- **核心诉求**：一个能记住上下文、能操作本地环境、能按需切换专家角色、能从消息平台远程调起、能定时自动工作的全场景 AI 伙伴

---

## 二、产品架构总览

```
┌─────────────────────────────────────────────────────┐
│            外部消息渠道层                             │
│  微信 │ QQ │ 钉钉 │ 飞书 │ 企业微信 │ Webhook / API  │
├─────────────────────────────────────────────────────┤
│            Gateway 网关                              │
│  渠道适配器 │ 消息路由 │ 会话映射 │ 凭据管理          │
├──────────────────────┬──────────────────────────────┤
│  定时工作流引擎       │     目标规划编排              │
│  Cron 调度器          │  目标拆解 │ 任务跟踪          │
│  Webhook 监听         │  顺序/并行/条件/子Agent委派   │
├──────────────────────┴──────────────────────────────┤
│                 Agent 编排层                         │
│  主 Agent │ 自定义 Agent │ 上下文路由 │ 会话分支      │
│  (Agent 定义：模型 + 提示 + 工具 + 触发 + Skills)     │
├──────────────────────┬──────────────────────────────┤
│    工具执行层         │        记忆 & 知识库          │
│  内置工具 + 自定义    │  项目记忆 │ 用户偏好           │
│  MCP 工具生态         │  会话摘要 │ 行为学习           │
│  Skills 扩展          │  知识库 RAG │ 自动积累        │
│  分级权限确认         │  跨渠道记忆连续               │
├──────────────────────┴──────────────────────────────┤
│            代码理解 & 变更管理层                      │
│  Git 集成 │ 代码知识图谱 (tree-sitter + SQLite) │ 项目感知 │
│  Diff 审查 + Checkpoint 回滚 │ 多文件变更追踪        │
│  错误/日志分析 │ 交互式终端 │ 沙箱执行 │ 重构辅助     │
│  多项目工作区 │ 跨项目参考与搜索                      │
├─────────────────────────────────────────────────────┤
│                 模型配置层                           │
│  Provider 注册表 │ 中转支持 │ 视觉路由 │ Per-Agent    │
│  Embedding 模型 (知识库向量化)                       │
├─────────────────────────────────────────────────────┤
│              Pi SDK 底座                             │
│  pi-ai (LLM 统一) │ pi-agent-core (循环) │ 工具系统  │
├─────────────────────────────────────────────────────┤
│           工程优化与体验保障层                        │
│  上下文预算管理 │ 成本可观测 │ 键盘工作流              │
│  大项目性能 │ Inline Apply │ 项目接入引导             │
│  测试工作流闭环 │ 插件生态与分享                       │
└─────────────────────────────────────────────────────┘
```

---

## 三、核心功能需求

### 3.1 模型配置系统

#### 3.1.1 多 Provider 注册表

- **支持的 Provider 类型**：OpenAI / Anthropic / DeepSeek / Gemini / Mistral / OpenRouter / Custom（OpenAI 兼容协议）
- **每个 Provider 实例独立配置**：
  - `id`: 唯一标识
  - `name`: 显示名称（如 "我的 OpenAI"、"中转站 A"）
  - `type`: Provider 类型枚举
  - `apiKey`: API 密钥（加密存储）
  - `baseURL`: 基础地址（留空 = 官方地址，填写 = 中转/代理）
  - `models[]`: 可用模型列表
  - `status`: connected / untested / error
- **用户可以添加任意数量的同类 Provider 实例**（如多个 OpenAI 中转站）

#### 3.1.2 模型探测与连接测试

- "Auto-detect" 按钮：调用 Provider 的 `/models` 接口自动获取可用模型列表
- "Test" 按钮：发送一个简单请求验证 API Key 和连接
- 状态实时显示：绿色（connected）、黄色（untested）、红色（error + 错误信息）

#### 3.1.3 视觉模型独立配置

- **独立配置 Vision Model**：与聊天模型分开，专门处理图片输入
- **自动路由机制**：
  - 用户消息含图片附件 → 自动切换到 Vision Model
  - 工具返回图片 → 自动切换到 Vision Model
  - 纯文本 → 使用 Chat Model
- **回退策略**：未配置 Vision Model 时，按 `fallbackToChatForImages` 设置决定是否回退到 Chat Model
- **InputBar 提示**：上传图片后显示当前将使用的 Vision Model 名称

#### 3.1.4 Per-Agent 模型分配

- 每个 Agent（主 Agent + 自定义 Agent）可以独立配置：
  - Chat Model（文本对话）
  - Vision Model（图片识别，可选）
  - Thinking Level（推理深度：off / low / medium / high）
- 模型分配在 Agent 定义中设置，也可在运行时临时切换
- **会话即时覆盖**：当前 `WorkSession` 可在 Agent Composer 中临时指定模型；仅影响该会话后续执行，优先级高于 Agent 默认分配，且必须显示生效来源与回退原因

#### 3.1.5 API Key 安全存储

- 使用 `electron-store` + `safeStorage` API 加密存储
- 运行时通过环境变量注入给 Pi-ai（`OPENAI_API_KEY`、`ANTHROPIC_API_KEY` 等）
- 永远不暴露给渲染进程

---

### 3.2 Agent 编排系统

#### 3.2.1 Agent 定义模型

每个 Agent 由以下维度定义：

| 维度 | 说明 | 示例 |
|------|------|------|
| `id` | 唯一标识 | `code-reviewer` |
| `name` | 显示名称 | "代码审核专家" |
| `description` | 简短描述 | "审核代码变更，给出改进建议" |
| `modelAssignment` | 模型配置 | Chat: Claude Sonnet, Vision: GPT-4o |
| `systemPrompt` | 系统提示词 | "你是一个严谨的代码审核专家..." |
| `tools[]` | 可用工具范围 | `["read", "grep", "ls"]`（只读工具） |
| `skills[]` | 加载的 Skills | `["code-review-standards.md"]` |
| `triggers` | 触发条件 | 手动 / 关键词触发 / 事件触发 |
| `icon` | 图标 | Lucide 图标名 |
| `color` | 主题色 | 用于 UI 区分 |
| `isDefault` | 是否为主 Agent | 主 Agent 只能有一个 |

#### 3.2.2 Agent 定义格式：表单 + Markdown 混合

**双向同步机制**：
- UI 表单：可视化创建和编辑，适合快速配置
- Markdown 文件：可导出、可版本管理、可分享
- 修改任一方自动同步另一方

**Markdown 格式示例**：
```markdown
---
id: code-reviewer
name: 代码审核专家
description: 审核代码变更，给出改进建议
model:
  chat: anthropic/claude-sonnet-4
  vision: openai/gpt-4o
  thinking: medium
tools: [read, grep, ls]
skills: [code-review-standards.md]
triggers: [manual]
icon: shield-check
color: "#534AB7"
---

# 代码审核专家

你是一个严谨的代码审核专家。你的职责是：

1. 检查代码质量和可读性
2. 发现潜在的安全问题
3. 验证逻辑正确性
4. 给出具体的改进建议

## 审核标准

- 命名规范一致性
- 错误处理完整性
- 性能影响评估
- 测试覆盖建议
```

#### 3.2.3 会话模型：主会话 + 子分支

**Git 分支模型**：
```
主会话 (main)
  ├── 用户："帮我实现用户登录功能"
  ├── 主 Agent：读代码 → 写代码 → 运行测试
  │
  ├── 分支: code-review-001 (从主会话分出)
  │   ├── 上下文：智能摘要（任务目标 + 修改的文件 + 关键决策）
  │   ├── Review Agent：审核代码 → 输出意见
  │   └── 回注主会话：审核结果作为消息插入
  │
  └── 主 Agent：根据审核意见继续修改
```

**分支规则**：
- 拉起 Agent 时自动创建子分支
- 子分支继承主会话的智能摘要上下文
- 子分支的输出可以"合并"回主会话（作为新消息）
- 子分支也可以独立查看和继续对话
- 分支树可视化：在侧边面板展示分支关系

#### 3.2.4 上下文智能路由

**摘要策略**：
- **任务目标**：提取当前会话的主要任务和目标
- **关键文件**：最近修改/读取的文件路径和摘要
- **重要决策**：用户做出的选择和理由
- **最近上下文**：最近 N 条消息的原文
- **工具调用结果**：关键工具调用的摘要

**路由时机**：
- Agent 被拉起时（主 → 子）
- Agent 结果回注时（子 → 主）
- 用户手动选择上下文范围时

**实现方式**：
- 使用一个轻量级 LLM 调用生成摘要（可以用较便宜的模型）
- 摘要结果缓存在分支元数据中
- 用户可以查看和编辑摘要内容

#### 3.2.5 Agent 结果展示：可切换

- **主对话模式**：Agent 结果作为消息插入主对话流，主 Agent 和用户都能看到，可以据此继续工作
- **侧边面板模式**：Agent 结果在右侧面板独立展示，不干扰主对话流，用户自行决定是否让主 Agent 处理
- 用户可以在设置中切换默认模式，也可以每次调用时临时选择

#### 3.2.6 预设 Agent

产品内置以下预设 Agent（用户可修改/删除）：

| Agent | 用途 | 默认模型 | 工具范围 |
|-------|------|---------|---------|
| 主 Agent | 日常开发、编码、执行 | 用户配置 | 全部工具 |
| 代码审核 | 审核代码变更 | Claude Sonnet | 只读工具 |
| 测试生成 | 根据代码生成测试 | GPT-4o | 读 + 写 |
| 文档生成 | 生成/更新文档 | GPT-4o | 读 + 写 |

---

### 3.3 工具执行系统

#### 3.3.1 分级权限模型

| 级别 | 操作类型 | 行为 | 示例 |
|------|---------|------|------|
| 自动放行 | 只读操作 | 直接执行，不弹确认 | `read`、`ls`、`grep`、`find` |
| 需确认 | 写操作 | 弹出确认对话框，显示命令和影响 | `write`、`edit` |
| 需确认 | 删除操作 | 弹出确认 + 额外警告 | `bash: rm` |
| 需确认 | 命令执行 | 弹出确认，显示完整命令 | `bash` |

**确认 UI**：
- 显示：工具名 + 参数 + 预期影响
- 操作：允许 / 拒绝 / 允许并记住（本次会话不再确认同类操作）
- 快捷键：Enter 确认 / Esc 拒绝

#### 3.3.2 内置工具

基于 Pi SDK 的内置工具：
- `read` — 读取文件
- `write` — 写入文件
- `edit` — 编辑文件（精确替换）
- `bash` — 执行终端命令
- `grep` — 内容搜索
- `find` — 文件搜索
- `ls` — 目录列表

#### 3.3.3 自定义工具

用户可以定义自定义工具（通过 JavaScript/TypeScript 脚本）：
```typescript
// 自定义工具示例：打开浏览器
export default {
  name: "open-browser",
  description: "在默认浏览器中打开 URL",
  parameters: {
    url: { type: "string", description: "要打开的 URL" }
  },
  permissions: "auto", // auto / confirm
  execute: async (params) => {
    await shell.openExternal(params.url);
    return { success: true };
  }
};
```

#### 3.3.4 Skills 系统

- **格式**：Markdown 文件，包含 frontmatter 元数据 + 指令正文
- **加载方式**：Agent 定义中指定要加载的 Skills
- **作用**：为 Agent 提供特定领域的知识和行为指令
- **管理**：在设置中心浏览、启用/禁用、编辑 Skills
- **分享**：Skills 文件可直接分享，放入指定目录即可加载

---

### 3.4 记忆系统

#### 3.4.1 记忆层级

| 层级 | 范围 | 存储位置 | 内容 | 注入时机 |
|------|------|---------|------|---------|
| 项目级记忆 | 当前项目 | 项目 `.agentbuddy/memory/` | 架构决策、技术栈、编码规范、关键文件 | 会话开始时自动注入 |
| 用户级偏好 | 全局 | `~/.agentbuddy/memory/` | 编码习惯、工具链偏好、交互风格 | 每次会话注入 |
| 会话摘要 | 单次会话 | 会话存储 | 本次会话做了什么、关键结果 | 下次打开时展示 |
| 行为学习 | 全局 | `~/.agentbuddy/learning/` | 采纳/拒绝的模式、频率统计 | Agent 决策时参考 |

#### 3.4.2 记忆写入规则

**自动写入**：
- 完成重要工作后（文件修改、Bug 修复、架构决策）→ 追加到项目级日志
- 用户明确表达偏好时（"以后都用 tabs"、"不要加分号"）→ 更新用户级偏好
- Agent 建议被采纳/拒绝时 → 更新行为学习

**主动建议**：
- Agent 检测到有价值信息时，主动提示："这个决策很重要，要记住吗？"
- 用户确认后写入对应层级的记忆

**用户手动管理**：
- 在设置中心查看、编辑、删除所有层级的记忆
- 可以手动添加记忆条目

#### 3.4.3 记忆注入机制

```
会话开始
  ├── 读取项目级记忆 → 注入为 system context
  ├── 读取用户级偏好 → 注入为 system context
  └── 读取相关行为学习 → 调整 Agent 行为参数

会话进行中
  ├── Agent 决策时查询行为学习（"上次类似操作用户怎么选的"）
  └── 重要节点触发记忆写入
```

---

### 3.5 个人知识库

#### 3.5.1 知识库架构

```
个人知识库
  ├── 自动积累层
  │   ├── Agent 工作中提取的有价值信息
  │   ├── 代码模式、解决方案、踩坑记录
  │   └── 架构决策、技术选型理由
  │
  ├── 用户管理层
  │   ├── 手动添加的文档、笔记、代码片段
  │   ├── 网页链接 + 自动抓取摘要
  │   └── 用户修正/补充的内容
  │
  ├── 索引层
  │   ├── 向量化嵌入（Embedding）
  │   ├── 全文索引（FTS）
  │   └── 标签/分类系统
  │
  └── 检索层
      ├── 语义搜索（RAG）
      ├── 关键词搜索
      └── 关联推荐
```

#### 3.5.2 知识库用途

1. **增强回答质量**
   - Agent 回答问题前先检索知识库
   - 将相关知识作为上下文注入
   - 避免重复犯错，复用已有经验

2. **主动提醒/建议**
   - 检测到当前任务与知识库中的历史记录相关时，主动提醒
   - "上次你遇到类似问题时用了 X 方案，要参考吗？"
   - 在代码审核时引用团队规范

3. **用户直接查阅**
   - 知识库浏览界面：按分类/标签/时间浏览
   - 全文搜索 + 语义搜索
   - 知识卡片展示：标题 + 摘要 + 关联项目 + 来源

4. **可分享复用**
   - 导出为 JSON/Markdown 包
   - 导入他人的知识包
   - 选择性分享（按分类/标签筛选）

#### 3.5.3 自动积累机制

**触发时机**：
- Agent 解决了一个复杂问题
- 用户确认了某个架构决策
- 发现了一个可复用的代码模式
- 踩了一个值得记录的坑

**提取方式**：
- Agent 在完成工作后，主动评估是否有值得记住的内容
- 如果有，生成知识卡片草稿
- 提示用户："这个经验可能有价值，要我记住吗？"
- 用户可以编辑后确认，或拒绝

**知识卡片结构**：
```typescript
interface KnowledgeCard {
  id: string;
  title: string;           // 简短标题
  content: string;         // Markdown 正文
  category: string;        // 分类（如 "前端"、"数据库"、"DevOps"）
  tags: string[];          // 标签
  source: "auto" | "manual"; // 来源
  sourceSession?: string;  // 来源会话 ID
  sourceProject?: string;  // 来源项目
  createdAt: number;
  updatedAt: number;
  embedding?: number[];    // 向量嵌入
}
```

#### 3.5.4 向量化与检索

- **Embedding 模型**：使用配置的 Provider 的 embedding API（如 `text-embedding-3-small`）
- **存储**：SQLite + 向量扩展（或本地文件存储向量）
- **检索流程**：
  1. 用户/Agent 发起查询
  2. 生成查询向量
  3. 向量相似度搜索（余弦相似度）+ 全文搜索
  4. 合并排序结果
  5. 返回 Top-K 相关知识卡片
- **注入策略**：检索结果作为 system context 注入，不干扰对话流

---

### 3.6 会话管理

#### 3.6.1 会话模型

```
工作区 (Workspace) — 绑定项目目录
  ├── WorkSession 列表
  │   ├── 任务标题 / 最近活动 / 运行状态 / 当前目标
  │   ├── Agent、模型和 Thinking 的会话覆盖
  │   ├── 工作流时间线：消息、工具、权限、变更、测试、总结
  │   └── 分支：review-001 / test-gen-001 / ...
  ├── 项目记忆（持久化）
  └── 项目配置（模型、Agent、工具、插件）
```

#### 3.6.2 会话持久化

- 会话由**主进程**负责持久化和恢复；具体存储实现可从轻量配置存储演进到 SQLite，但渲染进程不得成为唯一事实来源。
- 会话包含：项目引用、目标、Agent 与模型覆盖、消息/工作事件、附件元数据、工具调用、权限决策、文件变更、验证结果、分支关系和元数据。
- 支持会话搜索（全文 + 语义）和导出（JSON / Markdown），后续阶段补齐。

#### 3.6.3 会话分支操作

| 操作 | 说明 |
|------|------|
| 创建分支 | 从当前会话分出子分支，继承上下文摘要 |
| 合并回主 | 子分支的结果作为消息插入主会话 |
| 查看分支 | 在分支树中浏览所有分支 |
| 继续分支 | 在子分支中继续对话（不合并回主） |
| 删除分支 | 删除子分支（主会话不受影响） |

---

### 3.7 UI 设计

#### 3.7.1 整体布局

```
┌───────────────────────────────────────────────────────────────────┐
│ 应用栏：项目 / 当前任务 / Agent / 模型 / 全局操作                  │
├──────────────┬────────────────────────────────┬───────────────────┤
│ 工作导航     │ Agent 工作流时间线              │ 上下文审查面板    │
│ 新建任务     │ 用户指令 / Agent 输出 / 思考    │ 目标与步骤        │
│ 会话列表     │ 工具调用 / 权限 / 文件变更      │ 工具活动          │
│ 项目/Agent   │ 测试结果 / 错误 / 最终总结      │ 文件变更/结果     │
├──────────────┴────────────────────────────────┴───────────────────┤
│ Agent Composer：+ 文件 | 模型 | 插件 | 目标 | Thinking | 发送/停止 │
└───────────────────────────────────────────────────────────────────┘
```

#### 3.7.2 UI 风格

- **整体风格**：紧凑、克制、面向重复工作的桌面工作台；默认浅色，保留深色主题。
- **时间线优先**：用户指令可保持简洁，Agent 输出以内容为主；工具、权限、变更和测试使用清晰的状态行与可展开记录，不营造“连续聊天气泡”体验。
- **上下文可见**：当前项目、任务、Agent、模型、目标和运行状态在不打断工作流的位置持续可见。
- **操作优先**：模型、文件、插件、目标、发送和停止通过 Composer 的图标、菜单和选择器完成；按钮使用图标和 Tooltip，不使用大面积说明文字。
- **审查优先**：文件变更、工具参数、权限影响和测试结果必须可定位、可展开、可确认或拒绝。

#### 3.7.3 设置中心

设置中心是一个多 Tab 页面：

1. **Provider 管理**：添加/编辑/删除 Provider，测试连接，模型探测
2. **模型分配**：为每个 Agent 分配 Chat/Vision 模型
3. **Agent 管理**：创建/编辑/删除自定义 Agent，导入/导出 Agent 定义
4. **Skills 管理**：浏览/启用/禁用/编辑 Skills
5. **知识库**：浏览/搜索/编辑/删除知识卡片，导入/导出
6. **记忆管理**：查看/编辑各层级记忆
7. **工具权限**：配置工具权限级别，管理自定义工具
8. **外观**：主题、字体、快捷键
9. **MCP 服务器**：添加/编辑/删除 MCP Server，查看已注册工具
10. **工作流**：创建/编辑/启用/禁用定时工作流，查看执行历史
11. **消息渠道**：配置各平台 Bot 凭据，渠道-Agent 路由映射，测试连接

---

### 3.8 MCP 工具生态

#### 3.8.1 MCP 集成方案

Pi 核心不内置 MCP 支持（认为 MCP Server 会膨胀上下文），但通过扩展系统可以添加。Agent Buddy 的方案是构建一个 MCP 客户端扩展，将外部 MCP Server 的工具自动注册为 Pi 工具。

#### 3.8.2 MCP 配置

配置文件 `~/.agentbuddy/config/mcp.json`（与 Claude Desktop / WorkBuddy 格式兼容）：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_xxx" }
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "path/to/db"],
      "env": {}
    }
  }
}
```

#### 3.8.3 MCP 工具注册流程

```
应用启动
  ├── 读取 mcp.json 配置
  ├── 为每个 MCP Server 创建子进程 (stdio 通信)
  ├── 调用 tools/list 发现可用工具
  ├── 为每个 MCP 工具调用 pi.registerTool() 注册
  ├── 工具执行时：转发参数到 MCP Server → 获取结果 → 返回
  └── 应用关闭时：清理所有 MCP 子进程
```

#### 3.8.4 MCP 工具权限

- MCP 工具默认归入"需确认"权限级别
- 用户可以在设置中为每个 MCP Server 配置权限级别（自动放行 / 需确认 / 禁用）
- 工具描述中标注来源 MCP Server，便于区分

#### 3.8.5 MCP 资源与提示

- **Resources**：MCP Server 暴露的资源（如文件、数据库表）可在 UI 中浏览
- **Prompts**：MCP Server 提供的提示模板可通过 `/` 命令调用

---

### 3.9 定时工作流引擎

#### 3.9.1 工作流定义

```typescript
interface Workflow {
  id: string;
  name: string;
  description: string;
  
  // 触发方式
  trigger: {
    type: "cron" | "webhook" | "event";
    // cron 模式
    schedule?: string;         // cron 表达式，如 "0 9 * * *" (每天9点)
    naturalLanguage?: string;  // 自然语言描述，如 "每天早上9点"
    // webhook 模式
    webhookPath?: string;      // 如 "/workflow/daily-report"
    // event 模式
    eventCondition?: string;   // 如 "on:file-change:path=/src/**/*.ts"
  };
  
  // 执行配置
  agentId: string;             // 使用哪个 Agent
  prompt: string;              // 任务指令
  workspaceId?: string;        // 工作区（项目）
  
  // 输出配置
  output: {
    channels: OutputChannel[]; // 输出到哪里
    format: "text" | "markdown" | "json";
  };
  
  // 状态
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
}

interface OutputChannel {
  type: "desktop-notification" | "dingtalk" | "wechat" | "qq" | "feishu" | "file" | "none";
  target?: string;  // 平台目标（如群 ID、文件路径）
}
```

#### 3.9.2 Cron 调度器

- 使用 `node-cron` 在主进程中运行调度器
- 支持标准 cron 表达式 + 自然语言配置（通过 LLM 将自然语言转为 cron）
- 调度器在应用启动时自动恢复所有已启用的工作流
- 工作流执行时创建新的 Agent Session（或在已有会话中继续）

#### 3.9.3 Webhook 监听

- 内置 HTTP 服务器（可选端口，默认 18999）
- 每个工作流分配唯一的 webhook 路径
- 支持 GET / POST 请求
- 可用于：CI/CD 通知、GitHub Webhook、外部系统触发

#### 3.9.4 工作流管理 UI

- 工作流列表：显示名称、触发方式、下次运行时间、状态
- 创建/编辑表单：触发条件、Agent 选择、任务输入、输出渠道
- 执行历史：每次运行的时间、耗时、结果摘要、完整日志
- 日志查看：展开查看 Agent 的完整执行过程

#### 3.9.5 典型用例

| 场景 | 触发方式 | Agent | 输出 |
|------|---------|-------|------|
| 每日代码审查报告 | Cron `0 18 * * *` | 代码审核 Agent | 钉钉群 + 桌面通知 |
| PR 合并后跑测试 | Webhook `/pr-merged` | 测试 Agent | GitHub 评论 + 文件 |
| 监控文件变化 | Event `on:file-change` | 文档 Agent | 飞书消息 |
| 每周项目摘要 | Cron `0 9 * * 1` | 主 Agent | 微信 + 文件 |

---

### 3.10 目标规划编排

#### 3.10.1 目标拆解模型

用户给出高层目标，Agent 自动拆解为可执行的子任务序列：

```
用户："帮我实现完整的用户登录注册功能"

Agent 拆解：
  Task 1: 分析现有项目结构和认证相关代码 [pending]
  Task 2: 设计用户数据模型和 API 接口 [pending, depends: 1]
  Task 3: 实现后端注册 API [pending, depends: 2]
  Task 4: 实现后端登录 API + JWT 签发 [pending, depends: 2]
  Task 5: 实现前端注册页面 [pending, depends: 3]
  Task 6: 实现前端登录页面 [pending, depends: 4]
  Task 7: 编写单元测试 [pending, depends: 3,4]
  Task 8: 集成测试 + 端到端验证 [pending, depends: 5,6,7]
```

#### 3.10.2 任务跟踪系统

**自定义工具集**（注册到 Pi）：

| 工具 | 用途 |
|------|------|
| `plan` | 创建任务计划，传入目标，返回任务列表 |
| `create_task` | 创建单个子任务 |
| `update_task` | 更新任务状态（pending → in_progress → completed → blocked） |
| `get_tasks` | 获取当前任务列表和状态 |
| `delegate_task` | 将子任务委派给另一个 Agent（子 Agent 执行） |

**任务状态**：
- `pending` — 等待执行
- `in_progress` — 正在执行
- `completed` — 已完成
- `blocked` — 被阻塞（等待依赖或用户输入）
- `failed` — 执行失败

#### 3.10.3 编排策略

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| 顺序执行 | 按依赖关系依次执行 | 有严格依赖的任务链 |
| 并行执行 | 独立任务同时执行 | 无依赖的独立任务 |
| 条件分支 | 根据上一步结果选择路径 | 需要判断的流程 |
| 子 Agent 委派 | 将子任务交给专门的 Agent | 需要专家角色的任务 |

#### 3.10.4 UI 展示

- **任务面板**：在主对话区右侧或底部展示当前任务列表
- **进度条**：显示整体完成度
- **任务卡片**：点击展开查看详情（子任务、工具调用、结果）
- **实时更新**：Agent 执行任务时实时更新状态
- **手动干预**：用户可以跳过、重新排序、修改任务

---

### 3.11 消息平台网关 (Gateway)

#### 3.11.1 架构设计

参考 OpenClaw 的 Gateway 架构，Agent Buddy 内置一个消息网关服务：

```
外部消息渠道
  │
  ├── 微信 (企业微信自建应用 / iPad 协议)
  ├── QQ (QQ Bot API, WebSocket)
  ├── 钉钉 (Stream 模式, WebSocket)
  ├── 飞书 (事件订阅, WebSocket)
  └── Webhook (通用 HTTP 接口)
  │
  ▼
Gateway 网关 (Electron 主进程后台服务)
  ├── 渠道适配器 — 各平台协议封装
  ├── 消息路由 — 外部消息 → Agent 映射
  ├── 会话映射 — 外部 ID ↔ 内部会话
  ├── 凭据管理 — Bot Token 加密存储
  └── 消息格式转换 — 各平台格式 ↔ 统一内部格式
  │
  ▼
Agent 运行时
  ├── 创建/复用会话
  ├── 注入跨渠道记忆
  ├── 执行任务
  └── 返回结果 → Gateway → 渠道适配器 → 发回消息
```

#### 3.11.2 各平台接入方案

| 平台 | 接入方式 | 是否需要公网 IP | 消息能力 | 复杂度 |
|------|---------|---------------|---------|--------|
| 钉钉 | Stream 模式 (WebSocket) | 否 | 文本/Markdown/图片/文件/流式 | 简单 |
| QQ | QQ Bot API (WebSocket) | 否 | 文本/Markdown/图片/文件 | 简单 |
| 企业微信(智能机器人) | 长连接 (WebSocket) | 否 | 文本/Markdown/图片/文件 | 简单 |
| 企业微信(自建应用) | 回调 + 主动发送 | 是 | 全功能 + 可接入微信 | 中等 |
| 飞书 | 事件订阅 (WebSocket) | 否 | 文本/Markdown/图片/文件 | 中等 |
| 微信(个人) | 通过企业微信 或 iPad 协议 | 视方案 | 文本/图片 | 高风险 |
| Webhook | 通用 HTTP | 是 | 自定义 | 简单 |

#### 3.11.3 渠道-Agent 路由

```typescript
interface ChannelConfig {
  id: string;
  platform: "dingtalk" | "qq" | "wecom" | "feishu" | "wechat" | "webhook";
  name: string;
  credentials: {
    // 各平台不同的凭据字段
    appId?: string;
    appSecret?: string;
    token?: string;
    encodingAESKey?: string;
    botId?: string;
  };
  
  // 路由规则
  routing: {
    // 默认处理 Agent
    defaultAgentId: string;
    // 按来源路由（可选）
    rules?: RoutingRule[];
  };
  
  // 消息处理
  messageHandling: {
    // 群聊是否只响应 @机器人
    groupMentionOnly: boolean;
    // 是否接受图片/文件
    acceptMedia: boolean;
    // 流式响应（逐字推送）
    streaming: boolean;
  };
  
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
}

interface RoutingRule {
  condition: {
    type: "keyword" | "sender" | "group";
    value: string;
  };
  agentId: string;
}
```

#### 3.11.4 会话映射

```
微信用户 "张三" 发消息 → Gateway 收到
  ├── 查找会话映射: { platform: "wechat", externalId: "zhangsan" } → sessionId: "sess_001"
  ├── 如果不存在 → 创建新会话 + 注入用户偏好记忆
  ├── 在会话中执行 Agent
  └── 结果通过渠道适配器发回微信

张三切换到桌面端打开 Agent Buddy
  ├── 桌面端加载 sess_001（同一会话）
  └── 看到完整的对话历史（包括微信中的消息）
```

#### 3.11.5 跨渠道记忆

- 记忆系统标记来源渠道：`memory.sourceChannel = "wechat"`
- Agent 在桌面端可以看到："这个偏好是你在微信里告诉我的"
- 会话历史统一存储，消息标注来源渠道
- 跨渠道上下文连续：微信里说"帮我看看那个 bug"，桌面端打开能看到完整上下文

#### 3.11.6 安全模型

- **DM 策略**（参考 OpenClaw）：
  - `pairing`（默认）：未知发送人收到配对码，需在桌面端确认
  - `open`：接受所有人消息
  - `closed`：不接受外部消息
- **群聊安全**：默认只响应 @机器人
- **工具权限降级**：通过消息渠道触发的 Agent 会话，工具权限自动降级为更严格级别
- **凭据加密**：所有 Bot Token 使用 `safeStorage` 加密存储

---

### 3.12 代码理解与 Git 集成

#### 3.12.1 Git 深度集成

Agent 必须语义化地理解版本控制状态，而非仅通过 `bash` 跑 git 命令。注册专门的 Git 工具集：

```typescript
interface GitTools {
  // 状态感知
  gitStatus: () => Promise<GitStatus>;
  gitBranch: () => Promise<{ current: string; remote: string; tracking: boolean }>;
  gitLog: (opts: { limit: number; file?: string; author?: string }) => Promise<CommitInfo[]>;
  gitBlame: (file: string, startLine: number, endLine: number) => Promise<BlameInfo[]>;
  
  // 差异理解
  gitDiff: (opts: { staged: boolean; file?: string }) => Promise<DiffResult>;
  gitShow: (commitHash: string) => Promise<{ commit: CommitInfo; diff: DiffResult }>;
  
  // 操作
  gitCommit: (message: string, files?: string[]) => Promise<{ hash: string }>;
  gitCreateBranch: (name: string, from?: string) => Promise<void>;
  gitCheckout: (branch: string) => Promise<void>;
  gitStash: (message?: string) => Promise<void>;
  gitStashPop: () => Promise<void>;
  
  // PR（需配置远程平台 Token）
  gitCreatePR: (opts: { title: string; body: string; base: string; head: string }) => Promise<{ url: string }>;
}

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  totalChanges: number;
}

interface CommitInfo {
  hash: string;
  author: string;
  date: number;
  message: string;
  files: string[];
}
```

**关键设计**：
- 会话启动时自动执行 `gitStatus`，将结果注入 Agent 上下文（作为 system context）
- Agent 能区分"已提交代码"和"工作区改动"，理解用户当前在做什么
- 提交信息自动生成：基于 diff 内容调用 LLM 生成规范的 commit message
- PR 创建支持 GitHub / GitLab / Gitea，Token 通过 Provider 配置中的 `type: "git-platform"` 管理

#### 3.12.2 代码知识图谱（Code Knowledge Graph）

**核心思想**：预先将项目代码解析为知识图谱（节点 + 关系 + 摘要），Agent 查询时先查图谱获取结构和关系，只在需要具体实现时才读取代码段。相比传统"Agent 直接读文件"方式节省 90%+ token。

##### 图谱数据结构

```typescript
// 文件节点
interface FileNode {
  id: string;                    // 文件路径 hash
  path: string;                  // 相对项目根路径
  language: string;              // typescript, python, rust...
  lines: number;                 // 总行数
  lastModified: number;          // 文件修改时间戳
  lastIndexed: number;           // 最后索引时间戳
  summary: string;               // AI 生成的文件摘要（1-3 句话）
  exports: string[];             // 导出的符号 ID 列表
  imports: string[];             // 依赖的文件 ID 列表
  hash: string;                  // 文件内容 hash（用于增量更新判断）
}

// 符号节点
interface SymbolNode {
  id: string;                    // `${filePath}:${name}:${type}`
  name: string;                  // 符号名
  type: "function" | "class" | "method" | "variable" | "interface" | "type" | "enum" | "constant";
  filePath: string;              // 所属文件
  location: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  signature: string;             // 函数签名 / 类定义头
  modifiers: string[];           // public, private, static, async, export...
  docstring?: string;            // JSDoc / docstring / 注释
  summary: string;               // AI 生成的符号摘要
  complexity?: number;           // 圈复杂度（函数）
  parameters?: ParamInfo[];      // 函数参数
  returnType?: string;           // 返回类型
}

// 关系边
interface RelationshipEdge {
  id: string;
  type: "CALLS" | "IMPORTS" | "EXPORTS" | "EXTENDS" | "IMPLEMENTS" | "REFERENCES" | "DEPENDS_ON" | "OVERRIDES";
  source: string;                // 源节点 ID（符号或文件）
  target: string;                // 目标节点 ID
  sourceLocation?: {             // 关系出现的位置
    line: number;
    column: number;
  };
  metadata?: Record<string, any>; // 额外信息（如调用参数数量等）
}

// 图谱查询结果（返回给 Agent 的格式）
interface GraphQueryResult {
  symbols: SymbolSummary[];      // 符号摘要（不含完整代码）
  relationships: RelationshipSummary[];
  suggestedReads: {              // 建议进一步读取的代码段
    filePath: string;
    startLine: number;
    endLine: number;
    reason: string;              // 为什么建议读这段
  }[];
}

interface SymbolSummary {
  name: string;
  type: string;
  filePath: string;
  lineRange: [number, number];
  signature: string;
  summary: string;
}
```

##### 索引构建流程

```
首次打开项目
  ├── 1. 扫描文件（递归遍历 + .gitignore 过滤）
  │     ├── 按语言分组（.ts/.tsx → TS, .py → Python...）
  │     └── 跳过：node_modules/, dist/, .git/, build/ 等
  │
  ├── 2. AST 解析（tree-sitter）
  │     ├── 每个文件 → tree-sitter 解析 → AST
  │     ├── 提取符号定义（函数/类/方法/变量/接口/枚举）
  │     ├── 提取符号关系（调用/导入/继承/实现/引用）
  │     └── 计算圈复杂度、签名、参数列表
  │
  ├── 3. 摘要生成（批量异步，不阻塞索引）
  │     ├── 文件级摘要：用 LLM 生成 1-3 句话描述文件职责
  │     ├── 符号级摘要：关键符号（exported functions/classes）生成摘要
  │     └── 可配置：大项目可跳过符号级摘要，只做文件级
  │
  ├── 4. 写入图存储
  │     ├── FileNode → SQLite files 表
  │     ├── SymbolNode → SQLite symbols 表
  │     ├── RelationshipEdge → SQLite edges 表
  │     └── 建立 FTS5 全文索引（符号名搜索）
  │
  └── 5. 后台渐进式构建
        ├── 首次索引不阻塞 UI（进度条显示）
        ├── 优先索引入口文件和被引用最多的文件
        └── 大项目支持分批索引
```

##### 增量更新机制

```typescript
// 文件保存时触发增量更新
async function onFileChanged(filePath: string): Promise<void> {
  const newHash = hashFile(filePath);
  const existing = await db.getFileNode(filePath);
  
  if (existing && existing.hash === newHash) return; // 未变化
  
  // 1. 删除旧节点和关联边
  await db.deleteSymbolsByFile(filePath);
  await db.deleteEdgesByFile(filePath);
  
  // 2. 重新解析该文件
  const { symbols, edges } = await parseWithTreeSitter(filePath);
  
  // 3. 更新文件节点
  await db.upsertFileNode({
    path: filePath,
    hash: newHash,
    lastIndexed: Date.now(),
    // ...
  });
  
  // 4. 写入新符号和边
  await db.insertSymbols(symbols);
  await db.insertEdges(edges);
  
  // 5. 异步更新摘要（如果文件变化较大）
  if (shouldRegenerateSummary(existing, newHash)) {
    queueSummaryUpdate(filePath);
  }
  
  // 6. 更新跨文件引用（其他文件引用了此文件的符号）
  await updateCrossFileReferences(filePath);
}
```

**增量更新触发时机**：
- 文件保存时（Agent 的 `edit`/`write` 工具执行后）
- Git checkout / branch 切换时（批量更新变化文件）
- 项目重新打开时（对比 hash，只更新变化的文件）
- 手动"重建索引"按钮

##### Agent 查询工具集

注册为 Pi 自定义工具，Agent 通过这些工具查询图谱而非直接读文件：

```typescript
interface KnowledgeGraphTools {
  // 符号搜索
  search_symbols: (query: string, opts?: {
    type?: SymbolType;
    filePath?: string;          // 限定文件范围
    limit?: number;
  }) => Promise<SymbolSummary[]>;
  
  // 引用查找
  find_references: (symbolName: string, opts?: {
    filePath?: string;          // 限定在某个文件中查找
    project?: string;           // 跨项目工作区中指定项目
  }) => Promise<ReferenceLocation[]>;
  
  // 调用图
  get_call_graph: (symbolName: string, opts?: {
    direction: "callers" | "callees" | "both";
    depth: number;              // 遍历深度，默认 2
    project?: string;
  }) => Promise<CallGraphNode[]>;
  
  // 文件摘要
  get_file_summary: (filePath: string) => Promise<{
    summary: string;
    symbols: SymbolSummary[];
    imports: string[];
    exportedBy: string[];
  }>;
  
  // 依赖关系
  get_dependencies: (filePath: string, direction: "imports" | "imported_by") => Promise<string[]>;
  
  // 变更影响分析
  get_impact_analysis: (filePath: string) => Promise<{
    directDependents: string[];   // 直接依赖此文件的文件
    transitiveDependents: string[]; // 间接依赖的文件
    affectedSymbols: string[];    // 受影响的符号
  }>;
  
  // 按行范围读取代码（只在需要时调用）
  read_code_range: (filePath: string, startLine: number, endLine: number) => Promise<{
    code: string;
    symbolsInRange: SymbolSummary[];
  }>;
  
  // 模块结构
  get_module_structure: (dirPath: string) => Promise<{
    files: { path: string; summary: string; symbolCount: number }[];
    subdirs: { path: string; summary: string }[];
  }>;
  
  // 项目概览（会话启动时注入）
  get_project_overview: () => Promise<{
    totalFiles: number;
    totalSymbols: number;
    topFiles: { path: string; summary: string; incomingRefs: number }[];
    entryPoints: string[];
    techStack: string[];
  }>;
}
```

##### Token 节省对比

| 场景 | 传统方式 | 按需 AST 查询 | 知识图谱 |
|------|---------|-------------|---------|
| 理解一个函数实现 | 读整个文件 ~3,000 tokens | 现场解析 + 读取 ~1,500 tokens | 查摘要 + 按需读段 ~300 tokens |
| 查找调用链 | grep + 读多个文件 ~10,000 tokens | 多次 AST 查询 ~3,000 tokens | 图查询返回路径 ~500 tokens |
| 理解模块结构 | ls + 读多个文件 ~8,000 tokens | 逐文件 AST ~2,000 tokens | get_module_structure ~200 tokens |
| 变更影响分析 | 读所有依赖文件 ~15,000 tokens | 逐文件查引用 ~4,000 tokens | get_impact_analysis ~300 tokens |
| **大型项目代码审查** | **超窗口，无法完成** | **部分可行 ~20,000 tokens** | **完全可行 ~2,000 tokens** |

**省 token 的核心原理**：
1. **摘要代替全文**：Agent 先看文件/符号摘要（~50 tokens），判断是否需要深入
2. **图查询代替遍历**：调用链、依赖关系通过 SQL 查询边表，不需要读代码
3. **按行范围读取**：`read_code_range` 只读取需要的行段，不是整个文件
4. **会话启动注入概览**：`get_project_overview` 结果作为 system context 注入（~500 tokens），Agent 对项目结构有全局认知

##### 索引存储

```sql
-- 文件节点表
CREATE TABLE kg_files (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  language TEXT,
  lines INTEGER,
  last_modified INTEGER,
  last_indexed INTEGER,
  summary TEXT,
  hash TEXT,
  project_id TEXT
);

-- 符号节点表
CREATE TABLE kg_symbols (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  file_path TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  signature TEXT,
  modifiers TEXT,        -- JSON array
  docstring TEXT,
  summary TEXT,
  complexity INTEGER,
  FOREIGN KEY (file_path) REFERENCES kg_files(path)
);

-- 关系边表
CREATE TABLE kg_edges (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  source_file TEXT,
  source_line INTEGER,
  metadata TEXT          -- JSON
);

-- 全文搜索索引（FTS5）
CREATE VIRTUAL TABLE kg_symbols_fts USING fts5(
  name, signature, summary, docstring,
  content='kg_symbols',
  content_rowid='rowid'
);

-- 索引优化
CREATE INDEX idx_symbols_file ON kg_symbols(file_path);
CREATE INDEX idx_symbols_name ON kg_symbols(name);
CREATE INDEX idx_edges_source ON kg_edges(source);
CREATE INDEX idx_edges_target ON kg_edges(target);
CREATE INDEX idx_edges_type ON kg_edges(type);
```

##### 多项目知识图谱

在多项目工作区（3.15）中，每个项目维护独立的知识图谱，但支持跨项目查询：

```typescript
// 跨项目符号搜索
search_symbols("processPayment", {
  project: "project-b",     // 在项目 B 中搜索
  // 或跨所有项目
  // project: "*",
});

// 跨项目调用关系
get_call_graph("sharedUtil", {
  project: "project-a",
  includeExternal: true,   // 包含跨项目引用
});

// 跨项目参考（将其他项目作为参考证据）
get_reference_evidence(symbolName: string, fromProject: string): Promise<{
  implementations: { project: string; file: string; code: string; summary: string }[];
  patterns: { project: string; description: string }[];
}>;
```

##### 索引与 Pi 工具的关系

知识图谱工具集注册为 Pi 自定义工具，与内置工具协作：

```
Agent 工作流示例："帮我看看 processPayment 函数怎么工作的"
  ├── 1. search_symbols("processPayment")
  │     → 返回: { file: "src/payment.ts", lines: [45-120], summary: "处理支付核心逻辑..." }
  │     → ~80 tokens
  │
  ├── 2. get_call_graph("processPayment", { direction: "callees", depth: 2 })
  │     → 返回: processPayment → validateCard → stripPII
  │            processPayment → chargeCard → logTransaction
  │     → ~120 tokens
  │
  ├── 3. read_code_range("src/payment.ts", 45, 120)
  │     → 返回: 函数实现代码
  │     → ~400 tokens
  │
  └── 总计: ~600 tokens（传统方式 ~3,000+ tokens）
```

**与 Pi 内置工具的分工**：
- `grep`/`find`/`ls`：快速文本搜索和文件查找（简单场景）
- `read`：读取完整文件（小文件或首次了解）
- 知识图谱工具：语义搜索、关系查询、影响分析（大型项目、复杂分析）
- Agent 根据任务复杂度自主选择工具

##### 摘要生成策略

| 文件类型 | 摘要策略 | 触发时机 |
|---------|---------|---------|
| 入口文件 (index.ts/main.py) | 详细摘要 + 导出 API 列表 | 首次索引 |
| 核心业务文件 | 符号级摘要 + 文件级摘要 | 首次索引 |
| 工具/辅助文件 | 仅文件级摘要 | 首次索引 |
| 测试文件 | 仅文件级摘要 | 首次索引 |
| 配置文件 | 不生成摘要 | 跳过 |
| 大文件 (>500行) | 分段摘要 + 合并 | 后台异步 |
| 第三方依赖 | 跳过（在 node_modules 等） | 跳过 |

摘要生成使用用户配置的 LLM（默认用最便宜的模型，如 GPT-4o-mini），批量处理以降低成本。用户可在设置中关闭摘要生成（仅保留符号和关系索引）。

#### 3.12.3 项目自动感知

打开目录时自动检测项目类型，加载对应上下文：

```typescript
interface ProjectContext {
  rootPath: string;
  type: "node" | "python" | "rust" | "go" | "java" | "cpp" | "mixed" | "unknown";
  language: string;
  framework?: string;          // react, vue, django, actix, gin...
  packageManager?: string;     // npm, yarn, pnpm, pip, cargo, go, maven...
  buildSystem?: string;        // vite, webpack, make, cmake...
  testCommand?: string;        // npm test, cargo test, pytest...
  lintCommand?: string;        // eslint, ruff, clippy...
  dependencies: DependencyInfo[];
  scripts?: Record<string, string>;  // package.json scripts
  gitInfo?: GitStatus;         // 当前 git 状态
  structure: ProjectStructure;  // 目录结构概要
}

interface ProjectStructure {
  sourceDirs: string[];        // src/, lib/, app/
  testDirs: string[];          // __tests__/, tests/, spec/
  configFiles: string[];       // 配置文件列表
  entryPoints: string[];       // main.ts, index.js, main.py...
}
```

**感知流程**：

```
打开目录
  ├── 检测标识文件: package.json / Cargo.toml / go.mod / pom.xml / requirements.txt
  ├── 解析依赖列表
  ├── 检测框架 (package.json dependencies → react/vue/express/django...)
  ├── 读取构建脚本 (scripts / Makefile / Cargo.toml [[bin]])
  ├── 执行 gitStatus 获取版本状态
  ├── 扫描目录结构 (src/test/config 入口)
  └── 构建 ProjectContext → 注入 Agent system context
```

Agent 拿到 ProjectContext 后，不需要再问"这是什么项目""怎么运行测试""用了什么框架"，直接可以工作。

---

### 3.13 代码变更管理

#### 3.13.1 Diff 审查与回滚

Agent 修改文件后，用户必须拥有可控的审查机制，而非全盘接受或拒绝：

```typescript
interface ChangeManager {
  // Checkpoint 管理
  createCheckpoint: (description: string) => Promise<Checkpoint>;
  rollbackToCheckpoint: (checkpointId: string) => Promise<void>;
  listCheckpoints: () => Checkpoint[];
  
  // Diff 审查
  getChangeset: (checkpointId?: string) => Promise<Changeset>;
  reviewHunk: (file: string, hunkIndex: number, decision: "accept" | "reject" | "modify") => Promise<void>;
  
  // 应用
  applyAccepted: () => Promise<void>;          // 只应用 accept 的 hunk
  applyAll: () => Promise<void>;               // 全部应用
  revertAll: () => Promise<void>;              // 全部回滚
}

interface Checkpoint {
  id: string;
  timestamp: number;
  description: string;
  files: FileSnapshot[];       // 变更前的文件快照
  trigger: "agent" | "user";   // 谁触发的变更
}

interface Changeset {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}

interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  hunks: DiffHunk[];
}

interface DiffHunk {
  index: number;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;             // unified diff
  decision: "pending" | "accept" | "reject";
}
```

**UI 交互流程**：

```
Agent 执行 edit/write 工具
  ├── beforeToolCall 钩子：自动创建 Checkpoint（保存文件当前状态）
  ├── 工具执行：修改文件
  ├── afterToolCall 钩子：生成 Diff
  └── UI 弹出变更通知：侧边面板展示可视化 Diff
  
用户审查 Diff
  ├── 逐 hunk accept / reject / 手动修改
  ├── "全部接受" / "全部回滚" 快捷操作
  ├── 查看 Checkpoint 时间线，可回滚到任意节点
  └── 确认后写入磁盘（reject 的 hunk 恢复原内容）
```

**可视化 Diff 组件**：
- 左右分栏对比（原文 vs 修改后）
- 行级高亮：新增（绿底）、删除（红底）、修改（黄底）
- hunk 级别的 accept/reject 按钮
- 内联编辑能力（用户可以直接在 diff 视图中微调 Agent 的改动）
- 与 Git diff 统一视图（Agent 改动 + 用户手动改动 分开展示）

#### 3.13.2 多文件变更追踪

一个功能需求通常涉及多文件修改，需要整体视图：

```typescript
interface ChangesetView {
  sessionId: string;
  files: ChangedFile[];
  totalFiles: number;
  totalChanges: number;
  checkpointCount: number;
}

interface ChangedFile {
  path: string;
  reason: string;              // Agent 修改这个文件的原因
  changeType: "create" | "modify" | "delete" | "rename";
  additions: number;
  deletions: number;
  checkpoints: string[];       // 涉及的 checkpoint
  accepted: boolean;
}
```

**变更集面板 UI**：
- 会话侧边面板展示所有被修改的文件列表
- 每个文件标注修改原因（从 Agent 的工具调用上下文提取）
- 点击文件 → 展开该文件的完整 diff
- 顶部操作栏：全部接受 / 全部回滚 / 选择性应用
- 与 Git 工作区联动：显示"Agent 改动"vs"用户手动改动"的区分标记
- 一键 `git add` + commit（使用自动生成的 commit message）

#### 3.13.3 重构辅助

Agent 辅助代码重构，结合 AST 理解实现安全重构：

```typescript
interface RefactorTools {
  // 检测
  detectCodeSmells: (file: string) => Promise<CodeSmell[]>;
  detectDuplicates: (project?: string) => Promise<DuplicateBlock[]>;
  calculateComplexity: (file: string) => Promise<ComplexityReport>;
  
  // 执行
  renameSymbol: (file: string, line: number, newName: string) => Promise<RenameResult>;
  extractFunction: (file: string, startLine: number, endLine: number, name: string) => Promise<void>;
  moveSymbol: (symbol: string, fromFile: string, toFile: string) => Promise<void>;
  inlineFunction: (file: string, functionName: string) => Promise<void>;
}

interface CodeSmell {
  type: "long_function" | "deep_nesting" | "duplicate_code" | "god_class" | "long_parameter_list" | "dead_code";
  file: string;
  line: number;
  severity: "high" | "medium" | "low";
  description: string;
  suggestion: string;
}
```

**安全保障**：所有重构操作基于 AST 分析，自动找到所有引用点并同步修改。操作前创建 Checkpoint，支持回滚。

---

### 3.14 调试与运行

#### 3.14.1 错误与日志分析

Agent 能解析错误输出，定位问题根因，关联到具体代码：

```typescript
interface DebugTools {
  // 错误解析
  parseStackTrace: (rawTrace: string) => Promise<ParsedStackTrace>;
  analyzeBuildError: (output: string) => Promise<BuildErrorAnalysis>;
  analyzeTestFailure: (output: string) => Promise<TestFailureAnalysis>;
  
  // 日志分析
  parseLogs: (logs: string, opts: { level?: string; pattern?: string }) => Promise<LogEntry[]>;
  findErrorPatterns: (logs: string) => Promise<ErrorPattern[]>;
  
  // 关联代码
  locateSource: (stackFrame: StackFrame) => Promise<{ file: string; line: number; snippet: string }>;
}

interface ParsedStackTrace {
  frames: StackFrame[];
  rootCause: string;
  relatedCode: { file: string; line: number; snippet: string }[];
  suggestion: string;
}

interface BuildErrorAnalysis {
  errors: BuildError[];
  summary: string;
  affectedFiles: string[];
  fixSuggestions: FixSuggestion[];
}

interface ErrorPattern {
  pattern: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  severity: "error" | "warning" | "info";
  sampleLog: string;
}
```

**工作流**：

```
用户粘贴错误日志 / 构建输出 / 测试失败信息
  ├── 自动检测类型（堆栈跟踪 / 构建错误 / 测试失败 / 运行时日志）
  ├── 结构化解析：提取错误位置、原因、相关代码
  ├── 定位源码：打开对应文件和行号，提取上下文片段
  ├── 根因分析：LLM 结合代码上下文分析原因
  ├── 修复建议：提出具体修改方案
  └── 用户确认 → Agent 执行修复（走 Checkpoint + Diff 审查流程）
```

#### 3.14.2 交互式终端

Pi 的 `bash` 工具是一次性执行，无法处理需要交互输入的命令。提供持久化终端会话：

```typescript
interface TerminalManager {
  // 会话管理
  createSession: (opts: { cwd: string; shell?: string }) => Promise<TerminalSession>;
  sendInput: (sessionId: string, input: string) => Promise<void>;
  getOutput: (sessionId: string, since?: number) => Promise<TerminalOutput>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;
  
  // Agent 使用
  runInteractive: (command: string, opts: { cwd: string; waitForPrompt?: string; timeout?: number }) => Promise<CommandResult>;
}

interface TerminalSession {
  id: string;
  cwd: string;
  shell: string;
  active: boolean;
  history: CommandHistory[];
}
```

**使用场景**：
- 启动 dev server（`npm run dev`）并持续监控输出
- 进入 REPL（`python -i` / `node`）交互式测试代码片段
- 需要输入确认的命令（`npm install` 选择选项、`git rebase -i`）
- 长时间运行的进程监控

**UI**：底部面板可切换终端视图，Agent 可以在终端中执行命令并读取输出，用户也可以直接在终端中操作。

#### 3.14.3 沙箱代码执行

Agent 生成的代码片段在沙箱中安全运行验证，不写入项目文件：

```typescript
interface SandboxRunner {
  run: (opts: {
    language: string;
    code: string;
    stdin?: string;
    timeout?: number;
    project?: string;         // 在指定项目上下文中运行（加载依赖）
  }) => Promise<SandboxResult>;
}

interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  outputFiles?: string[];     // 生成的文件路径
}
```

**支持语言**：
- **JavaScript/TypeScript**：Node.js 沙箱（vm2 / isolated-vm）
- **Python**：子进程隔离执行
- **Shell**：临时目录中执行

**安全策略**：
- 文件系统隔离：沙箱只能访问临时目录
- 网络可选：默认禁用网络，可配置开启
- 资源限制：CPU 时间、内存上限
- Agent 生成的代码先在沙箱验证，通过后再写入项目文件

---

### 3.15 多项目工作区

#### 3.15.1 工作区模型

支持同时管理多个项目，每个项目独立配置，且支持跨项目代码参考：

```typescript
interface Workspace {
  id: string;
  name: string;
  projects: ProjectEntry[];
  activeProjectId: string;
}

interface ProjectEntry {
  id: string;
  name: string;
  path: string;
  context: ProjectContext;       // 自动感知的项目信息（3.12.3）
  gitInfo?: GitStatus;
  
  // 独立配置
  agentConfig?: string;          // 该项目专属的 Agent 配置
  memoryDir: string;             // 项目记忆目录
  knowledgeScope: "project" | "workspace";  // 知识库范围
  
  // 跨项目参考
  references: ProjectReference[];  // 引用的其他项目
  referencedBy: string[];          // 被哪些项目引用
}

interface ProjectReference {
  projectId: string;
  alias: string;                 // 在当前项目中的别名
  mode: "read-only" | "read-execute";  // 只读参考 / 可读可执行
  purpose: string;               // 参考目的说明
}
```

#### 3.15.2 跨项目参考

用户可以将另一个项目作为"参考证据"引入当前会话：

```
用户："帮我实现一个用户认证模块，参考 project-B 里的认证实现"
  ├── Agent 获取 project-B 的项目上下文（结构、技术栈、入口文件）
  ├── Agent 搜索 project-B 中的认证相关代码（AST 符号搜索 + grep）
  ├── 读取相关文件内容，提取实现模式
  ├── 在当前项目的上下文中，生成适配当前技术栈的认证模块
  └── 引用标注：Agent 回答中标注"参考自 project-B/src/auth/login.ts:42"
```

**参考模式**：
- **read-only**：Agent 只能读取参考项目的文件和代码结构，不能修改
- **read-execute**：Agent 可以读取 + 在参考项目中执行只读命令（测试、构建检查）
- 参考项目的代码不会出现在当前项目的 Git diff 中
- Agent 回答中标注引用来源，用户可点击跳转到参考项目的对应文件

#### 3.15.3 跨项目搜索

```typescript
interface CrossProjectTools {
  // 在指定项目中搜索
  searchInProject: (projectId: string, query: string, opts: SearchOpts) => Promise<SearchResult[]>;
  
  // 跨所有项目搜索
  searchAcrossProjects: (query: string, opts: SearchOpts) => Promise<ProjectSearchResult[]>;
  
  // 获取项目结构概要
  getProjectOverview: (projectId: string) => Promise<ProjectOverview>;
  
  // 比较两个项目的实现差异
  compareImplementations: (projectIdA: string, fileA: string, projectIdB: string, fileB: string) => Promise<ComparisonResult>;
}
```

**使用场景**：
- "项目 B 里的 API 限流是怎么做的？我在项目 A 里也要加一个"
- "对比一下这两个项目的数据库访问层实现"
- "从项目 C 里把那个日志格式化工具搬过来，适配到当前项目"

#### 3.15.4 多项目 UI

- **侧边栏项目切换**：项目列表，点击切换活跃项目
- **项目标签页**：每个项目一个标签页，独立会话和上下文
- **参考项目面板**：当前会话引入的参考项目列表，可展开浏览其结构
- **跨项目搜索栏**：全局搜索入口，选择搜索范围（当前项目 / 指定项目 / 全部项目）
- **引用跳转**：Agent 回答中的引用标注可点击跳转到对应项目的文件和行号

---

### 3.16 工程优化与体验保障

以上功能模块构成了产品能力覆盖面，但"功能全"不等于"好用"。以下八个优化点解决的是现有功能能否真正落地的问题，按优先级分为 P0（架构地基）、P1（体验硬伤）、P2（深化方向）。

#### 3.16.1 上下文预算管理 (P0)

**问题**：知识图谱摘要（~500 tokens）、记忆注入（~800）、知识库 RAG（~1000）、MCP 工具定义（~2000+）、系统提示（~500），静态上下文已占 4800+ tokens，尚未计算对话历史。全部注入会导致可用对话空间不足，多轮对话后迅速溢出。

**设计**：引入 ContextBudgetManager，在每次请求前计算并裁剪上下文：

```typescript
interface ContextBudgetManager {
  // 预算配置
  config: {
    totalLimit: number;            // 模型上下文窗口大小（如 128000）
    reservedForResponse: number;   // 给模型回复预留的空间（如 4096）
    
    // 各来源预算分配（百分比，总和 = totalLimit - reservedForResponse）
    allocations: {
      systemPrompt: number;        // 2%  ~2500
      agentDefinition: number;     // 2%  ~2500
      gitStatus: number;           // 1%  ~1200
      projectOverview: number;     // 4%  ~5000（知识图谱摘要）
      memoryInjection: number;     // 6%  ~7500
      knowledgeRAG: number;        // 8%  ~10000
      mcpToolDefs: number;         // 12% ~15000（按需加载，不全量）
      conversationHistory: number; // 65% ~81000（剩余空间）
    };
  };
  
  // 智能加载策略
  loadingStrategy: {
    mcp: "on-demand";        // MCP 工具按需加载：先 list → 再 load 具体工具
    memory: "lazy";          // 记忆首次需要时注入
    knowledgeGraph: "eager"; // 项目概览会话开始就注入
    knowledgeBase: "on-demand"; // RAG 每次查询时按需注入
  };
  
  // 核心方法
  buildContext(request: UserMessage): Promise<BuiltContext>;
  // 1. 分析用户消息意图 → 决定加载哪些上下文来源
  // 2. 按预算分配各来源 token 上限
  // 3. 超预算时自动压缩/摘要（调用 Pi compact()）
  // 4. 返回最终的 messages 数组
  
  getContextUsage(): ContextUsage;
  // 实时返回各来源的 token 占用情况
}
```

**MCP 工具按需加载**（关键设计）：

```typescript
// 不一次性注册所有 MCP Server 的全部工具
// 而是分两层：
// 1. 注册轻量级工具目录（仅名称+描述，~10 tokens/tool）
list_available_tools(): Promise<ToolCatalogEntry[]>;

// 2. Agent 决定使用时才加载完整定义（含 schema，~200 tokens/tool）
load_tool(toolName: string): Promise<ToolDefinition>;
```

**对话历史压缩**：超过对话历史预算时，自动触发 Pi 的 `session.compact()`，将早期对话摘要化。压缩策略：
- 保留最近 N 条完整消息（N 根据剩余预算动态计算）
- 更早的消息用 LLM 生成摘要（~500 tokens 替代 ~5000 tokens）
- 工具调用结果只保留摘要和结论，不保留完整输出

**Token 可视化面板**：在 UI 中展示当前上下文的 token 分布（饼图或堆叠条），用户可以看到：
- 各来源占了多少 token
- 剩余可用空间
- 哪些来源可以释放或压缩
- 一键触发 compact

#### 3.16.2 成本与用量可观测 (P0)

**问题**：多 Provider + 中转 + Per-Agent 模型分配意味着用户可能在一次工作中用了 3+ 种不同价格的模型。GPT-4o 是 $5/M tokens，DeepSeek 是 $0.14/M，差 35 倍。用户如果不知道成本，多模型配置反而是经济负担。

**设计**：

```typescript
interface UsageTracker {
  // 单次请求记录
  recordRequest(data: {
    providerId: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    agentId?: string;
    sessionId: string;
    projectId?: string;
    cost: number;              // 按 Provider 定价计算
    duration: number;          // 请求耗时 ms
  }): void;
  
  // 查询统计
  getUsage(opts: {
    groupBy: "session" | "agent" | "project" | "provider" | "day" | "month";
    dateRange?: [Date, Date];
    projectId?: string;
  }): UsageReport;
  
  // 预算管理
  setBudget(opts: {
    monthlyLimit?: number;     // 月度预算上限（美元）
    alertThreshold: number;    // 预警阈值百分比（如 80）
  }): void;
  
  // 成本优化建议
  getCostOptimizationSuggestions(): Suggestion[];
  // 示例: "当前会话用 GPT-4o 消耗 $2.3，其中 60% 是简单文件读取任务，
  //        切换到 DeepSeek 可节省 ~$2.1（性能影响可控）"
}
```

**Provider 定价表**：内置各 Provider 的定价数据，支持自动更新。中转 Provider 用户手动填写倍率。

**UI 展示**：
- **实时 Token 计数器**：输入框旁显示当前消息预估 token 数 + 累计成本
- **用量统计面板**：按会话/Agent/项目/Provider 维度的饼图 + 趋势折线
- **成本预警通知**：接近月度预算时系统通知
- **模型成本对比**：设置面板中各模型的性价比对比表

#### 3.16.3 键盘优先工作流 (P1)

**问题**：当前 UI 设计是鼠标驱动的。开发者（特别是 VS Code 用户）期望所有核心操作都能通过键盘完成，鼠标操作打断心流。

**设计**：

**Command Palette**（Ctrl+Shift+P）：
```
全局命令面板，模糊搜索所有操作：
  ├── 会话: 新建 / 切换 / 搜索历史 / 导出
  ├── Agent: 切换 / 创建 / 编辑 / 查看定义
  ├── 代码: 搜索符号 / 搜索文件 / 搜索引用 / 跳转定义
  ├── Git: status / diff / commit / 创建分支 / PR
  ├── 工具: 运行命令 / 执行工作流 / 打开终端
  ├── 设置: Provider / 模型分配 / MCP / 工作流
  └── 视图: 切换面板 / 切换项目 / 主题 / 字体
```

**快捷键全覆盖**：

| 快捷键 | 操作 |
|--------|------|
| Enter | 发送消息 |
| Shift+Enter | 换行 |
| Ctrl+C | 中止生成 |
| Ctrl+L | 清空当前对话 |
| Ctrl+K | 聚焦搜索（代码/会话/知识库） |
| Ctrl+Shift+P | Command Palette |
| Ctrl+N | 新建会话 |
| Ctrl+Tab | 切换会话/项目 |
| Ctrl+/ | 呼出 Agent 快速切换菜单 |
| Ctrl+Enter | Accept All changes |
| Ctrl+Backspace | Reject All changes |
| Ctrl+Z | 回滚到上一个 Checkpoint |
| Ctrl+D | 切换 Diff 视图 |
| Ctrl+I | 切换 Inline / 面板模式 |

**快速命令**（输入 `/` 触发）：
```
/agent code-reviewer    → 切换到代码审核 Agent
/skill deploy-guide     → 加载部署指南 Skill
/tool git-status        → 直接调用 git status 工具
/model gpt-4o           → 切换模型
/project switch         → 切换项目
```

**Vim 模式**（可选设置）：消息输入框和代码编辑区域支持 Vim keybindings（通过 monaco-editor 或 codemirror 的 vim 扩展）。

#### 3.16.4 大型项目性能保障 (P1)

**问题**：知识图谱在 10 万行代码项目上首次构建可能 30 秒+，万条消息列表渲染卡顿，SQLite 查询在大数据量下变慢。这不是优化问题，是架构问题。

**设计**：

**知识图谱渐进式构建**：
```
打开项目（<1 秒响应）
  ├── Phase 0: 扫描目录结构 + 元数据（package.json 等）→ 立即可用
  ├── Phase 1: 解析入口文件 + 直接依赖（~5 秒）→ 基本可用
  ├── Phase 2: 后台渐进式解析所有文件（不阻塞 UI）
  │     ├── 优先级: 入口 > 核心模块 > 业务文件 > 测试 > 配置
  │     ├── 进度指示器: "已索引 45/120 文件"
  │     └── 用户查询时优先解析被查询的文件（插队）
  └── Phase 3: 摘要生成（批量异步，最低优先级）
```

**消息列表虚拟化**：
- 使用 `react-window` 或 `@tanstack/react-virtual` 只渲染可见区域的消息
- 每条消息的 Markdown 渲染结果缓存（避免重渲染）
- 工具调用卡片懒加载（滚动到可见时才渲染详情）

**AST 解析 Worker 线程**：
```typescript
// 主线程
const worker = new Worker("./code-graph-worker.ts");
worker.postMessage({ type: "parse-file", path: "src/payment.ts" });
worker.onmessage = (e) => {
  if (e.data.type === "symbols-extracted") {
    // 更新知识图谱索引
  }
};

// Worker 线程内运行 tree-sitter，不阻塞 UI
```

**SQLite 性能优化**：
- 知识图谱查询建好 FTS5 全文索引 + 符号名 B-tree 索引
- WAL 模式（Write-Ahead Logging）提升并发读写
- 大结果集分页查询（LIMIT + OFFSET）
- 会话消息按 session_id 分区索引

#### 3.16.5 Inline 代码变更应用 (P1)

**问题**：当前 3.13 的 Diff 审查在独立面板展示。但 Cursor 的成功经验证明：开发者希望在对话流中直接看到 diff 并 accept/reject，而不是切到另一个面板。

**设计**：Agent 修改文件后，在消息气泡内直接渲染 inline diff：

```tsx
// 消息气泡内的变更展示组件
<InlineChangeCard>
  <ChangeHeader>
    <FileIcon /> src/payment.ts
    <Badge>+12 -5</Badge>
    <Actions>
      <Button label="Accept All" shortcut="Ctrl+Enter" />
      <Button label="Reject All" shortcut="Ctrl+Backspace" />
      <Button label="View in Panel" />  // 仍可切换到独立面板
    </Actions>
  </ChangeHeader>
  
  <DiffViewer mode="unified" hunks={hunks}>
    {hunks.map(hunk => (
      <Hunk>
        <HunkHeader line="45-56" />
        <DiffLine type="context">  const amount = calculateTotal(items);</DiffLine>
        <DiffLine type="remove">- if (amount > 0) {</DiffLine>
        <DiffLine type="remove">-   chargeCard(card, amount);</DiffLine>
        <DiffLine type="add">+ if (amount > 0 && validateCard(card)) {</DiffLine>
        <DiffLine type="add">+   chargeCard(card, amount);</DiffLine>
        <DiffLine type="add">+   logTransaction(amount);</DiffLine>
        <DiffLine type="context">  }</DiffLine>
        <HunkActions>
          <IconButton icon="check" onClick={() => acceptHunk(hunk.id)} />
          <IconButton icon="x" onClick={() => rejectHunk(hunk.id)} />
        </HunkActions>
      </Hunk>
    ))}
  </DiffViewer>
</InlineChangeCard>
```

**多文件变更集**：当 Agent 一次修改多个文件时，在消息内展示变更集卡片：
- 每个文件一行：文件名 + 增删行数 + accept/reject 开关
- 点击展开看具体 diff
- "Accept All Files" / "Reject All Files" 全局操作
- 与 Git 工作区状态联动（标注哪些是 Agent 改的，哪些是用户自己改的）

**Undo 语义**：在 Agent 上下文中，Ctrl+Z 的语义是"回滚到上一个 Checkpoint"，而非文本编辑的 undo。UI 需明确提示。

#### 3.16.6 项目首次接入引导 (P1)

**问题**：当前 PRD 有"项目自动感知"，但用户打开新项目时不知道 Agent 对项目了解到什么程度了，也不知道能开始做什么。

**设计**：首次打开项目时自动执行接入流程：

```
打开项目
  ├── 1. 项目检测（<1 秒）
  │     ├── 技术栈识别：TypeScript + React + Express + PostgreSQL
  │     ├── 目录结构扫描：src/ tests/ config/ public/
  │     ├── 入口文件：src/index.ts → src/app.ts
  │     ├── 构建命令：npm run build / npm run dev
  │     └── 测试命令：npm test
  │
  ├── 2. 知识图谱渐进构建（后台）
  │     └── 进度指示器: "正在理解你的项目... 45/120 文件已索引"
  │
  ├── 3. 生成项目卡片（知识图谱 Phase 1 完成后）
  │     ├── 架构概览图（模块关系，从知识图谱生成）
  │     ├── 编码约定提取（.eslintrc / .prettierrc / tsconfig）
  │     ├── 关键文件清单（入口、配置、核心模块）
  │     └── 依赖分析（直接依赖、devDependencies、潜在风险依赖）
  │
  └── 4. 建议首轮对话
        "我已理解你的项目。你可以问我：
         • 这个项目的支付模块是怎么工作的？
         • 帮我找到所有处理用户认证的代码
         • 这个项目的测试覆盖率怎么样？
         • 帮我重构 src/utils/date.ts 里的时间格式化函数"
```

**项目卡片 UI**：在侧边栏展示，点击展开查看详情。包含：
- 技术栈标签
- 架构概览图（可交互的模块关系图）
- 文件统计（总文件数、代码行数、语言分布）
- 索引进度（已索引/总文件数）
- 编码约定摘要

**编码约定提取**：
```typescript
interface CodingConventions {
  language: string;             // "typescript"
  styleGuide: {                 // 从 eslint/prettier 配置提取
    indent: "2spaces" | "4spaces" | "tab";
    quotes: "single" | "double";
    semicolons: boolean;
    trailingComma: "none" | "es5" | "all";
    namingConvention: {
      variables: "camelCase";
      classes: "PascalCase";
      constants: "UPPER_SNAKE";
      files: "kebab-case" | "camelCase" | "PascalCase";
    };
  };
  typeStrictness: "strict" | "moderate" | "loose";  // tsconfig strict
  testFramework?: string;       // jest / vitest / pytest
  commitConvention?: string;    // conventional commits / custom
}
```

Agent 在生成代码时自动遵循这些约定，不需要用户每次提醒。

#### 3.16.7 测试工作流闭环 (P2)

**问题**：当前 PRD 有"测试生成"作为预设 Agent，但只停留在"生成"。开发者需要完整闭环：生成 → 运行 → 解析结果 → 修复失败 → 再运行。

**设计**：

```typescript
interface TestWorkflowManager {
  // 测试运行
  runTests(opts: {
    scope: "all" | "file" | "pattern" | "changed";  // changed: 只跑 git diff 影响的测试
    watch?: boolean;    // watch 模式
  }): Promise<TestRunResult>;
  
  // 结果解析
  parseTestResult(rawOutput: string): Promise<TestRunResult>;
  
  // 失败分析（结合知识图谱）
  analyzeFailures(failures: TestFailure[]): Promise<FailureAnalysis[]>;
  // → 定位源码、分析根因、提出修复方案
  
  // 修复循环
  fixAndRetry(failures: TestFailure[], agentId: string): Promise<TestRunResult>;
  // → Agent 执行修复 → 应用变更 → 重新运行 → 返回结果
  
  // 覆盖率
  getCoverage(): Promise<CoverageReport>;
  // → 行覆盖 / 分支覆盖 / 函数覆盖
  // → 与上次对比（新增/减少）
}

interface TestRunResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
  coverage?: CoverageReport;
}

interface TestFailure {
  testName: string;
  file: string;
  error: string;
  stackTrace: string;
  expectedValue: string;
  actualValue: string;
  sourceLocation: { file: string; line: number };  // 定位到源码
}
```

**测试质量分析**：
- 检测无效测试：只测 happy path、断言不足、mock 过多
- 测试重复度：是否有多个测试覆盖同一代码路径
- 测试速度：慢测试标记（>1s），建议拆分或 mock
- 测试与代码的关联：从知识图谱分析哪些源码缺少测试覆盖

#### 3.16.8 插件生态与分享 (P2)

**问题**：当前 PRD 有 Skills 导出/导入和 Agent 定义导出，但没有发现机制。用户得手动分享文件。

**设计**：

**社区索引**（轻量级方案，基于 GitHub 仓库或 JSON API）：

```typescript
interface PluginMarketplace {
  // 浏览
  listPlugins(opts: {
    type: "skill" | "agent" | "tool" | "pack";
    category?: string;
    sort: "popular" | "recent" | "rating";
    search?: string;
  }): Promise<PluginEntry[]>;
  
  // 安装
  install(pluginId: string): Promise<InstallResult>;
  // → 下载到 ~/.agentbuddy/{type}s/ → 验证签名 → 注册
  
  // 更新
  checkUpdates(): Promise<UpdateAvailable[]>;
  update(pluginId: string): Promise<void>;
  
  // 发布
  publish(pluginPath: string): Promise<PublishResult>;
  // → 打包 → 上传到社区仓库 → 生成安装链接
  
  // 兼容性检查
  checkCompatibility(pluginId: string): Promise<CompatibilityReport>;
  // → 检查模型要求、工具依赖、Agent Buddy 版本
}
```

**打包格式**（`.agentbuddy-pack`，实际为 zip）：
```
my-agent-pack.agentbuddy-pack (zip)
  ├── manifest.json          # 元数据：名称、版本、作者、依赖
  ├── agents/
  │   └── code-reviewer.md   # Agent 定义
  ├── skills/
  │   └── deploy-guide.md    # 依赖的 Skills
  ├── tools/
  │   └── custom-linter.js   # 自定义工具脚本
  └── README.md              # 使用说明
```

**安装安全**：
- 安装前显示权限请求（这个 Agent 会使用哪些工具、访问哪些目录）
- 自定义工具脚本沙箱执行（受限权限）
- 社区评分和评论机制
- 官方认证标记（verified）

---

## 四、技术架构

### 4.1 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron 31+ | 跨平台桌面应用 |
| 构建工具 | electron-vite | Electron 专用 Vite 构建 |
| 前端框架 | React 18 | UI 渲染 |
| 状态管理 | Zustand 4.5+ | 轻量状态管理 |
| 样式 | Tailwind CSS 3.4+ | 原子化 CSS |
| Markdown | react-markdown + remark-gfm | Markdown 渲染 |
| 代码高亮 | Shiki 1.x | 语法高亮 |
| 图标 | Lucide React | SVG 图标 |
| 本地存储 | SQLite (better-sqlite3) | 会话、知识库、向量、工作流 |
| 配置存储 | electron-store | Provider 配置、设置 |
| Agent SDK | @earendil-works/pi-coding-agent | Agent 运行时 |
| LLM SDK | @earendil-works/pi-ai | LLM 统一调用 |
| AST 解析 | tree-sitter + 多语言解析器 | 代码符号/引用/调用图分析 |
| Diff 渲染 | react-diff-viewer-continued | 可视化 Diff 审查组件 |
| 终端模拟 | xterm.js | 交互式终端 UI |
| 沙箱执行 | isolated-vm (JS) + 子进程 (Python/Shell) | 安全代码执行 |
| 向量检索 | 自建 (SQLite + 余弦相似度) | 知识库 RAG |
| MCP 客户端 | @modelcontextprotocol/sdk | MCP Server 连接和工具发现 |
| Cron 调度 | node-cron | 定时工作流调度 |
| 消息列表虚拟化 | @tanstack/react-virtual | 大量消息高性能渲染 |
| Diff 渲染 | react-diff-viewer-continued | Inline 代码变更展示 |
| 终端模拟 | xterm.js + node-pty | 交互式终端 |
| Token 计数 | tiktoken / @anthropic-ai/tokenizer | 实时 token 估算 |
| 图表渲染 | recharts | 用量统计 + 成本趋势可视化 |
| 消息网关 | 自建 (WebSocket + HTTP) | 各平台渠道适配 |
| 钉钉 SDK | dingtalk-stream | 钉钉 Stream 模式 |
| 飞书 SDK | @larksuiteoapi/node-sdk | 飞书事件订阅 |
| QQ Bot | qq-bot-sdk | QQ 机器人 API |

### 4.2 进程架构

```
Electron 主进程 (Node.js)
  ├── Pi SDK 集成 (AgentSession 管理)
  ├── Provider 管理 (环境变量注入)
  ├── 工具执行 (文件操作、终端命令)
  ├── 权限确认 (beforeToolCall 钩子 + Checkpoint 自动创建)
  ├── 代码理解引擎
  │   ├── Git 工具集 (status/diff/log/blame/commit/branch/PR)
  │   ├── AST 解析器 (tree-sitter, 多语言)
  │   ├── 调用图索引 (缓存到 .agentbuddy/index/)
  │   └── 项目感知 (技术栈/构建系统/依赖检测)
  ├── 变更管理器
  │   ├── Checkpoint 管理 (文件快照 + 时间线)
  │   ├── Diff 生成 (hunk 级别)
  │   └── 变更集追踪 (多文件 + 修改原因)
  ├── 调试运行时
  │   ├── 错误解析器 (堆栈/构建/测试/日志)
  │   ├── 交互式终端 (node-pty 持久会话)
  │   └── 沙箱执行器 (isolated-vm / 子进程隔离)
  ├── 多项目管理器 (工作区 + 跨项目参考 + 搜索)
  ├── SQLite 数据库 (会话、知识库、向量、工作流)
  ├── 向量索引 (Embedding 调用)
  ├── MCP 客户端 (MCP Server 子进程管理 + 工具注册)
  ├── Cron 调度器 (node-cron, 工作流定时触发)
  ├── Webhook 服务器 (HTTP 监听, 事件驱动触发)
  ├── 消息网关 (Gateway)
  │   ├── 渠道适配器 (钉钉/QQ/飞书/企微/Webhook)
  │   ├── 消息路由 (外部消息 → Agent 映射)
  │   ├── 会话映射 (外部 ID ↔ 内部会话)
  │   └── 凭据管理 (Bot Token 加密存储)
  ├── 目标编排引擎 (任务拆解 + 跟踪 + 委派)
  ├── 代码知识图谱引擎 (tree-sitter 解析 + SQLite 图存储 + 增量更新, Worker 线程)
  ├── 上下文预算管理器 (ContextBudgetManager, token 分配 + 压缩 + MCP 按需加载)
  ├── 用量追踪器 (UsageTracker, token 计数 + 成本计算 + 预算预警)
  └── IPC 通信 (与渲染进程)

Preload 脚本
  └── contextBridge (安全暴露 IPC API)

渲染进程 (React)
  ├── UI 组件 (聊天 + 设置 + 工作流 + 渠道管理 + 任务面板)
  ├── Zustand 状态管理
  ├── 事件订阅 (Agent 事件流 + 网关事件 + 工作流事件)
  ├── Command Palette (全局快捷命令面板)
  ├── Inline Diff 渲染 (对话内代码变更 accept/reject)
  ├── Token 可视化面板 (上下文占用 + 成本统计)
  ├── 虚拟滚动消息列表 (react-window)
  └── IPC 调用
```

### 4.3 安全模型

- `contextIsolation: true` — 渲染进程不能直接访问 Node.js
- `nodeIntegration: false` — 所有 Node.js 操作通过 IPC
- `sandbox: true` — 启用沙箱
- API Key 使用 `safeStorage` API 加密存储
- Bot Token 使用 `safeStorage` API 加密存储
- 工具执行通过 `beforeToolCall` 钩子实现分级权限确认
- 命令执行通过白名单/黑名单过滤危险命令
- MCP Server 子进程隔离，工具默认需确认
- 消息渠道 DM 策略：默认 `pairing` 模式，未知发送人需配对确认
- 通过消息渠道触发的会话，工具权限自动降级
- Webhook 服务器支持 Token 验证，防止未授权调用

---

## 五、构建路径

基于技术依赖关系，全功能产品分 7 个阶段构建。每个阶段交付可运行的版本，不是功能裁剪而是构建顺序。

### Phase 1: 基础底座 + 代码安全 (Foundation)

**目标**：单 Agent 能聊天、能用工具、能配置多模型，Agent 修改代码有可控的审查机制，且具备上下文管理、成本可观测和键盘工作流

- Electron + React + electron-vite 项目搭建
- Pi SDK 集成（主进程 AgentSession 管理）
- IPC 通信层（agent:prompt / agent:event / agent:abort）
- Zustand 状态管理 + 事件订阅
- 多 Provider 注册表 + 中转支持 + API Key 加密存储
- 模型探测与连接测试
- 视觉模型独立配置 + 自动路由
- 聊天 UI（消息流 + 流式输出 + Markdown 渲染 + 代码高亮）
- 消息列表虚拟化（@tanstack/react-virtual）
- InputBar（文本输入 + 图片上传 + 粘贴图片）
- 内置工具集成（read/write/edit/bash/grep/find/ls）
- 分级权限确认 UI（beforeToolCall 钩子）
- 基础设置面板（Provider 管理 + 模型分配）
- **项目自动感知**（3.12.3）：打开目录时自动检测技术栈、构建系统、依赖、入口文件，注入 Agent 上下文
- **Git 基础集成**（3.12.1）：git status/diff/log/branch/commit/stash 工具集，会话启动时自动注入 Git 状态
- **Diff 审查 & 回滚**（3.13.1）：Checkpoint 机制 + 可视化 Diff + 逐 hunk accept/reject + 回滚
- **多文件变更追踪**（3.13.2）：变更集面板 + 修改原因标注 + 全部接受/回滚/选择性应用
- **上下文预算管理**（3.16.1）：ContextBudgetManager，token 分配 + MCP 工具按需加载 + 对话历史压缩 + Token 可视化面板
- **成本与用量可观测**（3.16.2）：实时 Token 计数 + 成本估算 + 用量统计面板 + 月度预算预警
- **键盘优先工作流**（3.16.3）：Command Palette（Ctrl+Shift+P）+ 快捷键全覆盖 + `/` 快速命令
- **Inline 代码变更应用**（3.16.5）：对话内直接渲染 diff + 逐 hunk accept/reject + Ctrl+Z 回滚 Checkpoint

**交付物**：可运行的桌面应用，能配置多模型、聊天、执行工具，Agent 修改代码有安全审查和回滚能力，具备上下文管理、成本感知和键盘工作流

### Phase 2: Agent 编排 + 目标规划 + 代码理解深化 (Multi-Agent & Intelligence)

**目标**：多 Agent 协作、会话分支、上下文路由、目标拆解，以及代码知识图谱和调试能力

- Agent 定义模型（类型系统 + 存储）
- Agent 管理界面（表单创建/编辑）
- Agent 定义导出/导入（Markdown 格式）
- 预设 Agent（代码审核、测试生成、文档生成）
- 会话分支系统（Git-like 分支树）
- 上下文智能路由（摘要生成 + 注入）
- Agent 切换 UI（侧边面板 + 主对话切换）
- Agent 结果展示（可切换：主对话 / 侧边面板）
- Per-Agent 模型分配（运行时切换）
- 目标拆解工具集（plan / create_task / update_task / get_tasks / delegate_task）
- 任务跟踪 UI（任务面板 + 进度条 + 状态更新）
- 编排策略（顺序 / 并行 / 条件分支 / 子 Agent 委派）
- **代码知识图谱**（3.12.2）：tree-sitter 解析 + SQLite 图存储，预构建符号/文件/关系图谱，Agent 查询图谱而非读文件，节省 90%+ token。支持增量更新和摘要生成
- **错误与日志分析**（3.14.1）：堆栈跟踪解析/构建错误分析/测试失败分析/日志模式匹配，自动定位源码和修复建议
- **交互式终端**（3.14.2）：持久化终端会话，支持 dev server / REPL / 交互式命令
- **沙箱代码执行**（3.14.3）：多语言代码片段安全运行验证，不写入项目文件
- **大型项目性能保障**（3.16.4）：知识图谱渐进式构建 + AST Worker 线程 + SQLite WAL 模式 + 索引优化
- **项目首次接入引导**（3.16.6）：自动生成项目卡片 + 架构概览图 + 编码约定提取 + 首轮对话建议

**交付物**：支持多 Agent 协作、目标规划编排、代码知识图谱（省 90%+ token）、调试能力，且大型项目性能有保障、首次接入有引导

### Phase 3: MCP 工具生态 + 多项目工作区 (MCP & Multi-Project)

**目标**：MCP 工具无缝接入、多项目管理与跨项目参考

- MCP 客户端集成（@modelcontextprotocol/sdk）
- mcp.json 配置文件读取和管理
- MCP Server 子进程管理（stdio 通信）
- tools/list 自动发现 + pi.registerTool() 注册
- MCP 工具权限配置（per-server 权限级别）
- MCP Resources 浏览 UI
- MCP Prompts `/` 命令调用
- MCP 设置面板（添加/编辑/删除/测试连接）
- MCP 工具在对话中的展示和调用
- **Git 深度集成**（3.12.1 扩展）：git blame / PR 创建（GitHub/GitLab/Gitea）/ commit message 自动生成 / 合并冲突辅助
- **多项目工作区**（3.15）：多项目标签页/切换、每项目独立配置和记忆
- **跨项目参考**（3.15.2）：引入其他项目作为参考证据，read-only / read-execute 模式，引用标注和跳转
- **跨项目搜索**（3.15.3）：指定项目搜索 / 全项目搜索 / 实现对比
- **重构辅助**（3.13.3）：代码异味检测/重复代码检测/复杂度分析/符号重命名/函数提取，基于 AST 安全重构
- **测试工作流闭环**（3.16.7）：测试运行 + 结果解析 + 失败分析（结合知识图谱）+ 修复循环 + 覆盖率报告 + 测试质量分析

**交付物**：Agent 能使用任意 MCP 工具，支持多项目管理和跨项目代码参考，具备完整测试工作流闭环

### Phase 4: 记忆系统 (Memory)

**目标**：多层级记忆、跨会话延续、行为学习

- 项目级记忆（`.agentbuddy/memory/` 目录结构）
- 用户级偏好存储
- 会话摘要自动生成
- 记忆自动写入（工作日志 append-only）
- 记忆主动建议（"要记住这个吗？"）
- 记忆注入机制（会话开始时注入 system context）
- 行为学习（采纳/拒绝追踪 + 决策参考）
- 记忆管理界面（查看/编辑/删除）
- 会话历史搜索

**交付物**：Agent 具备长期记忆，能跨会话延续上下文

### Phase 5: 知识库 (Knowledge Base)

**目标**：个人知识库、RAG 检索、自动积累

- SQLite + 向量存储基础设施
- Embedding 调用（使用配置的 Provider）
- 知识卡片数据模型与存储
- 自动积累机制（Agent 工作中提取 + 用户确认）
- 用户手动添加（文档/笔记/代码片段/链接）
- 语义搜索 + 全文搜索
- RAG 检索注入（回答前检索相关知识）
- 主动提醒（检测相关性时提示）
- 知识库浏览界面（分类/标签/时间/搜索）
- 知识卡片编辑器
- 知识包导出/导入

**交付物**：完整的个人知识库系统

### Phase 6: 定时工作流 + 消息网关 (Workflow & Gateway)

**目标**：定时自动化、消息平台集成、跨渠道会话

- Cron 调度器集成（node-cron）
- 工作流定义模型和存储（SQLite）
- 工作流管理 UI（创建/编辑/启用/禁用/执行历史）
- 自然语言 → cron 表达式转换
- Webhook HTTP 服务器
- 工作流执行引擎（触发 → 创建会话 → 执行 → 输出）
- Gateway 网关服务架构
- 钉钉 Stream 模式适配器
- QQ Bot API 适配器
- 飞书事件订阅适配器
- 企业微信适配器
- 渠道-Agent 路由配置 UI
- 会话映射（外部 ID ↔ 内部会话）
- 跨渠道记忆（记忆标记来源渠道 + 统一会话历史）
- DM 安全策略（pairing / open / closed）
- 消息格式转换（各平台 ↔ 统一内部格式）
- 流式响应推送（逐字推送支持的平台）

**交付物**：Agent 可从微信/QQ/钉钉/飞书远程调起，支持定时工作流

### Phase 7: 精细化 (Polish)

**目标**：Skills 系统、体验打磨、打包分发

- Skills 系统（Markdown 指令 + 加载/管理）
- 自定义工具脚本系统
- 会话分支树可视化
- 会话导出（JSON / Markdown）
- 网页链接抓取与摘要
- Vim 模式（可选，消息输入和代码编辑）
- 暗色主题
- 应用打包与分发（Windows/macOS/Linux）
- 性能优化（AST 缓存优化、数据库索引调优、Worker 线程池）
- 后台守护进程模式（关闭窗口后 Gateway 和调度器继续运行）
- **插件生态与分享**（3.16.8）：社区市场索引 + 一键安装 + 打包格式（.agentbuddy-pack）+ 兼容性检查 + 安装安全

**交付物**：可分发的完整产品，具备社区插件生态

---

## 六、数据模型概要

### 6.1 核心数据模型

```typescript
// Provider 配置
interface ProviderConfig {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "deepseek" | "gemini" | "mistral" | "openrouter" | "custom";
  apiKey: string;
  baseURL?: string;
  models: ModelInfo[];
  status: "connected" | "untested" | "error";
}

// Agent 定义
interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  modelAssignment: ModelAssignment;
  systemPrompt: string;
  tools: string[];
  skills: string[];
  triggers: TriggerConfig[];
  icon: string;
  color: string;
  isDefault: boolean;
}

// 会话
interface Session {
  id: string;
  workspaceId: string;
  parentId?: string;        // 父会话 ID（分支时）
  agentId: string;          // 关联的 Agent
  title: string;
  messages: Message[];
  contextSummary?: string;  // 智能摘要
  sourceChannel?: string;   // 来源渠道（desktop / wechat / dingtalk ...）
  createdAt: number;
  updatedAt: number;
}

// 知识卡片
interface KnowledgeCard {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source: "auto" | "manual";
  sourceSessionId?: string;
  sourceProjectId?: string;
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
}

// 记忆条目
interface MemoryEntry {
  id: string;
  level: "project" | "user" | "session";
  key: string;
  value: string;
  projectId?: string;
  sourceChannel?: string;   // 来源渠道
  createdAt: number;
  updatedAt: number;
}

// MCP Server 配置
interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  permission: "auto" | "confirm" | "disabled";
  enabled: boolean;
}

// 定时工作流
interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: "cron" | "webhook" | "event";
    schedule?: string;
    naturalLanguage?: string;
    webhookPath?: string;
    eventCondition?: string;
  };
  agentId: string;
  prompt: string;
  workspaceId?: string;
  output: {
    channels: OutputChannel[];
    format: "text" | "markdown" | "json";
  };
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
}

// 工作流执行记录
interface WorkflowRun {
  id: string;
  workflowId: string;
  startedAt: number;
  completedAt?: number;
  status: "running" | "completed" | "failed";
  result?: string;
  sessionId?: string;       // 关联的会话 ID
}

// 消息渠道配置
interface ChannelConfig {
  id: string;
  platform: "dingtalk" | "qq" | "wecom" | "feishu" | "wechat" | "webhook";
  name: string;
  credentials: Record<string, string>;
  routing: {
    defaultAgentId: string;
    rules?: RoutingRule[];
  };
  messageHandling: {
    groupMentionOnly: boolean;
    acceptMedia: boolean;
    streaming: boolean;
  };
  dmPolicy: "pairing" | "open" | "closed";
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
}

// 渠道-会话映射
interface ChannelSessionMapping {
  id: string;
  channelConfigId: string;
  externalUserId: string;    // 外部平台的用户 ID
  externalGroupId?: string;  // 外部平台的群 ID
  sessionId: string;         // 内部会话 ID
  paired: boolean;           // 是否已配对确认
  createdAt: number;
}

// 任务（目标编排）
interface Task {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "blocked" | "failed";
  dependencies: string[];    // 依赖的任务 ID
  assignedAgentId?: string;  // 委派的 Agent
  order: number;
  result?: string;
  createdAt: number;
  updatedAt: number;
}

// 变更 Checkpoint
interface Checkpoint {
  id: string;
  sessionId: string;
  timestamp: number;
  description: string;
  files: FileSnapshot[];
  trigger: "agent" | "user";
}

// 文件快照（Checkpoint 时的文件状态）
interface FileSnapshot {
  path: string;
  content: string;           // 变更前的完整内容
  hash: string;              // 内容哈希，用于快速比较
}

// 变更集
interface Changeset {
  sessionId: string;
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}

// 项目上下文（自动感知）
interface ProjectContext {
  rootPath: string;
  type: "node" | "python" | "rust" | "go" | "java" | "cpp" | "mixed" | "unknown";
  language: string;
  framework?: string;
  packageManager?: string;
  buildSystem?: string;
  testCommand?: string;
  lintCommand?: string;
  dependencies: DependencyInfo[];
  scripts?: Record<string, string>;
  gitInfo?: GitStatus;
  structure: ProjectStructure;
}

// 多项目工作区
interface Workspace {
  id: string;
  name: string;
  projects: ProjectEntry[];
  activeProjectId: string;
}

// 项目条目（工作区中的项目）
interface ProjectEntry {
  id: string;
  name: string;
  path: string;
  context: ProjectContext;
  gitInfo?: GitStatus;
  agentConfig?: string;
  memoryDir: string;
  knowledgeScope: "project" | "workspace";
  references: ProjectReference[];
  referencedBy: string[];
}

// 用量记录（成本追踪）
interface UsageRecord {
  id: string;
  timestamp: number;
  providerId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost: number;
  duration: number;
  agentId?: string;
  sessionId: string;
  projectId?: string;
}

// 上下文预算配置
interface ContextBudgetConfig {
  totalLimit: number;
  reservedForResponse: number;
  allocations: {
    systemPrompt: number;
    agentDefinition: number;
    gitStatus: number;
    projectOverview: number;
    memoryInjection: number;
    knowledgeRAG: number;
    mcpToolDefs: number;
    conversationHistory: number;
  };
  loadingStrategy: {
    mcp: "on-demand";
    memory: "lazy";
    knowledgeGraph: "eager";
    knowledgeBase: "on-demand";
  };
}

// 测试运行结果
interface TestRunResult {
  id: string;
  timestamp: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
  coverage?: CoverageReport;
  projectId: string;
}

// 编码约定（项目接入引导）
interface CodingConventions {
  language: string;
  styleGuide: {
    indent: "2spaces" | "4spaces" | "tab";
    quotes: "single" | "double";
    semicolons: boolean;
    trailingComma: "none" | "es5" | "all";
    namingConvention: Record<string, string>;
  };
  typeStrictness: "strict" | "moderate" | "loose";
  testFramework?: string;
  commitConvention?: string;
}
```

### 6.2 存储分布

| 数据 | 存储位置 | 格式 |
|------|---------|------|
| Provider 配置 | `~/.agentbuddy/config/providers.json` | JSON (electron-store 加密) |
| MCP Server 配置 | `~/.agentbuddy/config/mcp.json` | JSON |
| 渠道凭据配置 | `~/.agentbuddy/config/channels.json` | JSON (electron-store 加密) |
| Git 平台 Token | `~/.agentbuddy/config/git-tokens.json` | JSON (electron-store 加密) |
| 工作区配置 | `~/.agentbuddy/config/workspaces.json` | JSON |
| Agent 定义 | `~/.agentbuddy/agents/*.md` | Markdown (frontmatter + 正文) |
| Skills | `~/.agentbuddy/skills/*.md` | Markdown |
| 会话数据 | `~/.agentbuddy/data/sessions.db` | SQLite |
| 知识库 | `~/.agentbuddy/data/knowledge.db` | SQLite (含向量) |
| 工作流 + 执行历史 | `~/.agentbuddy/data/workflows.db` | SQLite |
| 渠道会话映射 | `~/.agentbuddy/data/channels.db` | SQLite |
| 任务（目标编排） | `~/.agentbuddy/data/tasks.db` | SQLite |
| 变更 Checkpoint | `~/.agentbuddy/data/checkpoints.db` | SQLite (含文件快照) |
| 项目记忆 | `{project}/.agentbuddy/memory/*.md` | Markdown |
| 代码知识图谱 | `~/.agentbuddy/data/kg_{projectId}.db` | SQLite (节点 + 边 + FTS5 全文索引) |
| 项目感知上下文 | `{project}/.agentbuddy/context.json` | JSON (自动生成) |
| 用户偏好 | `~/.agentbuddy/memory/preferences.md` | Markdown |
| 用量记录 | `~/.agentbuddy/data/usage.db` | SQLite (按会话/Agent/项目/Provider 聚合) |
| 上下文预算配置 | `~/.agentbuddy/config/context-budget.json` | JSON |
| 编码约定 | `{project}/.agentbuddy/conventions.json` | JSON (自动提取) |
| 行为学习 | `~/.agentbuddy/learning/patterns.json` | JSON |
| 自定义工具 | `~/.agentbuddy/tools/*.js` | JavaScript |

---

## 七、开放问题

以下问题需要在实现过程中进一步明确：

1. **Embedding 模型选择**：知识库向量化用哪个 Provider 的 Embedding API？是否支持本地 Embedding 模型（如 Ollama）？
2. **行为学习的具体机制**：如何量化"采纳/拒绝"？如何将行为学习结果转化为 Agent 行为调整？
3. **会话分支的合并语义**：子分支结果回注主会话时，是作为一条新消息还是替换某些内容？
4. **知识库去重**：自动积累时如何避免重复存储相似内容？需要相似度阈值。
5. **多窗口支持**：是否支持多窗口（不同项目/会话同时打开）？
6. **团队协作**：知识库分享是文件级别还是有在线同步机制？（建议 MVP 用文件级别）
7. **Agent 间通信**：除了上下文路由，Agent 之间是否需要直接通信（如主 Agent 主动调用 Review Agent）？
8. **离线模式**：是否需要支持离线使用（本地模型）？
9. **MCP 上下文膨胀**：MCP Server 可能注册大量工具导致上下文膨胀，是否需要按需加载策略（只在相关时激活 MCP 工具）？
10. **微信个人号接入**：个人微信没有官方 Bot API，通过 iPad 协议有封号风险。是否只支持企业微信通道接入微信？
11. **后台守护进程**：关闭 Electron 窗口后，Gateway 和 Cron 调度器是否需要继续运行？如何实现（tray daemon / 独立 Node 服务）？
12. **目标编排的复杂度边界**：Agent 自主编排到什么程度需要用户确认？是否设置最大任务数限制防止失控？
13. **跨渠道会话的上下文窗口**：不同平台消息长度限制不同（如微信单条消息字数限制），如何处理长回复？
14. **Webhook 安全**：Webhook 端点如何防止未授权调用？Token 验证 + IP 白名单？
15. **Checkpoint 存储策略**：文件快照可能占用大量磁盘空间。是否设置最大保留数量/过期时间？是否只存 diff 而非完整快照？
16. **知识图谱索引性能**：大型项目（10万+ 文件）首次索引可能耗时较长——是否需要分批索引 + 优先索引入口文件？摘要生成用哪个模型？是否允许跳过摘要只建符号索引？
17. **跨项目参考的权限边界**：参考项目可以读取到什么程度？是否能读取 `.env` 等敏感文件？是否需要排除规则？
18. **交互式终端与 Agent 的协作**：Agent 在终端中执行的命令和用户手动输入的命令如何区分？是否需要终端历史标注？
19. **沙箱与项目上下文**：沙箱执行代码时是否加载项目的 `node_modules`/`venv`？如何平衡安全性和可用性？
20. **上下文压缩的准确性**：对话历史自动摘要时，如何确保不丢失关键决策信息和工具调用上下文？是否需要用户确认压缩结果？
21. **MCP 按需加载的延迟**：Agent 决定使用某 MCP 工具后需要先 `load_tool` 再调用，是否引入不可接受的延迟？是否需要预加载高频工具？
22. **成本优化的自动触发**：当检测到用户用昂贵模型执行简单任务时，是自动切换还是仅建议？自动切换会不会导致质量下降？
23. **插件安全审计**：社区插件中的自定义工具脚本如何沙箱化？是否需要签名机制？

---

## 八、后续行动

1. **确认 PRD**：review 本文档，标注需要调整的部分
2. **确定 Phase 1 细节**：Phase 1 的技术实现方案（已在前序设计文档中完成）
3. **开始 Phase 1 开发**：确认后进入编码阶段
4. **迭代节奏**：每个 Phase 完成后 review，调整后续 Phase 计划
