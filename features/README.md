# Agent Buddy — Feature Specifications

> PRD → Spec Coding 拆分文档库
> 共 49 个 Feature，按 7 个 Phase 组织，每个 Feature 一个独立文档
> **V2 需求方向**：以 [Agent Workbuddy 需求调整](../agent-workbuddy-v2.md) 为产品工作台、会话、Composer、目标和插件上下文的权威约定。

---

## V2 首轮交付顺序

1. F1.3：持久化 `WorkSession` 与统一 `WorkEvent`。
2. F1.4：Agent 工作流时间线、工具/变更/验证记录与右侧审查上下文。
3. F1.5：Agent Composer，支持当前会话模型、图片/文本/代码附件、插件和目标入口。
4. F1.6：工具执行与分级权限确认。
5. F1.8：Agent 默认模型分配与当前会话即时覆盖。
6. F2.1：Agent 定义与工作台切换。
7. F2.2/F2.3：会话分支、Agent 结果展示与切换。
8. F2.4：会话目标、停止/重规划和后续编排。

旧的 Phase 顺序保留为完整能力依赖图；V2 首轮完成后再继续项目感知、Git、复杂编排和生态能力。所有 Feature 的 V2 章节优先于旧 V1 描述，旧描述只作为迁移背景。

## V2 验收主线

每轮开发都必须覆盖：`新建任务 → 选择 Agent/模型 → 附件/插件/目标 → Agent 工作流 → 权限确认或中止 → 文件变更/测试审查 → 重启恢复`。工作台默认采用紧凑浅色布局，保留深色主题；Codex Desktop 仅作为信息架构参考。

## 当前文档阶段

本轮先完成 V2 需求、设计、依赖和验收口径同步，暂不修改应用实现。文档评审通过后，按 P0/P1 顺序逐项开发；实现时只能勾选已有证据支持的验收项，并在对应 Feature 中记录迁移影响。

---

## 文档结构

每个 Feature 文档包含以下章节：

| 章节       | 内容                                                        |
| ---------- | ----------------------------------------------------------- |
| 概述       | 功能描述、解决的问题、核心价值                              |
| PRD 对应   | 关联的 PRD 章节号                                           |
| 验收标准   | 功能验收 + 非功能验收（可勾选 checkbox）                    |
| 技术设计   | 数据模型（TS 接口）、IPC 通道、组件结构、关键逻辑、文件清单 |
| UI/UX 规范 | 视觉设计、交互、动画                                        |
| 测试要点   | 单元测试、集成测试、E2E 测试                                |
| 开放问题   | 待确认的设计决策                                            |
| 备注       | 补充说明                                                    |

---

## Phase 总览

| Phase    | 名称                  | Feature 数 | 文档大小    | 核心交付                                                                           |
| -------- | --------------------- | ---------- | ----------- | ---------------------------------------------------------------------------------- |
| Phase 0  | 基础设施层            | 6          | ~114 KB     | 项目骨架、设计系统、布局、UI 组件、IPC、状态管理                                   |
| Phase 1  | 基础底座 + 代码安全   | 17         | ~327 KB     | Provider、Agent 工作台、Composer、工具权限、Git、Diff 审查、上下文预算、成本、键盘 |
| Phase 2  | Agent 编排 + 代码理解 | 10         | ~183 KB     | Agent 定义、会话分支、知识图谱、调试终端、沙箱                                     |
| Phase 3  | MCP 工具 + 多项目     | 5          | ~75 KB      | MCP 客户端、Git 深度、多项目工作区、重构、测试闭环                                 |
| Phase 4  | 记忆系统              | 1          | ~15 KB      | 四层记忆（项目/用户/会话/行为学习）                                                |
| Phase 5  | 知识库                | 1          | ~17 KB      | RAG 检索、自动积累、知识卡片                                                       |
| Phase 6  | 工作流 + 消息网关     | 2          | ~34 KB      | Cron 调度、消息平台网关                                                            |
| Phase 7  | 精细化                | 7          | ~55 KB      | Skills、自定义工具、暗色主题、打包、插件市场                                       |
| **合计** |                       | **49**     | **~820 KB** |                                                                                    |

---

## Phase 0: 基础设施层 (Foundation)

> 所有功能模块的公共基座，必须先行完成 ✅ 已实现

