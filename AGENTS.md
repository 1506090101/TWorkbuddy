# Repository Guidelines（仓库开发规范）

## 产品目标

Agent Buddy 是面向开发任务的 Electron Agent Workbuddy，不是通用 LLM 聊天工具。用户围绕项目建立可恢复的 `WorkSession`，组织 Agent、模型、文件、插件和 `Goal`；Agent 的工具调用、权限、文件变更、测试和结果必须可见、可审查、可停止、可继续。

## 文档与开发顺序

需求权威顺序为：`agent-workbuddy-v2.md` → `agent-buddy-prd.md`/`agent-buddy-design.md` → `features/` → 本规范。先完成需求评审和 Feature 验收项，再进入代码开发。实现按垂直切片推进：共享类型 → 主进程持久化与运行时 → 最小 IPC → preload → renderer store → 工作台 UI → 桌面端验收。

首轮路线为 F1.3、F1.4、F1.5、F1.6、F1.8、F2.1、F2.2/F2.3、F2.4。不得把新能力只做成聊天气泡；旧聊天方案仅作历史兼容。

## 项目结构与命令

代码位于 `agent-buddy/`：`main/` 处理持久化、Agent 和工具，`preload/` 只暴露白名单 IPC，`renderer/src/` 包含工作台、Composer、组件和 Zustand store，`shared/` 存放跨进程类型。常用命令：

- `npm run dev`：启动 Electron 开发环境。
- `npm run typecheck`：检查 TypeScript 类型。
- `npm run build`：构建主进程、preload 和 renderer。
- `npm run lint` / `npm run format`：执行 ESLint / Prettier。

## 编码与安全规范

TypeScript/React 使用 2 空格、分号和双引号；组件 PascalCase，hooks/store/工具 camelCase。共享类型不得依赖 Electron、Node 或浏览器 API。密钥只在主进程处理；文件、工具和插件必须经过用户显式选择、主进程校验及 F1.6 权限链。`WorkSession`、`Goal` 和 `WorkEvent` 由主进程持久化，事件应带关联目标标识。

## 验收与协作

每项功能必须覆盖加载、空状态、错误、取消、失败恢复和重启恢复，并验证“新建任务 → 组织上下文 → Agent 工作 → 审查/确认 → 结果”。提交信息使用简短祈使句；PR 需说明范围、关联 Feature、验证命令，界面改动附截图或录屏。
