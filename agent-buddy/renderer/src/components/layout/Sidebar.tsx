/**
 * F0.3: Sidebar — Session list + navigation
 *
 * - Collapsible (260px ↔ 48px)
 * - Session list (future: from sessionStore)
 * - New session button
 * - Project info
 */
import {
  Bot,
  FolderOpen,
  GitBranch,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plug,
  Plus,
  Target,
} from "lucide-react";
import type { WorkSessionSummary } from "@shared/types";
import { useUIStore } from "@stores/uiStore";
import { useWorkSessionStore } from "@stores/workSessionStore";
import { useTranslation } from "@i18n";
import { cn } from "@utils/cn";

export function Sidebar() {
  const { t } = useTranslation();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const sessions = useWorkSessionStore((s) => s.sessions);
  const activeSession = useWorkSessionStore((s) => s.activeSession);
  const createSession = useWorkSessionStore((s) => s.createSession);
  const selectSession = useWorkSessionStore((s) => s.selectSession);
  const updateProject = useWorkSessionStore((s) => s.updateProject);

  const chooseProject = async () => {
    const project = await window.electronAPI.chooseWorkSessionProject();
    if (project) await updateProject(project);
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-surface-muted border-r border-border transition-all duration-300 ease-out-expo overflow-hidden",
        collapsed ? "w-12" : "w-64"
      )}
      style={{
        width: collapsed
          ? "var(--layout-sidebar-collapsed-width)"
          : "var(--layout-sidebar-width)",
      }}
    >
      {/* Header: New session */}
      <div className="p-2 flex items-center gap-1">
        <button
          onClick={() => void createSession()}
          className={cn(
            "flex items-center gap-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors duration-150",
            collapsed ? "w-8 h-8 justify-center mx-auto" : "w-full px-3 py-2"
          )}
          title={t("sidebar.newSession")}
        >
          <Plus size={16} />
          {!collapsed && (
            <span className="text-sm font-medium">
              {t("sidebar.newSession")}
            </span>
          )}
        </button>

        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-content hover:bg-surface-hover rounded-md transition-colors duration-150 shrink-0"
            title={t("sidebar.collapse")}
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1 mt-2">
          {flattenSessionTree(sessions).map(({ session, depth }) => (
            <SessionItem
              key={session.id}
              collapsed={collapsed}
              title={session.title}
              active={activeSession?.id === session.id}
              status={session.status}
              goalTitle={session.goal?.title}
              depth={depth}
              isBranch={Boolean(session.parentSessionId)}
              branchMergeStatus={session.branchMergeStatus}
              onClick={() => void selectSession(session.id)}
            />
          ))}
          {sessions.length === 0 && !collapsed && (
            <div className="px-3 py-8 text-center text-xs text-content-subtle">
              还没有工作任务
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-border px-2 py-2">
          <WorkspaceEntry
            icon={<FolderOpen size={14} />}
            label="项目"
            onClick={() => void chooseProject()}
          />
          <WorkspaceEntry icon={<Bot size={14} />} label="Agent" />
          <WorkspaceEntry icon={<Plug size={14} />} label="插件" />
          <WorkspaceEntry icon={<Target size={14} />} label="目标" />
        </div>
      )}

      {/* Footer: Collapse toggle (when collapsed) */}
      {collapsed && (
        <div className="p-2 border-t border-border">
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-content hover:bg-surface-hover rounded-md transition-colors duration-150 mx-auto"
            title={t("sidebar.expand")}
          >
            <PanelLeft size={16} />
          </button>
        </div>
      )}
    </aside>
  );
}

function SessionItem({
  collapsed,
  title,
  active = false,
  status,
  goalTitle,
  depth = 0,
  isBranch = false,
  branchMergeStatus,
  onClick,
}: {
  collapsed: boolean;
  title: string;
  active?: boolean;
  status?: string;
  goalTitle?: string;
  depth?: number;
  isBranch?: boolean;
  branchMergeStatus?: WorkSessionSummary["branchMergeStatus"];
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-2 rounded-lg transition-colors duration-150 text-left",
        collapsed ? "w-8 h-8 justify-center mx-auto" : "px-3 py-2",
        active
          ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
          : "text-content-muted hover:bg-surface-hover hover:text-content"
      )}
      style={
        collapsed || depth === 0
          ? undefined
          : { paddingLeft: `${12 + depth * 16}px` }
      }
      title={title}
      onClick={onClick}
    >
      {isBranch ? (
        <GitBranch size={14} className="shrink-0" />
      ) : (
        <MessageSquare size={14} className="shrink-0" />
      )}
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{title}</span>
          {goalTitle && (
            <span className="block truncate text-[10px] text-content-subtle">
              {goalTitle}
            </span>
          )}
        </span>
      )}
      {!collapsed && status === "running" && (
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary-500" />
      )}
      {!collapsed && branchMergeStatus === "merged" && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
      )}
    </button>
  );
}

function flattenSessionTree(
  sessions: WorkSessionSummary[]
): Array<{ session: WorkSessionSummary; depth: number }> {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const childrenByParent = new Map<string, WorkSessionSummary[]>();
  const roots: WorkSessionSummary[] = [];

  for (const session of sessions) {
    if (session.parentSessionId && byId.has(session.parentSessionId)) {
      const children = childrenByParent.get(session.parentSessionId) ?? [];
      children.push(session);
      childrenByParent.set(session.parentSessionId, children);
    } else {
      roots.push(session);
    }
  }

  const compare = (left: WorkSessionSummary, right: WorkSessionSummary) =>
    right.updatedAt - left.updatedAt;
  roots.sort(compare);
  for (const children of childrenByParent.values()) children.sort(compare);

  const rows: Array<{ session: WorkSessionSummary; depth: number }> = [];
  const visited = new Set<string>();
  const visit = (session: WorkSessionSummary, depth: number) => {
    if (visited.has(session.id)) return;
    visited.add(session.id);
    rows.push({ session, depth });
    for (const child of childrenByParent.get(session.id) ?? []) {
      visit(child, depth + 1);
    }
  };

  for (const session of roots) visit(session, 0);
  for (const session of sessions) visit(session, 0);
  return rows;
}

function WorkspaceEntry({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-content-muted hover:bg-surface-hover hover:text-content"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
