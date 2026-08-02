# Agent Buddy — Phase 0 完成概览

> 基础设施层 (Foundation) 已完成，项目可以启动运行
>
> **V2 说明**：本文是 Phase 0 完成快照，不定义后续产品体验。自 2026-08-02 起，主体验、Feature 优先级和开发闭环以 [Agent Workbuddy 需求调整](agent-workbuddy-v2.md) 与 `features/` 中各 Feature 的 V2 章节为准。

---

## 完成内容

### F0.1 项目初始化与工程骨架 ✅
- Electron + electron-vite + React 18 + TypeScript 项目搭建
- 三层架构：main (主进程) / preload (安全桥接) / renderer (React 前端)
- TypeScript strict mode，路径别名 (@components, @stores, @hooks, @utils, @shared)
- ESLint + Prettier 配置
- `npm run dev` / `npm run build` / `npm run typecheck` 全部可用

### F0.2 统一设计系统 ✅
- **色彩系统**：7 色系 × 11 级 (primary/accent/neutral/success/warning/danger/info)
- **语义层**：surface (背景) / content (文字) / border (边框) 各 4-5 个语义别名
- **明暗主题**：完整 CSS 变量定义，`.dark` class 切换，支持 system 跟随模式
- **字体系统**：UI 字体栈 + 代码字体栈 (JetBrains Mono)
- **字号**：xs(11) / sm(13) / base(14) / lg(16) / xl(20) / 2xl(24) / 3xl(30)
- **间距**：4px 基准，0.5→24 共 12 级
- **圆角**：sm(6) / md(8) / lg(12) / xl(16) / 2xl(20)
- **阴影**：sm / md / lg / xl / inner / glow
- **动画**：fade-in / fade-in-up / slide-in-right / scale-in / pulse-subtle + 三种缓动曲线
- **主题切换**：useTheme hook 自动跟随系统 + 手动切换，瞬间生效无闪烁

### F0.3 统一布局系统 ✅
- **TitleBar** (40px)：拖拽区域 + 窗口控制 + 快速导航
- **Sidebar** (260px ↔ 48px)：可折叠，会话列表 + 新建按钮
- **MainContent** (flex-1)：自适应主内容区
- **RightPanel** (360px)：可折叠右侧面板
- **AppLayout**：三栏布局编排，面板切换有过渡动画
- 最小窗口 800×600，默认 1280×800

### F0.4 通用 UI 基础组件库 ✅
- Button (5 variants × 3 sizes + loading state)
- Input (label/error/hint)
- Textarea (auto-resize)
- Badge (6 variants + dot)
- Card (Header/Body/Footer)
- Dialog/Modal (overlay + escape + focus)
- Tabs (underline/pill)
- Switch (toggle)
- Spinner
- Tooltip (hover delay + 4 placements)
- IconButton (icon-only + tooltip)
- EmptyState
- 所有组件支持明暗主题

### F0.5 IPC 通信层与类型系统 ✅
- shared/types.ts 统一类型定义（Provider/Chat/Agent/Project 等）
- preload contextBridge 安全暴露 API
- IPC 通道分组：agent:* / provider:* / settings:* / project:* / window:*
- 主进程 IPC stubs 注册（后续 Feature 逐步替换为真实实现）
- contextIsolation: true, nodeIntegration: false

### F0.6 状态管理基础设施 ✅
- uiStore：主题模式 / 面板折叠 / 活跃视图 / 设置弹窗 / Command Palette
- Zustand + persist middleware（布局状态持久化到 localStorage）
- 路径别名配置完成

### 额外完成
- SettingsDialog 骨架（4 个 Tab：Providers / Models / Appearance / Shortcuts）
- AppearanceTab 功能完整（主题切换 + 字体大小 + 色板预览）
- ShortcutsTab 展示所有快捷键
- WelcomeScreen 欢迎页
- 全局快捷键 Ctrl+Shift+P (Command Palette) + Ctrl+, (Settings)

---

## 项目结构

