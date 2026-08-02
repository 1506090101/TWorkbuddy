# Agent Buddy — Feature Specification (Spec Coding)

> PRD → Feature 拆分，按 spec-coding 方式组织
> 每个 Feature 是独立可交付的开发单元，包含明确的验收标准
> **V2 方向**：以 [Agent Workbuddy 需求调整](agent-workbuddy-v2.md) 为跨 Feature 约定。工作台闭环优先于传统聊天呈现；V1 描述保留为历史基线。

## V2 需求调整与迁移规则

V2 的交付对象是“面向开发任务的 Agent 工作台”。首轮垂直切片必须贯通 `WorkSession` 持久化、`ComposerContext` 输入、主进程 Agent Runtime、`WorkEvent` 时间线和右侧审查面板。任何 Feature 都不能只增加聊天文案或静态 UI。

### 统一概念

- `WorkSession`：项目、Agent、模型、目标、消息、附件和执行状态的持久化边界。
- `ComposerContext`：模型即时覆盖、图片/文本/代码附件、插件引用、目标和 Thinking。
- `Goal`：会话目标、步骤、状态和结果；目标状态必须在顶部、Composer 和右侧面板一致。
- `WorkEvent`：消息、思考、工具、权限、文件变更、测试、错误和总结的统一事件。

### 验收原则

每个 Feature 需要验证加载、空状态、错误、取消、恢复和权限边界；涉及 Agent 的功能还要验证“新建任务 → 组织上下文 → 执行 → 审查/确认 → 恢复”。主进程是持久化事实来源，renderer 不能绕过 preload 直接访问文件、密钥或工具。

### V1 迁移

“聊天 UI”迁移为 F1.4 Agent 工作流消息流，“InputBar”迁移为 F1.5 Agent Composer；旧章节与旧组件名称仅用于历史兼容。F2.1/F2.4 的 Agent 与 Goal 先作为工作台上下文，再扩展自动编排和子 Agent 委派。

---

## V2 Agent Workbuddy 优先级与依赖

V2 的首个可交付闭环为：主进程持久化工作会话 -> Agent 工作流时间线 -> Agent Composer（文件/模型/插件/目标）-> 工具权限与工作事件 -> 会话即时模型覆盖 -> 目标面板。具体职责如下：

| 优先级 | Feature | V2 交付 |
|--------|---------|---------|
| P0 | F1.3 | `WorkSession` 持久化、恢复与统一工作事件流 |
| P0 | F1.4 | Agent 工作流时间线与结果审查展示 |
| P0 | F1.5 | Agent Composer、图片/文本/代码附件与上下文选择 |
| P0 | F1.6 | 工具执行、权限确认、活动与失败恢复 |
| P0 | F1.8 | Agent 默认模型分配与当前会话即时覆盖 |
| P1 | F2.1 | Agent 定义与工作台 Agent 切换 |
| P1 | F2.4 | 会话目标、步骤、进度、停止/重规划与后续编排 |

依赖关系：`F1.3 → F1.4/F1.5/F1.6/F1.8 → F2.1 → F2.2/F2.3/F2.4`。F1.2 提供图片 Vision 路由，F1.7 提供 Provider 注册，F1.9/F1.10 提供项目与 Git 上下文；F1.11 之后再补全变更审查闭环。

---

## 0. 基础设施层 (Phase 0: Foundation)

> 所有功能模块的公共基座，必须先行完成

### F0.1 项目初始化与工程骨架

- **描述**: Electron + electron-vite + React 18 + TypeScript 项目搭建，依赖安装，构建配置
- **依赖**: 无
- **验收标准**:
  - [ ] `npm run dev` 启动 Electron 开发模式，窗口正常显示
  - [ ] `npm run build` 生成打包产物
  - [ ] TypeScript strict mode 无报错
  - [ ] ESLint + Prettier 配置就绪
  - [ ] 目录结构按 design.md 规范创建
- **技术要点**:
  - electron-vite (react-ts template)
  - React 18.3+, TypeScript 5.x
  - Zustand 4.5+, Tailwind CSS 3.4+
  - main / preload / renderer 三层结构

### F0.2 统一设计系统 (Design System)

- **描述**: 全局统一的设计 token 系统，涵盖颜色、字体、间距、圆角、阴影、动画曲线，支持明暗主题切换
- **依赖**: F0.1
- **验收标准**:
  - [ ] CSS 变量定义所有设计 token（`--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--shadow-*`）
  - [ ] Tailwind config 引用 CSS 变量，组件中使用 `bg-primary` / `text-muted` 等语义类
  - [ ] 明色主题完整可用
  - [ ] 暗色主题 CSS 变量完整定义
  - [ ] 主题切换瞬间生效（CSS variable 切换，无闪烁）
  - [ ] 系统主题跟随模式（`prefers-color-scheme`）
