# Agent Buddy — 桌面端 UI 高保真原型

面向开发任务的 **多 Agent 协作工作台**（Electron + React + TypeScript）的可交互桌面端原型。
本文件是一个**单文件、零依赖**的 HTML 原型，可直接在浏览器/WorkBuddy 预览面板打开，无需构建或启动本地服务。

> 原型用于设计评审与交互验证。视觉 token（CSS 变量）可直接复用到正式的 `.ardot` / React 实现中。

## 预览方式

- 直接在 WorkBuddy 内置预览面板打开 `agent-buddy-desktop.html`（推荐，无需本地服务）。
- 或双击用浏览器打开（部分浏览器对 `file://` 下的内联脚本有限制，建议用预览面板）。

## 信息架构（13 个视图）

| 区域 | 视图 | 说明 |
|------|------|------|
| 工作台 | 工作台 / 会话 | 中央 Agent 工作流时间线（WorkEvent）、右侧上下文面板、底部 Composer |
| 组织 | 项目 / 智能体 / 目标 | 项目、Agent 卡片（点击查看权限矩阵）、Goal 管理 |
| 生态 | 插件 / 供应商 / 模型分配 | 插件解析同步本地插件、Provider 管理、Agent→模型分配 |
| 平台 | 记忆 / 知识库 / MCP / 工作流 / 网关 / 代码图谱 | Memory(RAG)、Knowledge Base、MCP 生态、定时 Workflow、消息网关、Code Graph |

## 布局结构

- 顶栏（标题栏 34px + 应用栏 46px）
- 左：活动栏（60px 图标）→ 工作导航（236px，可收起）
- 中：视图区（工作台时间线 + Composer）
- 右：上下文面板（340px，可收起）
- 底栏：状态栏（26px）

左右面板均支持收起（`left-collapsed` / `right-collapsed`，状态持久化到 localStorage）。

## 设计 token（CSS 变量）

- 主题：浅色为默认，深色可一键切换（`data-theme` 属性）。
- 强调色 `--accent: #5B5BD6`（浅）/ `#7B8CFF`（深）。
- 背景层级 `--bg-0..6`、边框 `--border`、文本 `--text-0..3`、柔和底 `--accent-soft`。
- 圆角 `--radius/--radius-sm/--radius-lg`、阴影 `--shadow-sm/--shadow-md`。

## 对话框（Composer）布局约定

- **用户消息居右、无头像图标**（仅气泡）。
- **Agent / 工具 / 系统消息居左**，带图标。
- 对应 CSS：`.ev.user{justify-content:flex-end}` 且 `.ev.user .rail-dot{display:none}`。

## 设置（Settings 弹窗）

点击应用栏齿轮打开，包含 5 个标签页，参考 `features/phase-1` 规格：

| 标签 | 对应规格 | 要点 |
|------|----------|------|
| 外观 | F1.17 | 主题（浅/深）、语言、紧凑模式、发送即运行 |
| 快捷键 | F1.16 | 命令面板、主题切换、聚焦 Composer、接受 hunk、回滚 Checkpoint |
| 供应商 | **F1.7** | 左侧 Provider 列表（连接/未测试/错误状态点）+ 右侧编辑器：类型(7 种)、名称、API Key(密码+显隐)、Base URL、模型列表(可增删)、自动探测/测试连接/保存/删除 |
| 模型分配 | **F1.8** | Agent 选择标签；聊天模型(供应商+模型两级)；视觉模型(可开关)；行为开关 `autoSwitchOnImage`/`fallbackToChatForImages`/`retryOnProviderError`；思考深度 4 档卡片(关/低/中/高)；重置/保存 |
| 隐私与加密 | — | 本地会话加密、API Key 仅存主进程、项目摘要脱敏 |

## 交互细节

- 命令面板：`Ctrl/Cmd + Shift + P`。
- 面板收起：应用栏左右箭头按钮。
- Toast 通知：`showToast(msg, type)`。
- 详情抽屉：智能体（权限矩阵）、知识库（RAG）、MCP（工具）卡片点击弹出。
- 插件：支持「解析本地插件」扫描 `~/.agentbuddy/plugins`。

## 已知限制

- 数据为示例静态数据，未接真实 Provider / 模型 API。
- 单文件原型，未在真实 Electron 环境中验证 `contextIsolation` / `nodeIntegration` 等安全边界。
- 代码图谱、网关路由等为示意视图，非完整编辑器。

## v2 重设计（`agent-buddy-desktop-v2.html`）

参考 **OpenAI Codex 桌面应用** 与 **腾讯 WorkBuddy 桌面端** 的布局范式，对系统 UI 与导航做整体重设计，原 `agent-buddy-desktop.html`（v1）保留作对比。

参考要点：
- **Codex**：会话优先的主区、左侧项目/会话列表 + 功能导航、底部强 composer（`@` 提及 / 附件 / 权限选择 / 模型选择）、右侧审查面板（diff + chunk 接受/拒绝）、运行模式（本地 / Worktree / 云端）。
- **WorkBuddy**：三栏工作台（左导航 → 中对话 → 右成果，含 概览/产物/全部文件/变更）、顶栏模型选择 + 场景模式、任务/会话列表、多 Agent 并行。

v2 落地的新结构：
- **顶栏**：品牌 + 场景模式分段（开发/审阅/探索）+ 模型选择器（下拉切换 Provider/模型）+ 搜索 + 主题 + 列表/上下文折叠 + 设置 + 账户头像。
- **左图标栏（66px）**：工作台/智能体/项目/插件/知识/MCP/流程/网关/图谱/记忆/目标 + 设置。
- **左列表栏（272px，可折叠，上下文感知）**：工作台视图下列出会话（今天/本周/更早，带搜索与新建），点击载入中区时间线。
- **中区（会话优先）**：会话头（标题 + 参与 Agent 头像 + 运行模式 本地/隔离/云端）+ WorkEvent 时间线（用户靠右无头像、Agent/工具/系统靠左，工具卡片可折叠显示 diff 与接受/拒绝）+ 强 composer（附件/`@`/语音 + 默认权限 只读/可编辑/可执行 + 发送）。空态有欢迎与提示词。
- **右上下文面板（330px，可折叠）**：目标 / 文件变更 / 上下文 / 记忆 四 Tab。
- 其余模块（智能体/项目/插件/知识库/MCP/工作流/网关/图谱/记忆/目标）以卡片网格呈现，点击可开详情抽屉。
- 沿用 v1 的设置弹窗（外观/快捷键/供应商 F1.7/模型分配 F1.8/隐私）与命令面板。

预览：用 WorkBuddy 内置预览面板打开（勿手起本地服务）。

## 设计原则（来自 ardot-ui-design 通用准则）

Purpose First / Dominant Region / Progressive Disclosure / Recognition Over Recall / System Status Visibility（加载/空/错误/成功/权限态）/ Action Hierarchy / Structural Consistency / Density Intentionality / Spatial Logic（单一主轴、优先两区、避免嵌套滚动）。
