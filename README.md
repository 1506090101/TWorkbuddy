# Agent Buddy

![CI](https://github.com/1506090101/TWorkbuddy/actions/workflows/ci.yml/badge.svg)

面向开发任务的 **Electron Agent Workbuddy**。围绕项目建立可恢复的 `WorkSession`，组织 Agent、模型、文件、插件与 `Goal`；Agent 的工具调用、权限、文件变更、测试和结果必须**可见、可审查、可停止、可继续**。

> 需求权威顺序：`agent-workbuddy-v2.md` → `agent-buddy-prd.md` / `agent-buddy-design.md` → `features/` → `AGENTS.md`。

## 技术栈

- **运行时**：Electron 31 + Node 20
- **渲染层**：React 18 + TypeScript 5 + Vite（electron-vite）
- **状态管理**：Zustand
- **样式**：Tailwind CSS 3 + PostCSS
- **图标**：lucide-react
- **代码质量**：ESLint 8 + Prettier 3

## 仓库结构

```
.
├── agent-buddy/            # 应用本体（Electron + React + TS）
│   ├── main/               # 主进程：持久化、Agent、工具、权限、Git
│   ├── preload/            # 仅暴露白名单 IPC
│   ├── renderer/src/       # 工作台、Composer、组件、Zustand store
│   ├── shared/             # 跨进程共享类型（不依赖 Electron/Node/浏览器 API）
│   └── resources/          # 应用资源
├── features/               # 按阶段拆分的需求/验收文档（phase-0 ~ phase-7）
├── design/                 # 设计原型
├── agent-buddy-prd.md      # 产品需求文档
├── agent-buddy-design.md  # 设计文档
├── agent-workbuddy-v2.md  # 需求总纲
├── AGENTS.md               # 仓库开发规范
└── DEVELOPMENT.md          # 开发指南
```

## 环境要求

- Node.js **20+**
- npm（随 Node 一起安装）

## 快速开始

```bash
# 进入应用目录
cd agent-buddy

# 安装依赖
npm install

# 启动开发环境（Electron + Vite HMR）
npm run dev
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Electron 开发环境 |
| `npm run build` | 构建主进程、preload 与 renderer |
| `npm run typecheck` | 类型检查（node + web 两部分） |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 格式化 |
| `npm run dist` | 构建并打包当前平台安装包（输出到 `agent-buddy/release/`） |
| `npm run dist:mac` | 仅打包 macOS（dmg，含 arm64 / x64） |
| `npm run dist:win` | 仅打包 Windows（nsis） |
| `npm run dist:linux` | 仅打包 Linux（AppImage / deb） |

## 开发规范（要点）

- TypeScript / React 使用 **2 空格、分号、双引号**；组件 `PascalCase`，hooks / store / 工具 `camelCase`。
- `shared/` 下的共享类型**不得依赖** Electron、Node 或浏览器 API。
- 密钥只在主进程处理；文件、工具、插件须经用户显式选择、主进程校验及权限链。
- `WorkSession`、`Goal`、`WorkEvent` 由主进程持久化，事件应带关联目标标识。
- 每项功能必须覆盖加载、空状态、错误、取消、失败恢复与重启恢复。

## 文档

- 需求总纲：`agent-workbuddy-v2.md`
- 产品需求：`agent-buddy-prd.md`
- 设计规范：`agent-buddy-design.md`
- 功能拆分：`features/`（按 `phase-0` ~ `phase-7`）
- 开发规范：`AGENTS.md`、开发指南：`DEVELOPMENT.md`

## License

[MIT](./LICENSE) © 2026 The Agent Buddy Authors