- **技术要点**:
  - 设计 token 层次：Semantic Token (`bg-primary`) → CSS Variable (`--color-primary`) → Raw Value (`#3b82f6`)
  - 色彩系统：primary(蓝) / accent(紫) / neutral(灰) / success(绿) / warning(黄) / danger(红) / info(青)
  - 每色系 11 级（50-950）
  - 字体：UI 字体栈 + 代码字体栈 (JetBrains Mono / Fira Code)
  - 字号：xs(11) / sm(13) / base(14) / lg(16) / xl(20) / 2xl(24) / 3xl(30)
  - 间距：4px 基准，1=4px / 2=8px / 3=12px / 4=16px / 6=24px / 8=32px / 12=48px / 16=64px
  - 圆角：sm(6) / md(8) / lg(12) / xl(16) / 2xl(20) / full(9999)
  - 阴影：sm / md / lg / xl / inner / glow
  - 动画曲线：`ease-out` (150ms, 常规) / `ease-spring` (300ms, 弹性) / `ease-in-out` (200ms, 过渡)

### F0.3 统一布局系统

- **描述**: 应用整体布局骨架，定义各区域尺寸、可折叠行为、响应式适配
- **依赖**: F0.2
- **验收标准**:
  - [ ] 三栏布局：左侧栏(Sidebar, 260px可折叠至48px) + 中间主区(flex-1) + 右侧面板(360px可折叠)
  - [ ] 顶部 TitleBar (40px, 自定义标题栏, 拖拽区域)
  - [ ] 底部输入区域自适应高度
  - [ ] 面板折叠/展开有过渡动画
  - [ ] 最小窗口尺寸 800x600
  - [ ] 默认窗口 1280x800
  - [ ] macOS 风格无边框窗口 (titleBarStyle: hiddenInset)
- **技术要点**:
  - `<AppLayout>` 组件管理三栏 + 顶栏 + 底栏
  - 面板折叠状态存入 Zustand store
  - 面板间用 resize handle 可拖拽调整宽度（后续增强）

### F0.4 通用 UI 基础组件库

- **描述**: 所有功能模块复用的原子组件
- **依赖**: F0.2
- **验收标准**:
  - [ ] Button (variants: primary/secondary/ghost/danger/success, sizes: sm/md/lg, loading state)
  - [ ] Input / Textarea (with label, error, hint)
  - [ ] Tooltip (hover delay, placement: top/bottom/left/right)
  - [ ] Spinner (sizes: sm/md/lg)
  - [ ] Badge (variants: default/success/warning/danger/info, dot variant)
  - [ ] Card (with header/body/footer slots)
  - [ ] Dialog/Modal (overlay, escape to close, focus trap)
  - [ ] Tabs (underline / pill variants)
  - [ ] Dropdown / Select (searchable option)
  - [ ] Switch (toggle)
  - [ ] IconButton (icon-only button with tooltip)
  - [ ] EmptyState (icon + title + description + action)
  - [ ] Toast/Notification (position: top-right, auto-dismiss)
  - [ ] 所有组件支持明暗主题
  - [ ] 所有组件有 TypeScript props 类型定义

### F0.5 IPC 通信层与类型系统

- **描述**: 主进程与渲染进程的安全通信桥接，统一类型定义
- **依赖**: F0.1
- **验收标准**:
  - [ ] preload 脚本通过 contextBridge 暴露类型安全的 API
  - [ ] 所有 IPC 通道有 TypeScript 类型定义
  - [ ] contextIsolation: true, nodeIntegration: false
  - [ ] 渲染进程通过 `window.electronAPI.*` 调用，无直接 Node.js 访问
- **技术要点**:
  - IPC 通道分组: `agent:*` / `provider:*` / `settings:*` / `session:*` / `tool:*` / `git:*` / `mcp:*` / `workflow:*` / `channel:*` / `workspace:*`
  - 统一返回类型 `{ success: boolean; data?: T; error?: string }`

### F0.6 状态管理基础设施

- **描述**: Zustand store 架构，持久化策略
- **依赖**: F0.1, F0.5
- **验收标准**:
  - [ ] Store 分层：chatStore / sessionStore / settingsStore / providerStore / agentStore / workspaceStore / uiStore
  - [ ] uiStore 管理布局状态（面板折叠、当前视图、主题模式）
  - [ ] Devtools middleware 配置（开发模式）
  - [ ] Store 持久化策略定义（哪些状态需要持久化）
- **技术要点**:
  - Zustand + immer middleware (不可变更新)
  - 状态选择器优化 (useShrinkSelector 避免不必要重渲染)

---

## 1. Phase 1: 基础底座 + 代码安全 (Foundation & Code Safety)

### F1.1 多 Provider 注册表与配置

- **描述**: 用户可添加任意数量的 LLM Provider 实例，每个独立配置 API Key / Base URL / 模型列表
- **依赖**: F0.5, F0.6
- **PRD 对应**: 3.1.1, 3.1.2, 3.1.5
- **验收标准**:
  - [ ] 支持 7 种 Provider 类型：OpenAI / Anthropic / DeepSeek / Gemini / Mistral / OpenRouter / Custom
  - [ ] 每个 Provider 实例独立配置：id, name, type, apiKey, baseURL, models[], status
  - [ ] 用户可添加多个同类 Provider（如多个 OpenAI 中转站）
  - [ ] "Auto-detect" 按钮调用 `/models` 接口获取可用模型
  - [ ] "Test" 按钮验证 API Key 和连接
  - [ ] 状态实时显示：绿色(connected) / 黄色(untested) / 红色(error+信息)
  - [ ] API Key 使用 safeStorage 加密存储
  - [ ] 设置持久化到 electron-store
