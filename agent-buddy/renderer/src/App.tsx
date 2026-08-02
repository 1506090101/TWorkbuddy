/**
 * App root component
 *
 * F0.2: Initializes theme management
 * F0.3: Renders AppLayout with Sidebar + main content
 *
 * Implemented:
 * - F1.3: Agent session initialization and streaming chat
 *
 * Future features will add:
 * - F1.4: Full Markdown and tool result rendering
 * - F1.5: InputBar
 * - F1.6: Tool permission dialogs
 * - F1.16: Command palette + global shortcuts
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  FilePlus2,
  FolderOpen,
  Goal,
  Keyboard,
  PanelRight,
  Plus,
  Settings,
  TextCursorInput,
} from "lucide-react";
import { useTheme } from "./hooks/useTheme";
import { useUIStore } from "./stores/uiStore";
import { AppLayout } from "./components/layout/AppLayout";
import { WorkbenchView } from "./components/workbench/WorkbenchView";
import { SessionInspector } from "./components/workbench/SessionInspector";
import { PermissionOverlay } from "./components/workbench/PermissionOverlay";
import { useWorkSessionStore } from "./stores/workSessionStore";
import { SettingsDialog } from "./components/settings/SettingsDialog";
import {
  CommandPalette,
  type CommandItem,
} from "./components/commands/CommandPalette";
import { getKeybinding, matchesKeybinding } from "./commands/keybindings";

export default function App() {
  // F0.2: Initialize theme management
  useTheme();

  // i18n: sync <html lang> attribute with current locale
  const locale = useUIStore((s) => s.locale);

  const activeView = useUIStore((s) => s.activeView);
  const activeSession = useWorkSessionStore((s) => s.activeSession);
  const sessions = useWorkSessionStore((s) => s.sessions);
  const createSession = useWorkSessionStore((s) => s.createSession);
  const selectSession = useWorkSessionStore((s) => s.selectSession);
  const archiveSession = useWorkSessionStore((s) => s.archiveSession);
  const updateProject = useWorkSessionStore((s) => s.updateProject);
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const keybindingOverrides = useUIStore((s) => s.keybindingOverrides);
  const [changeReviewFocusId, setChangeReviewFocusId] = useState<string>();

  const requestComposerAction = useCallback(
    (action: "focus" | "files" | "goal") => {
      useUIStore.getState().setActiveView("chat");
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent("agent-buddy:composer-action", { detail: action })
        );
      });
    },
    []
  );

  const switchSession = useCallback(
    async (direction: 1 | -1) => {
      if (sessions.length < 2) return;
      const currentIndex = sessions.findIndex(
        (session) => session.id === activeSession?.id
      );
      const baseIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex =
        (baseIndex + direction + sessions.length) % sessions.length;
      await selectSession(sessions[nextIndex].id);
    },
    [activeSession?.id, selectSession, sessions]
  );

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: "session.new",
        label: "新建任务",
        description: "创建一个新的 Agent 工作会话",
        category: "任务",
        keywords: ["new", "session", "task", "新建"],
        shortcut: getKeybinding("session.new", keybindingOverrides),
        icon: Plus,
        action: () => createSession(),
      },
      {
        id: "session.previous",
        label: "切换到上一任务",
        description: "在任务列表中打开前一个会话",
        category: "任务",
        keywords: ["previous", "session", "任务", "上一个"],
        shortcut: getKeybinding("session.previous", keybindingOverrides),
        icon: Keyboard,
        enabled: sessions.length > 1,
        action: () => switchSession(-1),
      },
      {
        id: "session.next",
        label: "切换到下一任务",
        description: "在任务列表中打开后一个会话",
        category: "任务",
        keywords: ["next", "session", "任务", "下一个"],
        shortcut: getKeybinding("session.next", keybindingOverrides),
        icon: Keyboard,
        enabled: sessions.length > 1,
        action: () => switchSession(1),
      },
      {
        id: "session.archive",
        label: "归档当前任务",
        description: "从当前工作台隐藏已完成或不再需要的任务",
        category: "任务",
        keywords: ["archive", "close", "任务", "归档"],
        icon: Archive,
        enabled: Boolean(activeSession),
        action: async () => {
          if (!activeSession) return;
          await archiveSession(activeSession.id);
        },
      },
      {
        id: "composer.focus",
        label: "聚焦任务输入",
        description: "把光标移到当前任务的 Composer",
        category: "工作台",
        keywords: ["composer", "prompt", "input", "输入", "聚焦"],
        shortcut: getKeybinding("composer.focus", keybindingOverrides),
        icon: TextCursorInput,
        enabled: Boolean(activeSession),
        action: () => requestComposerAction("focus"),
      },
      {
        id: "composer.files",
        label: "添加任务附件",
        description: "选择图片、文本或代码文件作为当前任务上下文",
        category: "工作台",
        keywords: ["file", "attachment", "附件", "文件"],
        icon: FilePlus2,
        enabled: Boolean(activeSession),
        action: () => requestComposerAction("files"),
      },
      {
        id: "composer.goal",
        label: "设置会话目标",
        description: "编辑当前任务的完成目标和说明",
        category: "工作台",
        keywords: ["goal", "target", "目标", "会话"],
        icon: Goal,
        enabled: Boolean(activeSession),
        action: () => requestComposerAction("goal"),
      },
      {
        id: "project.choose",
        label: "选择任务项目",
        description: "为当前任务选择本地项目目录",
        category: "工作台",
        keywords: ["project", "folder", "项目", "目录"],
        icon: FolderOpen,
        enabled: Boolean(activeSession),
        action: async () => {
          const project = await window.electronAPI.chooseWorkSessionProject();
          if (project) await updateProject(project);
        },
      },
      {
        id: "layout.toggle-inspector",
        label: "切换任务上下文面板",
        description: "显示或隐藏目标、变更和工具执行信息",
        category: "视图",
        keywords: ["inspector", "panel", "context", "面板", "上下文"],
        icon: PanelRight,
        action: () => useUIStore.getState().toggleRightPanel(),
      },
      {
        id: "settings.open",
        label: "打开设置",
        description: "管理 Provider、外观和其他工作台配置",
        category: "设置",
        keywords: ["settings", "provider", "设置"],
        shortcut: getKeybinding("settings.open", keybindingOverrides),
        icon: Settings,
        action: () => useUIStore.getState().openSettings(),
      },
    ],
    [
      activeSession,
      archiveSession,
      createSession,
      keybindingOverrides,
      requestComposerAction,
      sessions.length,
      switchSession,
      updateProject,
    ]
  );

  // Update <html lang> when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // F1.16: global commands must leave Composer and review-specific editing shortcuts alone.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (commandPaletteOpen && e.key === "Escape") {
        e.preventDefault();
        useUIStore.getState().setCommandPaletteOpen(false);
        return;
      }
      if (
        matchesKeybinding(e, getKeybinding("palette.open", keybindingOverrides))
      ) {
        e.preventDefault();
        useUIStore.getState().setCommandPaletteOpen(true);
        return;
      }
      if (
        matchesKeybinding(e, getKeybinding("session.new", keybindingOverrides))
      ) {
        e.preventDefault();
        void createSession();
        return;
      }
      if (
        matchesKeybinding(
          e,
          getKeybinding("composer.focus", keybindingOverrides)
        )
      ) {
        e.preventDefault();
        requestComposerAction("focus");
        return;
      }
      if (
        matchesKeybinding(e, getKeybinding("session.next", keybindingOverrides))
      ) {
        e.preventDefault();
        void switchSession(1);
        return;
      }
      if (
        matchesKeybinding(
          e,
          getKeybinding("session.previous", keybindingOverrides)
        )
      ) {
        e.preventDefault();
        void switchSession(-1);
        return;
      }
      if (
        matchesKeybinding(
          e,
          getKeybinding("settings.open", keybindingOverrides)
        )
      ) {
        e.preventDefault();
        useUIStore.getState().openSettings();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    commandPaletteOpen,
    createSession,
    keybindingOverrides,
    requestComposerAction,
    switchSession,
  ]);

  return (
    <>
      <AppLayout
        rightPanel={
          activeView === "chat" ? (
            <SessionInspector
              session={activeSession}
              focusChangesetId={changeReviewFocusId}
            />
          ) : undefined
        }
      >
        {activeView === "chat" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <WorkbenchView onViewChangeInPanel={setChangeReviewFocusId} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-content-muted">
            <p className="text-sm">{activeView} view — coming soon</p>
          </div>
        )}
      </AppLayout>

      {/* Settings dialog */}
      <SettingsDialog />
      <PermissionOverlay />
      <CommandPalette
        isOpen={commandPaletteOpen}
        commands={commands}
        onClose={() => useUIStore.getState().setCommandPaletteOpen(false)}
      />
    </>
  );
}