| Feature | 文档                                                 | 描述                                             | 依赖       | 状态      |
| ------- | ---------------------------------------------------- | ------------------------------------------------ | ---------- | --------- |
| F0.1    | [项目初始化与工程骨架](phase-0/F0.1-project-init.md) | Electron + electron-vite + React 18 + TypeScript | 无         | ✅ 已实现 |
| F0.2    | [统一设计系统](phase-0/F0.2-design-system.md)        | 颜色/字体/间距/圆角/阴影/主题 CSS 变量           | F0.1       | ✅ 已实现 |
| F0.3    | [统一布局系统](phase-0/F0.3-layout-system.md)        | TitleBar + Sidebar + MainContent + RightPanel    | F0.2       | ✅ 已实现 |
| F0.4    | [通用 UI 基础组件库](phase-0/F0.4-ui-components.md)  | 14 个原子组件（Button/Input/Dialog 等）          | F0.2       | ✅ 已实现 |
| F0.5    | [IPC 通信层与类型系统](phase-0/F0.5-ipc-layer.md)    | contextBridge 安全通信 + 统一返回类型            | F0.1       | ✅ 已实现 |
| F0.6    | [状态管理基础设施](phase-0/F0.6-state-management.md) | 8 个 Zustand store + 持久化策略                  | F0.1, F0.5 | ✅ 已实现 |

---

## Phase 1: 基础底座 + 代码安全 (Foundation & Code Safety)

> 单 Agent 能在可恢复的工作会话内完成任务、使用工具、配置多模型，并让代码修改可控审查

| Feature | 文档                                                                    | 描述                                      | 依赖             | 状态         |
| ------- | ----------------------------------------------------------------------- | ----------------------------------------- | ---------------- | ------------ |
| F1.1    | [多 Provider 注册表与配置](phase-1/F1.1-provider-registry.md)           | 7 种 Provider 类型 + 中转 + 加密存储      | F0.5, F0.6       | ✅ 已完成    |
| F1.2    | [视觉模型独立配置与自动路由](phase-1/F1.2-vision-model-routing.md)      | 图片输入自动切换 Vision Model             | F1.1             | 🚧 进行中    |
| F1.3    | [Pi SDK 集成与 Agent Session 管理](phase-1/F1.3-pi-sdk-integration.md)  | AgentSession 生命周期管理                 | F1.1             | 🚧 进行中    |
| F1.4    | [Agent 工作流消息流](phase-1/F1.4-chat-ui.md)                           | 任务、工具、变更、验证与结果时间线        | F0.3, F0.4, F1.3 | 🔄 V2 重构   |
| F1.5    | [Agent Composer](phase-1/F1.5-input-bar.md)                             | 文件 + 模型 + 插件 + 目标 + 发送控制      | F0.4, F1.2, F1.3 | 🔄 V2 实现中 |
| F1.6    | [Agent 工具执行与权限确认](phase-1/F1.6-tool-permissions.md)            | 工具、分级权限、工作事件与失败恢复        | F1.3             | 🔄 V2 实现中 |
| F1.7    | [设置中心 — Provider 管理面板](phase-1/F1.7-provider-settings-panel.md) | Provider 列表 + 编辑 + 测试               | F1.1, F0.4       | ✅ 已完成    |
| F1.8    | [模型分配与会话即时覆盖](phase-1/F1.8-model-assignment-panel.md)        | Agent 默认模型 + 会话模型/Thinking 覆盖   | F1.7, F1.3       | 🔄 V2 重构   |
| F1.9    | [项目自动感知](phase-1/F1.9-project-detection.md)                       | 技术栈/框架/构建系统自动检测              | F1.3             | 🔄 V2 实现中 |
| F1.10   | [Git 基础集成](phase-1/F1.10-git-integration.md)                        | 只读 status 上下文（diff/log/写操作后续） | F1.3             | 🔄 V2 实现中 |
| F1.11   | [Diff 审查与 Checkpoint 回滚](phase-1/F1.11-diff-review.md)             | 单文件 Checkpoint + hunk 审查/回滚首轮    | F1.6             | 🔄 V2 实现中 |
| F1.12   | [多文件变更追踪](phase-1/F1.12-multi-file-changes.md)                   | 会话变更集 + 修改原因 + 文件/批量审查     | F1.11            | 🔄 V2 实现中 |
| F1.13   | [Inline 代码变更应用](phase-1/F1.13-inline-diff.md)                     | 工作流内联 diff + 任务级审查与快捷操作    | F1.11, F1.12     | 🔄 V2 实现中 |
| F1.14   | [上下文预算管理](phase-1/F1.14-context-budget.md)                       | 主进程预算、历史压缩与实时用量面板        | F1.3, F1.9, F1.10 | 🔄 V2 实现中 |
| F1.15   | [成本与用量可观测](phase-1/F1.15-cost-observability.md)                 | 用量记录、会话摘要、预算与模型定价入口    | F1.3, F1.14      | 🔄 V2 首轮完成 |
| F1.16   | [键盘优先工作流](phase-1/F1.16-keyboard-workflow.md)                    | 命令面板、工作台快捷键与 Composer `/` 命令 | F0.3, F1.3, F1.5 | 🔄 V2 实现中 |
| F1.17   | [设置中心 — 外观与快捷键](phase-1/F1.17-appearance-settings.md)         | 主题、字体 token 与工作台快捷键覆盖       | F0.2, F0.4, F1.16 | 🔄 V2 实现中 |