- **技术要点**:
  - `ProviderManager` 类管理注册表
  - `getModel(providerId, modelId)` 通过环境变量注入 API Key 和 baseURL
  - `detectModels()` 通过 fetch 调用 `/models` 接口
  - `testConnection()` 发送简单 complete 请求验证

### F1.2 视觉模型独立配置与自动路由

- **描述**: 与 Chat Model 分开的 Vision Model 配置，图片输入自动路由切换
- **依赖**: F1.1
- **PRD 对应**: 3.1.3, 3.1.4
- **验收标准**:
  - [ ] 独立配置 Vision Model（可选）
  - [ ] 用户消息含图片 → 自动切换到 Vision Model
  - [ ] 工具返回图片 → 自动切换到 Vision Model
  - [ ] 纯文本 → 使用 Chat Model
  - [ ] 未配置 Vision Model 时按 fallbackToChatForImages 决定行为
  - [ ] InputBar 上传图片后显示当前将使用的 Vision Model 名称
  - [ ] Per-Agent 模型分配（每个 Agent 独立配置 Chat/Vision/ThinkingLevel）
- **技术要点**:
  - `prompt()` 函数内路由逻辑
  - `session.setModel()` 动态切换
  - 多模态消息构建 (text + image content blocks)

### F1.3 Pi SDK 集成与 Agent Session 管理

- **描述**: 主进程集成 Pi SDK，创建和管理 AgentSession
- **依赖**: F1.1
- **PRD 对应**: 设计文档 3.3
- **验收标准**:
  - [ ] 应用启动时初始化 AgentSession
  - [ ] 支持 prompt / abort / steer / setModel 操作
  - [ ] Agent 事件转发到渲染进程 (agent:event)
  - [ ] 无 Provider 配置时给出友好引导提示
- **技术要点**:
  - `createAgentSession({ model, thinkingLevel, tools, customTools, sessionManager })`
  - 初始阶段使用 `SessionManager.inMemory()`

### F1.4 Agent 工作流消息流

- **描述**: Agent 工作流时间线，展示任务、思考、工具、权限、文件变更、测试、错误和最终总结
- **依赖**: F0.3, F0.4, F1.3
- **PRD 对应**: 3.7.1, 3.7.2
- **验收标准**:
  - [ ] `WorkEvent` 时间线渲染，不以连续聊天气泡作为主要结构
  - [ ] 任务、思考、工具调用、权限请求、文件变更、测试、错误和总结可区分
  - [ ] 流式文本输出（逐 token 追加）
  - [ ] 工具/权限/变更/测试使用紧凑可展开过程卡片
  - [ ] Markdown 渲染 (react-markdown + remark-gfm)
  - [ ] 代码块语法高亮 (Shiki)
  - [ ] 自动滚动、历史恢复、运行中停止和目标事件筛选
  - [ ] 事件显示来源 Agent、状态、时间和 `goalId`
- **技术要点**:
  - ChatView + MessageBubble + MarkdownRenderer + ToolCallCard
  - useAgent hook 订阅事件 → chatStore 更新
  - 消息虚拟化预留接口（Phase 2 接入 @tanstack/react-virtual）

### F1.5 Agent Composer

- **描述**: 工作台底部任务 Composer，组织文本、文件、模型、插件、目标和 Thinking
- **依赖**: F0.4, F1.2, F1.3
- **PRD 对应**: 3.7.1
- **验收标准**:
  - [ ] 自适应高度 textarea (最大 200px)
  - [ ] Enter 发送 / Shift+Enter 换行
  - [ ] `+` 菜单添加图片、UTF-8 文本和代码文件，展示类型/大小/移除操作
  - [ ] 当前会话模型即时选择、Thinking、插件入口和目标入口
  - [ ] Vision Model 状态提示，图片由 F1.2 路由
  - [ ] `ComposerContext` 显式提交上下文，发送/停止按钮切换
  - [ ] 空任务、无效附件、重复提交和不可用模型有明确状态

### F1.6 Agent 工具执行与权限确认

- **描述**: 工具过程卡片、分级权限审批、执行结果和失败恢复
- **依赖**: F1.3
- **PRD 对应**: 3.3.1, 3.3.2
- **验收标准**:
  - [ ] 注册 7 个内置工具：read / write / edit / bash / grep / find / ls
  - [ ] 只读操作（read/ls/grep/find）自动放行
  - [ ] 写操作（write/edit）弹出确认对话框
  - [ ] 删除操作（bash: rm）弹出确认 + 额外警告
  - [ ] 命令执行（bash）弹出确认，显示完整命令
  - [ ] 确认 UI 显示：工具名 + 参数 + 预期影响
  - [ ] 操作：允许 / 拒绝 / 允许并记住（本次会话不再确认同类）
  - [ ] 快捷键：Enter 确认 / Esc 拒绝
  - [ ] 工具开始/进度/权限/完成/失败写入 `WorkEvent`
  - [ ] 工具失败提供重试、继续、停止或重新规划路径
  - [ ] 插件工具复用同一权限和事件链