```
agent-buddy/
├── package.json               # 依赖与脚本
├── electron.vite.config.ts    # electron-vite 构建配置
├── tsconfig.json              # TypeScript 根配置
├── tsconfig.node.json         # 主进程 TS 配置 (含路径别名)
├── tsconfig.web.json          # 渲染进程 TS 配置 (含路径别名)
├── tailwind.config.js         # Tailwind 配置 (CSS 变量映射)
├── postcss.config.js
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
│
├── main/                      # Electron 主进程
│   ├── index.ts               # 应用入口：窗口创建、生命周期
│   └── ipc.ts                 # IPC 处理器（窗口控制 + stubs）
│
├── preload/                   # Preload 脚本
│   └── index.ts               # contextBridge 安全桥接
│
├── shared/                    # 主进程与渲染进程共享
│   └── types.ts               # 统一类型定义
│
├── renderer/                  # React 前端
│   ├── index.html
│   └── src/
│       ├── main.tsx           # React 入口
│       ├── App.tsx            # 根组件
│       ├── styles/
│       │   └── globals.css    # 设计系统 CSS (tokens + reset + utilities)
│       ├── components/
│       │   ├── layout/        # TitleBar, Sidebar, AppLayout
│       │   ├── chat/          # WelcomeScreen (ChatView 将在 F1.4 实现)
│       │   ├── common/        # 12 个通用 UI 组件
│       │   └── settings/      # SettingsDialog (4 Tabs)
│       ├── hooks/
│       │   └── useTheme.ts    # 主题管理 hook
│       ├── stores/
│       │   └── uiStore.ts     # UI 状态 (布局/主题/面板/设置)
│       └── utils/
│           └── cn.ts          # className 合并工具
│
└── resources/                 # 静态资源（图标等）
```

---

## V2 开发基线与下一步

Phase 0 只提供工程、布局、组件、IPC 和状态管理基础，不代表旧版聊天产品已经确定。后续开发目标是 Agent Workbuddy 工作台：左侧工作导航、顶部上下文、中央工作流时间线、底部 Agent Composer 和右侧审查面板。

首轮开发顺序：

1. F1.3：持久化 `WorkSession` 与统一 `WorkEvent`。
2. F1.4：展示任务、思考、工具、权限、变更、测试和总结。
3. F1.5：完成文件/模型/插件/目标/Thinking 的 Composer 上下文。
4. F1.6/F1.8：接入权限确认、失败恢复和会话模型即时覆盖。
5. F2.1/F2.2/F2.3/F2.4：接入 Agent 切换、分支、结果展示和会话目标。

每项功能完成后，必须用桌面端验证“新建任务 → 执行 → 审查/干预 → 恢复”的闭环，并同步对应 Feature 的 V2 验收项。原聊天 UI 方案继续保留在历史文档中，不作为新开发入口。

### 文档导航

- 产品方向：`agent-workbuddy-v2.md`
- 产品需求：`agent-buddy-prd.md`
- 技术与 UI 设计：`agent-buddy-design.md`
- Feature 路线：`features/README.md`
- 开发规范：`AGENTS.md`、`DEVELOPMENT.md`

## 历史 Phase 1 计划

按 Feature Spec 推荐顺序，接下来实现：

| 顺序 | Feature | 说明 |
|------|---------|------|
| 7 | F1.1 | Provider 注册表与配置 |
| 8 | F1.3 | Pi SDK 集成 |
| 9 | F1.2 | 视觉模型路由 |
| 10 | F1.4 | Agent 工作流消息流（旧名：聊天 UI） |
| 11 | F1.5 | Agent Composer（旧名：输入栏） |
| 12 | F1.6 | 工具权限 |
| 13-14 | F1.7-F1.8 | 设置面板 |
| 15-16 | F1.9-F1.10 | 项目感知 + Git |
| 17-19 | F1.11-F1.13 | Diff 审查 |
| 20-21 | F1.14-F1.15 | 上下文 + 成本 |
| 22-23 | F1.16-F1.17 | 键盘 + 外观 |