---

## Phase 2: Agent 编排 + 代码理解 (Multi-Agent & Intelligence)

> 多 Agent 协作、会话分支、代码知识图谱、调试能力

| Feature | 文档                                                         | 描述                                           | 依赖             |
| ------- | ------------------------------------------------------------ | ---------------------------------------------- | ---------------- |
| F2.1    | [Agent 定义与工作台切换](phase-2/F2.1-agent-definition.md)   | 类型系统 + 表单创建 + 工作台选择/切换          | F1.1, F1.3, F1.8 |
| F2.2    | [会话分支系统](phase-2/F2.2-session-branching.md)            | 手动分支 + 受限上下文 + 合并审查               | F2.1             |
| F2.3    | [Agent 结果展示与切换](phase-2/F2.3-agent-result-display.md) | 主对话模式 / 侧边面板模式                      | F2.1             |
| F2.4    | [会话目标与目标规划编排](phase-2/F2.4-goal-planning.md)      | 会话目标 + 步骤 + 停止/重规划/事件筛选         | F1.3, F2.1, F2.2 |
| F2.5    | [代码知识图谱](phase-2/F2.5-code-knowledge-graph.md)         | tree-sitter AST → SQLite 图存储，省 90%+ token | F1.9             |
| F2.6    | [错误与日志分析](phase-2/F2.6-error-log-analysis.md)         | 堆栈解析 + 构建错误 + 日志模式 + 根因分析      | F2.5             |
| F2.7    | [交互式终端](phase-2/F2.7-interactive-terminal.md)           | node-pty 持久终端 + xterm.js + Agent 共享      | F0.3             |
| F2.8    | [沙箱代码执行](phase-2/F2.8-sandbox-execution.md)            | isolated-vm (JS) + 子进程 (Python/Shell)       | F1.6             |
| F2.9    | [项目首次接入引导](phase-2/F2.9-project-onboarding.md)       | 项目卡片 + 架构概览 + 编码约定 + 建议          | F1.9, F2.5       |
| F2.10   | [消息列表虚拟化](phase-2/F2.10-message-virtualization.md)    | @tanstack/react-virtual + Markdown 缓存        | F1.4             |

---

## Phase 3: MCP 工具生态 + 多项目 (MCP & Multi-Project)

> MCP 工具无缝接入、多项目管理与跨项目参考

| Feature | 文档                                                    | 描述                                             | 依赖       |
| ------- | ------------------------------------------------------- | ------------------------------------------------ | ---------- |
| F3.1    | [MCP 客户端集成](phase-3/F3.1-mcp-client.md)            | MCP Server 子进程 + 工具自动注册 + 按需加载      | F1.6       |
| F3.2    | [Git 深度集成](phase-3/F3.2-git-advanced.md)            | blame + PR 创建 + commit message 生成 + 冲突辅助 | F1.10      |
| F3.3    | [多项目工作区](phase-3/F3.3-multi-project-workspace.md) | 多项目 + 跨项目参考 + 跨项目搜索                 | F1.9, F2.5 |
| F3.4    | [重构辅助](phase-3/F3.4-refactor-assist.md)             | AST 安全重构 + 代码异味检测 + 复杂度分析         | F2.5       |
| F3.5    | [测试工作流闭环](phase-3/F3.5-test-workflow.md)         | 运行→解析→修复→再运行 + 覆盖率                   | F2.5, F2.6 |

---

## Phase 4: 记忆系统 (Memory)

> 多层级记忆、跨会话延续、行为学习

| Feature | 文档                                            | 描述                                | 依赖 |
| ------- | ----------------------------------------------- | ----------------------------------- | ---- |
| F4.1    | [多层级记忆系统](phase-4/F4.1-memory-system.md) | 项目级/用户级/会话摘要/行为学习四层 | F1.3 |

---

## Phase 5: 知识库 (Knowledge Base)

> 个人知识库、RAG 检索、自动积累

| Feature | 文档                                         | 描述                                     | 依赖 |
| ------- | -------------------------------------------- | ---------------------------------------- | ---- |
| F5.1    | [个人知识库](phase-5/F5.1-knowledge-base.md) | SQLite+向量 + Embedding + RAG + 自动积累 | F4.1 |

---

## Phase 6: 定时工作流 + 消息网关 (Workflow & Gateway)

> 定时自动化、消息平台集成、跨渠道会话