- **技术要点**:
  - beforeToolCall 钩子拦截
  - 权限决策缓存（会话级别）

### F1.7 设置中心 — Provider 管理面板

- **描述**: 设置弹窗中的 Provider 管理 Tab
- **依赖**: F1.1, F0.4
- **PRD 对应**: 3.7.3 (Tab 1)
- **验收标准**:
  - [ ] Provider 列表（状态指示器 + 编辑/删除）
  - [ ] 添加 Provider 按钮
  - [ ] Provider 编辑表单（type / name / apiKey / baseURL / models）
  - [ ] Auto-detect 模型按钮
  - [ ] Test 连接按钮 + 结果反馈
  - [ ] 删除确认
  - [ ] API Key 输入框默认隐藏（点击显示）

### F1.8 模型分配与会话即时覆盖

- **描述**: Agent 默认模型分配与当前 `WorkSession` 即时模型覆盖
- **依赖**: F1.7, F1.3
- **PRD 对应**: 3.7.3 (Tab 2)
- **验收标准**:
  - [ ] Chat Model 选择（Provider + Model 下拉）
  - [ ] Vision Model 选择（可选，含"不配置"选项）
  - [ ] Auto-switch on image 开关
  - [ ] Fallback to chat for images 开关
  - [ ] Retry on provider error 开关
  - [ ] Thinking Level 选择（off/low/medium/high）
  - [ ] 设置保存 Agent 默认值，Composer 覆盖只影响当前会话
  - [ ] 清除覆盖后回退默认值，并显示实际生效来源
  - [ ] 模型不可用时阻止发送并给出修复提示

### F1.9 项目自动感知

- **描述**: 打开目录时自动检测项目类型，注入 Agent 上下文
- **依赖**: F1.3
- **PRD 对应**: 3.12.3
- **验收标准**:
  - [ ] 检测标识文件：package.json / Cargo.toml / go.mod / pom.xml / requirements.txt
  - [ ] 识别项目类型：node / python / rust / go / java / cpp / mixed / unknown
  - [ ] 检测框架（react/vue/express/django...）
  - [ ] 检测包管理器（npm/yarn/pnpm/pip/cargo...）
  - [ ] 检测构建系统（vite/webpack/make/cmake...）
  - [ ] 读取构建脚本
  - [ ] 执行 gitStatus 获取版本状态
  - [ ] 扫描目录结构（src/test/config/入口文件）
  - [ ] 构建 ProjectContext 注入 Agent system context

### F1.10 Git 基础集成

- **描述**: 语义化 Git 工具集，会话启动自动注入 Git 状态
- **依赖**: F1.3
- **PRD 对应**: 3.12.1
- **验收标准**:
  - [ ] gitStatus: 返回 branch/ahead/behind/staged/unstaged/untracked
  - [ ] gitBranch: 返回 current/remote/tracking
  - [ ] gitLog: 返回 commit 历史（可按 file/author 过滤）
  - [ ] gitDiff: 返回 staged/unstaged diff
  - [ ] gitShow: 查看指定 commit
  - [ ] gitCommit: 提交（自动生成 commit message）
  - [ ] gitCreateBranch / gitCheckout / gitStash / gitStashPop
  - [ ] 会话启动时自动执行 gitStatus 注入上下文

### F1.11 Diff 审查与 Checkpoint 回滚

- **描述**: Agent 修改文件后的可控审查机制
- **依赖**: F1.6
- **PRD 对应**: 3.13.1
- **验收标准**:
  - [ ] beforeToolCall 自动创建 Checkpoint（保存文件当前状态）
  - [ ] afterToolCall 生成 Diff
  - [ ] UI 侧边面板展示可视化 Diff
  - [ ] 逐 hunk accept / reject / modify
  - [ ] "全部接受" / "全部回滚" 快捷操作
  - [ ] Checkpoint 时间线，可回滚到任意节点
  - [ ] 可视化 Diff：新增(绿底) / 删除(红底) / 修改(黄底)
  - [ ] hunk 级别 accept/reject 按钮
  - [ ] 内联编辑能力（用户可微调 Agent 改动）

### F1.12 多文件变更追踪

- **描述**: 一个功能需求涉及多文件修改的整体视图
- **依赖**: F1.11
- **PRD 对应**: 3.13.2
- **验收标准**:
  - [ ] 变更集面板展示所有被修改的文件列表
  - [ ] 每个文件标注修改原因
  - [ ] 点击文件展开该文件的完整 diff
  - [ ] 顶部操作栏：全部接受 / 全部回滚 / 选择性应用
  - [ ] 与 Git 工作区联动（Agent 改动 vs 用户手动改动）
  - [ ] 一键 git add + commit

### F1.13 Inline 代码变更应用

- **描述**: 对话流内直接渲染 diff 并 accept/reject
- **依赖**: F1.11
- **PRD 对应**: 3.16.5
- **验收标准**:
  - [ ] Agent 修改文件后，消息气泡内渲染 inline diff
  - [ ] 文件名 + 增删行数 + Accept All / Reject All / View in Panel 按钮
  - [ ] 逐 hunk accept/reject 按钮
  - [ ] 多文件变更集卡片（每文件一行 + 展开查看）
  - [ ] Ctrl+Enter = Accept All, Ctrl+Backspace = Reject All
  - [ ] Ctrl+Z = 回滚到上一个 Checkpoint
  - [ ] Undo 语义提示

### F1.14 上下文预算管理

- **描述**: ContextBudgetManager，token 分配与压缩
- **依赖**: F1.3
- **PRD 对应**: 3.16.1
- **验收标准**:
  - [ ] 预算配置（totalLimit + reservedForResponse + 各来源百分比分配）
  - [ ] 智能加载策略（MCP on-demand / Memory lazy / KnowledgeGraph eager / KnowledgeBase on-demand）
  - [ ] buildContext: 分析消息意图 → 分配预算 → 超预算压缩 → 返回 messages
  - [ ] getContextUsage: 实时返回各来源 token 占用
  - [ ] MCP 工具按需加载：list_available_tools → load_tool
  - [ ] 对话历史压缩（超预算时触发 compact）
  - [ ] Token 可视化面板（饼图/堆叠条 + 剩余空间 + 一键 compact）

### F1.15 成本与用量可观测

- **描述**: 实时 token 计数 + 成本估算 + 统计面板
- **依赖**: F1.14
- **PRD 对应**: 3.16.2
- **验收标准**:
  - [ ] 单次请求记录（provider/model/tokens/cost/duration/agent/session/project）
  - [ ] 查询统计（按 session/agent/project/provider/day/month 分组）
  - [ ] 月度预算管理（limit + alert threshold）
  - [ ] Provider 定价表（内置 + 中转手动填写倍率）
  - [ ] 实时 Token 计数器（输入框旁）
  - [ ] 用量统计面板（饼图 + 趋势折线）
  - [ ] 成本预警通知
  - [ ] 模型成本对比表

### F1.16 键盘优先工作流

- **描述**: Command Palette + 快捷键全覆盖 + 快速命令
- **依赖**: F0.3
- **PRD 对应**: 3.16.3
- **验收标准**:
  - [ ] Command Palette (Ctrl+Shift+P)：模糊搜索所有操作
  - [ ] 快捷键全覆盖（Enter/Shift+Enter/Ctrl+C/L/K/N/Tab///Enter/Backspace/Z/D/I）
  - [ ] `/` 快速命令（/agent /skill /tool /model /project）
  - [ ] Vim 模式（可选，后续增强）

### F1.17 设置中心 — 外观与快捷键

- **描述**: 主题、字体、快捷键设置
- **依赖**: F0.2, F0.4
- **PRD 对应**: 3.7.3 (Tab 8)
- **验收标准**:
  - [ ] 主题选择（light / dark / system）
  - [ ] 字体大小调整
  - [ ] 快捷键自定义（查看 + 修改）
  - [ ] 设置实时生效

---

## 2. Phase 2: Agent 编排 + 代码理解 (Multi-Agent & Intelligence)

### F2.1 Agent 定义与工作台切换

- **描述**: Agent 定义、能力边界和当前工作台会话切换
- **依赖**: F1.1, F1.3, F1.8
- **PRD 对应**: 3.2.1, 3.2.2, 3.2.6
- **验收标准**:
  - [ ] AgentDefinition 类型（id/name/description/modelAssignment/systemPrompt/tools/skills/triggers/icon/color/isDefault）
  - [ ] Agent 管理界面（表单创建/编辑/删除）
  - [ ] Markdown 导出/导入（frontmatter + 正文，双向同步）
  - [ ] 预设 Agent：主 Agent / 代码审核 / 测试生成 / 文档生成
  - [ ] Agent 列表 UI（图标 + 名称 + 描述）
  - [ ] 顶部/Composer 可切换当前会话 Agent，历史事件保留来源
  - [ ] 右侧显示工具白名单、Skills、插件状态和模型来源
  - [ ] Agent 白名单不绕过 F1.6 权限确认

### F2.2 会话分支系统

- **描述**: Git-like 会话分支，上下文智能路由
- **依赖**: F2.1
- **PRD 对应**: 3.2.3, 3.2.4, 3.6
- **验收标准**:
  - [ ] 主会话 + 子分支模型
  - [ ] 拉起 Agent 时自动创建子分支
  - [ ] 子分支继承主会话智能摘要上下文
  - [ ] 子分支输出可"合并"回主会话
  - [ ] 分支树可视化（侧边面板展示分支关系）
  - [ ] 上下文摘要策略（任务目标/关键文件/重要决策/最近上下文/工具结果）
  - [ ] 会话持久化（SQLite）
  - [ ] 会话搜索（全文 + 语义）
  - [ ] 会话导出（JSON / Markdown）

### F2.3 Agent 结果展示与切换

- **描述**: Agent 结果可切换展示模式
- **依赖**: F2.1
- **PRD 对应**: 3.2.5
- **验收标准**:
  - [ ] 主对话模式：Agent 结果作为消息插入主对话流
  - [ ] 侧边面板模式：Agent 结果在右侧面板独立展示
  - [ ] 设置中切换默认模式
  - [ ] 每次调用可临时选择

### F2.4 会话目标与目标规划编排