| Feature | 文档                                              | 描述                                      | 依赖       |
| ------- | ------------------------------------------------- | ----------------------------------------- | ---------- |
| F6.1    | [定时工作流引擎](phase-6/F6.1-workflow-engine.md) | node-cron + Webhook + 自然语言配置        | F2.1       |
| F6.2    | [消息平台网关](phase-6/F6.2-message-gateway.md)   | 钉钉/QQ/飞书/企微 + 渠道路由 + 跨渠道记忆 | F6.1, F4.1 |

---

## Phase 7: 精细化 (Polish)

> Skills 系统、体验打磨、打包分发

| Feature | 文档                                                 | 描述                                   | 依赖 |
| ------- | ---------------------------------------------------- | -------------------------------------- | ---- |
| F7.1    | [Skills 系统](phase-7/F7.1-skills-system.md)         | Markdown 指令 + Agent 加载 + 管理      | -    |
| F7.2    | [自定义工具脚本](phase-7/F7.2-custom-tools.md)       | JS/TS 脚本定义工具 + 管理 + 测试       | -    |
| F7.3    | [会话分支树可视化](phase-7/F7.3-branch-tree-viz.md)  | 图形化分支树 + 点击跳转                | -    |
| F7.4    | [暗色主题完善](phase-7/F7.4-dark-theme.md)           | 全组件暗色 + 代码高亮 + Markdown       | F0.2 |
| F7.5    | [应用打包与分发](phase-7/F7.5-packaging.md)          | Windows/macOS/Linux + 自动更新         | -    |
| F7.6    | [插件生态与分享](phase-7/F7.6-plugin-marketplace.md) | 社区市场 + .agentbuddy-pack + 安全审计 | -    |
| F7.7    | [后台守护进程](phase-7/F7.7-daemon-mode.md)          | System Tray + 关闭窗口后台运行         | -    |

---

## Feature 依赖关系图

```
Phase 0 (Foundation)
F0.1 ──┬── F0.2 ──┬── F0.3 ──── F0.4
       │          └── F0.6
       └── F0.5

Phase 1 (Foundation & Code Safety)
F1.1 ──┬── F1.2 ──── F1.5
       ├── F1.3 ──┬── F1.4 ── F2.10
       │          ├── F1.6 ──┬── F1.11 ── F1.12
       │          │          ├── F1.13
       │          │          └── F2.8
       │          ├── F1.9 ──┬── F2.5
       │          │          └── F2.9
       │          ├── F1.10 ── F3.2
       │          └── F1.14 ── F1.15
       ├── F1.7
       └── F1.8
F0.2 ── F1.16
F0.2 ── F1.17

Phase 2 (Multi-Agent & Intelligence)
F2.1 ──┬── F2.2 ──── F2.4
       └── F2.3
F2.5 ──┬── F2.6
       ├── F3.3
       ├── F3.4
       └── F3.5

Phase 3+ (MCP, Multi-Project, Memory, Knowledge, Workflow, Polish)
F1.6 ── F3.1
F2.1 ── F6.1 ── F6.2
F1.3 ── F4.1 ── F5.1
```

---

## 推荐开发顺序

| 顺序 | Feature   | 说明                      |
| ---- | --------- | ------------------------- |
| 1    | F0.1-F0.6 | Phase 0 全部（✅ 已完成） |
| 2    | F1.1      | Provider 注册表           |
| 3    | F1.3      | Pi SDK 集成               |
| 4    | F1.2      | 视觉模型路由              |
| 5    | F1.4      | Agent 工作流消息流        |
| 6    | F1.5      | Agent Composer            |
| 7    | F1.6      | 工具权限                  |
| 8    | F1.7      | Provider 面板             |
| 9    | F1.8      | 模型分配面板              |
| 10   | F1.9      | 项目感知                  |
| 11   | F1.10     | Git 集成                  |
| 12   | F1.11     | Diff 审查                 |
| 13   | F1.12     | 变更追踪                  |
| 14   | F1.13     | Inline Diff               |
| 15   | F1.14     | 上下文预算                |
| 16   | F1.15     | 成本可观测                |
| 17   | F1.16     | 键盘工作流                |
| 18   | F1.17     | 外观设置                  |
| 19   | F2.1-F2.4 | Agent、分支、结果、目标 |
| 20+  | Phase 2-7 | 按依赖关系推进            |

---

## 文档约定

- **语言**: 描述用简体中文，代码/类型/技术术语用英文
- **代码块**: 所有 TypeScript 接口直接从 PRD 提取，确保类型一致
- **文件路径**: 使用项目相对路径（如 `renderer/src/components/...`）
- **状态标记**: `Not Started` → `In Progress` → `Completed`
- **验收标准**: 使用 `- [ ]` checkbox 格式，开发完成后勾选