- **描述**: 会话级 Goal、步骤、进度、停止/重规划和后续编排
- **依赖**: F2.1, F2.2
- **PRD 对应**: 3.10
- **验收标准**:
  - [ ] plan / create_task / update_task / get_tasks / delegate_task 工具集
  - [ ] 任务状态：pending → in_progress → completed / blocked / failed
  - [ ] 编排策略：顺序 / 并行 / 条件分支 / 子 Agent 委派
  - [ ] 任务面板 UI（任务列表 + 进度条 + 状态更新）
  - [ ] 任务卡片展开查看详情
  - [ ] 实时更新状态
  - [ ] 手动干预（跳过/重新排序/修改）
  - [ ] Goal 在顶部、Composer 和右侧面板保持一致
  - [ ] 目标相关事件通过 `goalId` 关联并可筛选
  - [ ] 首轮保留自动拆解、并行编排和子 Agent 委派为后续范围

### F2.5 代码知识图谱

- **描述**: tree-sitter AST 解析 → SQLite 图存储，Agent 查询图谱省 90%+ token
- **依赖**: F1.9
- **PRD 对应**: 3.12.2
- **验收标准**:
  - [ ] FileNode / SymbolNode / RelationshipEdge 数据结构
  - [ ] tree-sitter 多语言解析（TS/JS/Python/Rust/Go/Java）
  - [ ] 首次索引：扫描 → AST 解析 → 摘要生成 → 写入 SQLite + FTS5
  - [ ] 增量更新（文件保存/git checkout/重新打开/手动重建）
  - [ ] 8 个查询工具：search_symbols / find_references / get_call_graph / get_file_summary / get_dependencies / get_impact_analysis / read_code_range / get_module_structure
  - [ ] get_project_overview（会话启动注入）
  - [ ] 渐进式构建（Phase 0 目录扫描 → Phase 1 入口文件 → Phase 2 全量 → Phase 3 摘要）
  - [ ] AST Worker 线程（不阻塞 UI）
  - [ ] 索引进度指示器
  - [ ] 摘要生成（可配置模型，可关闭）

### F2.6 错误与日志分析

- **描述**: 解析错误输出，定位根因，关联代码
- **依赖**: F2.5
- **PRD 对应**: 3.14.1
- **验收标准**:
  - [ ] parseStackTrace: 结构化解析堆栈跟踪
  - [ ] analyzeBuildError: 构建错误分析
  - [ ] analyzeTestFailure: 测试失败分析
  - [ ] parseLogs: 日志解析（按 level/pattern 过滤）
  - [ ] findErrorPatterns: 错误模式匹配
  - [ ] locateSource: 定位到具体文件和行号
  - [ ] 根因分析 + 修复建议
  - [ ] 用户确认 → 执行修复（走 Checkpoint + Diff 审查）

### F2.7 交互式终端

- **描述**: 持久化终端会话，支持交互式命令
- **依赖**: F0.3
- **PRD 对应**: 3.14.2
- **验收标准**:
  - [ ] createSession / sendInput / getOutput / resizeTerminal / closeSession
  - [ ] runInteractive: Agent 可执行交互式命令
  - [ ] 底部面板终端视图（xterm.js）
  - [ ] Agent 和用户共享终端
  - [ ] dev server 持续监控
  - [ ] REPL 交互式测试

### F2.8 沙箱代码执行

- **描述**: Agent 生成的代码片段在沙箱中安全运行
- **依赖**: F1.6
- **PRD 对应**: 3.14.3
- **验收标准**:
  - [ ] 支持 JS/TS (isolated-vm) / Python (子进程) / Shell (临时目录)
  - [ ] 文件系统隔离（只访问临时目录）
  - [ ] 网络可选（默认禁用）
  - [ ] 资源限制（CPU/内存）
  - [ ] 返回 stdout/stderr/exitCode/duration
  - [ ] 验证通过后再写入项目文件

### F2.9 项目首次接入引导

- **描述**: 首次打开项目时的接入流程和项目卡片
- **依赖**: F1.9, F2.5
- **PRD 对应**: 3.16.6
- **验收标准**:
  - [ ] 项目检测（<1 秒）：技术栈/目录/入口/构建命令/测试命令
  - [ ] 知识图谱渐进构建进度指示器
  - [ ] 项目卡片：架构概览图 + 编码约定 + 关键文件 + 依赖分析
  - [ ] 编码约定提取（eslint/prettier/tsconfig）
  - [ ] 首轮对话建议
  - [ ] 侧边栏项目卡片展示

### F2.10 消息列表虚拟化

- **描述**: 大量消息高性能渲染
- **依赖**: F1.4
- **PRD 对应**: 3.16.4
- **验收标准**:
  - [ ] @tanstack/react-virtual 只渲染可见区域
  - [ ] Markdown 渲染结果缓存
  - [ ] 工具调用卡片懒加载
  - [ ] 万条消息无卡顿

---

## 3. Phase 3: MCP 工具生态 + 多项目 (MCP & Multi-Project)

### F3.1 MCP 客户端集成

- **描述**: MCP Server 子进程管理 + 工具自动注册
- **依赖**: F1.6
- **PRD 对应**: 3.8
- **验收标准**:
  - [ ] mcp.json 配置文件读取和管理
  - [ ] MCP Server 子进程管理（stdio 通信）
  - [ ] tools/list 自动发现 + pi.registerTool() 注册
  - [ ] MCP 工具按需加载（list_available_tools → load_tool）
  - [ ] MCP 工具权限配置（per-server: auto/confirm/disabled）
  - [ ] MCP Resources 浏览 UI
  - [ ] MCP Prompts `/` 命令调用
  - [ ] MCP 设置面板（添加/编辑/删除/测试）
  - [ ] 应用关闭时清理子进程

### F3.2 Git 深度集成

- **描述**: Git 工具集扩展（blame/PR/冲突辅助）
- **依赖**: F1.10
- **PRD 对应**: 3.12.1 (扩展)
- **验收标准**:
  - [ ] gitBlame: 行级 blame 信息
  - [ ] gitCreatePR: GitHub/GitLab/Gitea PR 创建
  - [ ] commit message 自动生成（基于 diff 调用 LLM）
  - [ ] 合并冲突辅助解决

### F3.3 多项目工作区

- **描述**: 多项目管理 + 跨项目参考
- **依赖**: F1.9, F2.5
- **PRD 对应**: 3.15
- **验收标准**:
  - [ ] Workspace 模型（多项目 + 活跃项目）
  - [ ] 每项目独立配置和记忆
  - [ ] 项目标签页 / 切换
  - [ ] 跨项目参考（read-only / read-execute）
  - [ ] 跨项目搜索（指定/全部项目）
  - [ ] 实现对比（compareImplementations）
  - [ ] 引用标注和跳转
  - [ ] 参考项目面板

### F3.4 重构辅助

- **描述**: 基于 AST 的安全重构
- **依赖**: F2.5
- **PRD 对应**: 3.13.3
- **验收标准**:
  - [ ] detectCodeSmells / detectDuplicates / calculateComplexity
  - [ ] renameSymbol / extractFunction / moveSymbol / inlineFunction
  - [ ] 所有操作基于 AST，自动更新引用点
  - [ ] 操作前创建 Checkpoint，支持回滚

### F3.5 测试工作流闭环

- **描述**: 测试运行 → 解析 → 修复 → 再运行
- **依赖**: F2.5, F2.6
- **PRD 对应**: 3.16.7
- **验收标准**:
  - [ ] runTests (all/file/pattern/changed + watch 模式)
  - [ ] parseTestResult: 结构化解析
  - [ ] analyzeFailures: 结合知识图谱分析
  - [ ] fixAndRetry: Agent 修复 → 应用变更 → 重新运行
  - [ ] getCoverage: 覆盖率报告 + 对比
  - [ ] 测试质量分析（无效测试/重复度/速度/覆盖关联）

---

## 4. Phase 4: 记忆系统 (Memory)

### F4.1 多层级记忆系统

- **描述**: 项目级/用户级/会话级/行为学习四层记忆
- **依赖**: F1.3
- **PRD 对应**: 3.4
- **验收标准**:
  - [ ] 项目级记忆（.agentbuddy/memory/）
  - [ ] 用户级偏好（~/.agentbuddy/memory/）
  - [ ] 会话摘要自动生成
  - [ ] 行为学习（采纳/拒绝追踪）
  - [ ] 记忆自动写入（工作日志 append-only）
  - [ ] 记忆主动建议
  - [ ] 会话开始时自动注入
  - [ ] 记忆管理界面（查看/编辑/删除/手动添加）
  - [ ] 会话历史搜索

---

## 5. Phase 5: 知识库 (Knowledge Base)

### F5.1 个人知识库

- **描述**: RAG 检索 + 自动积累 + 可分享
- **依赖**: F4.1
- **PRD 对应**: 3.5
- **验收标准**:
  - [ ] SQLite + 向量存储基础设施
  - [ ] Embedding 调用（配置的 Provider）
  - [ ] 知识卡片数据模型与存储
  - [ ] 自动积累机制（Agent 提取 + 用户确认）
  - [ ] 手动添加（文档/笔记/代码/链接）
  - [ ] 语义搜索 + 全文搜索
  - [ ] RAG 检索注入
  - [ ] 主动提醒
  - [ ] 知识库浏览界面（分类/标签/时间/搜索）
  - [ ] 知识包导出/导入

---

## 6. Phase 6: 定时工作流 + 消息网关 (Workflow & Gateway)

### F6.1 定时工作流引擎

- **描述**: Cron 调度 + Webhook + 自然语言配置
- **依赖**: F2.1
- **PRD 对应**: 3.9
- **验收标准**:
  - [ ] node-cron 调度器
  - [ ] 工作流定义模型和存储（SQLite）
  - [ ] Cron / Webhook / Event 三种触发方式
  - [ ] 自然语言 → cron 表达式转换
  - [ ] Webhook HTTP 服务器
  - [ ] 工作流管理 UI（创建/编辑/启用/禁用/历史）
  - [ ] 执行引擎（触发 → 创建会话 → 执行 → 输出）
  - [ ] 输出渠道配置

### F6.2 消息平台网关

- **描述**: 微信/QQ/钉钉/飞书集成 + 跨渠道记忆
- **依赖**: F6.1, F4.1
- **PRD 对应**: 3.11
- **验收标准**:
  - [ ] Gateway 网关架构
  - [ ] 钉钉 Stream 模式适配器
  - [ ] QQ Bot API 适配器
  - [ ] 飞书事件订阅适配器
  - [ ] 企业微信适配器
  - [ ] Webhook 通用适配器
  - [ ] 渠道-Agent 路由配置 UI
  - [ ] 会话映射（外部 ID ↔ 内部会话）
  - [ ] 跨渠道记忆
  - [ ] DM 安全策略（pairing/open/closed）
  - [ ] 流式响应推送
  - [ ] 工具权限降级

---

## 7. Phase 7: 精细化 (Polish)

### F7.1 Skills 系统

- **描述**: Markdown 指令 + 加载/管理
- **PRD 对应**: 3.3.4
- **验收标准**:
  - [ ] Skills 格式（frontmatter + 指令正文）
  - [ ] Agent 定义中指定加载的 Skills
  - [ ] 设置中心浏览/启用/禁用/编辑
  - [ ] Skills 文件分享

### F7.2 自定义工具脚本

- **描述**: 用户通过 JS/TS 脚本定义自定义工具
- **PRD 对应**: 3.3.3
- **验收标准**:
  - [ ] 工具脚本格式（name/description/parameters/permissions/execute）
  - [ ] 工具管理界面
  - [ ] 工具测试功能

### F7.3 会话分支树可视化

- **描述**: 可视化展示分支关系
- **PRD 对应**: 3.2.3
- **验收标准**:
  - [ ] 分支树图形化展示
  - [ ] 点击分支跳转到对应会话

### F7.4 暗色主题完善

- **描述**: 完整暗色主题适配
- **依赖**: F0.2
- **验收标准**:
  - [ ] 所有组件暗色模式适配
  - [ ] 代码高亮暗色主题
  - [ ] Markdown 渲染暗色适配

### F7.5 应用打包与分发

- **描述**: 跨平台打包
- **验收标准**:
  - [ ] Windows 打包（NSIS installer）
  - [ ] macOS 打包（DMG）
  - [ ] Linux 打包（AppImage / deb）
  - [ ] 自动更新机制

### F7.6 插件生态与分享

- **描述**: 社区市场 + 一键安装
- **PRD 对应**: 3.16.8
- **验收标准**:
  - [ ] 社区索引（listPlugins / install / update / publish）
  - [ ] 打包格式（.agentbuddy-pack）
  - [ ] 兼容性检查
  - [ ] 安装安全审计

### F7.7 后台守护进程

- **描述**: 关闭窗口后 Gateway 和调度器继续运行
- **验收标准**:
  - [ ] System tray 集成
  - [ ] 守护进程模式

---

## Feature 依赖关系图

```
F0.1 ──┬── F0.2 ──┬── F0.3 ──── F0.4
       │          └── F0.6
       └── F0.5

F1.1 ──┬── F1.2 ──── F1.5
       ├── F1.3 ──┬── F1.4
       │          ├── F1.6 ──┬── F1.11 ── F1.12
       │          │          └── F1.13
       │          ├── F1.9 ──┬── F2.5
       │          │          └── F2.9
       │          ├── F1.10 ── F3.2
       │          └── F1.14 ── F1.15
       ├── F1.7
       └── F1.8

F0.2 ── F1.16
F0.2 ── F1.17

F2.1 ──┬── F2.2 ──── F2.4
       └── F2.3

F2.5 ──┬── F2.6
       ├── F3.3
       ├── F3.4
       └── F3.5

F1.6 ── F3.1
F2.1 ── F6.1 ── F6.2
F1.3 ── F4.1 ── F5.1
```

---

## 开发顺序（推荐执行序）

| 顺序 | Feature | 说明 |
|------|---------|------|
| 1 | F0.1 | 项目骨架 |
| 2 | F0.2 | 设计系统 |
| 3 | F0.5 | IPC 层 |
| 4 | F0.6 | 状态管理 |
| 5 | F0.3 | 布局系统 |
| 6 | F0.4 | UI 组件库 |
| 7 | F1.1 | Provider 注册表 |
| 8 | F1.3 | Pi SDK 集成 |
| 9 | F1.2 | 视觉模型路由 |
| 10 | F1.4 | Agent 工作流消息流 |
| 11 | F1.5 | Agent Composer |
| 12 | F1.6 | 工具权限 |
| 13 | F1.7 | Provider 面板 |
| 14 | F1.8 | 模型分配面板 |
| 15 | F1.9 | 项目感知 |
| 16 | F1.10 | Git 集成 |
| 17 | F1.11 | Diff 审查 |
| 18 | F1.12 | 变更追踪 |
| 19 | F1.13 | Inline Diff |
| 20 | F1.14 | 上下文预算 |
| 21 | F1.15 | 成本可观测 |
| 22 | F1.16 | 键盘工作流 |
| 23 | F1.17 | 外观设置 |
| 24 | F2.1 | Agent 定义与工作台切换 |
| 25 | F2.2/F2.3 | 分支与 Agent 结果展示 |
| 26 | F2.4 | 会话目标与停止/重规划 |
| ... | ... | 后续 Phase 按依赖关系推进 |
