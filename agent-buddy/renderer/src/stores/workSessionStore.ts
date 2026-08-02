import { create } from "zustand";
import type {
  GoalInput,
  WorkEvent,
  WorkSession,
  WorkSessionBranchInput,
  WorkSessionCreateInput,
  WorkSessionProject,
  WorkSessionSummary,
} from "@shared/types";

interface WorkSessionState {
  sessions: WorkSessionSummary[];
  activeSession: WorkSession | null;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  createSession: (input?: WorkSessionCreateInput) => Promise<WorkSession>;
  createBranch: (input: WorkSessionBranchInput) => Promise<WorkSession>;
  updateBranchSummary: (contextSummary: string) => Promise<void>;
  mergeBranch: () => Promise<void>;
  discardBranch: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  refreshActive: () => Promise<void>;
  renameSession: (title: string) => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  updateGoal: (goal?: GoalInput) => Promise<void>;
  stopGoal: () => Promise<void>;
  replanGoal: () => Promise<void>;
  updateProject: (project?: WorkSessionProject) => Promise<void>;
  updateAgent: (agentId: string) => Promise<void>;
  applyEvent: (event: WorkEvent) => void;
  clearError: () => void;
}

export const useWorkSessionStore = create<WorkSessionState>((set, get) => ({
  sessions: [],
  activeSession: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const [activeSession, sessions] = await Promise.all([
        window.electronAPI.recoverWorkSession(),
        window.electronAPI.listWorkSessions(),
      ]);
      set({ activeSession, sessions });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  createSession: async (input) => {
    const session = await window.electronAPI.createWorkSession(input);
    set((state) => ({
      activeSession: session,
      sessions: [
        toSummary(session),
        ...state.sessions.filter((item) => item.id !== session.id),
      ],
      error: null,
    }));
    return session;
  },

  createBranch: async (input) => {
    const branch = await window.electronAPI.createWorkSessionBranch(input);
    const sessions = await window.electronAPI.listWorkSessions();
    set({ activeSession: branch, sessions, error: null });
    return branch;
  },

  updateBranchSummary: async (contextSummary) => {
    const sessionId = get().activeSession?.id;
    if (!sessionId) return;
    const session = await window.electronAPI.updateWorkSessionBranchSummary(
      sessionId,
      contextSummary
    );
    set((state) => ({
      activeSession: session,
      sessions: state.sessions.map((item) =>
        item.id === session.id ? toSummary(session) : item
      ),
      error: null,
    }));
  },

  mergeBranch: async () => {
    const sessionId = get().activeSession?.id;
    if (!sessionId) return;
    const { parentSession } =
      await window.electronAPI.mergeWorkSessionBranch(sessionId);
    const sessions = await window.electronAPI.listWorkSessions();
    set({ activeSession: parentSession, sessions, error: null });
  },

  discardBranch: async () => {
    const sessionId = get().activeSession?.id;
    if (!sessionId) return;
    const { parentSession } =
      await window.electronAPI.discardWorkSessionBranch(sessionId);
    const sessions = await window.electronAPI.listWorkSessions();
    set({ activeSession: parentSession, sessions, error: null });
  },

  selectSession: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const session = await window.electronAPI.openWorkSession(sessionId);
      set((state) => ({
        activeSession: session,
        sessions: state.sessions.map((item) =>
          item.id === session.id ? toSummary(session) : item
        ),
      }));
    } catch (error) {
      set({ error: getErrorMessage(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshActive: async () => {
    const sessionId = get().activeSession?.id;
    if (!sessionId) return;
    try {
      const [activeSession, sessions] = await Promise.all([
        window.electronAPI.getWorkSession(sessionId),
        window.electronAPI.listWorkSessions(),
      ]);
      set({ activeSession, sessions, error: null });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }
  },

  renameSession: async (title) => {
    const sessionId = get().activeSession?.id;
    if (!sessionId || !title.trim()) return;
    const session = await window.electronAPI.renameWorkSession(
      sessionId,
      title
    );
    set((state) => ({
      activeSession: session,
      sessions: state.sessions.map((item) =>
        item.id === session.id ? toSummary(session) : item
      ),
    }));
  },

  archiveSession: async (sessionId) => {
    await window.electronAPI.archiveWorkSession(sessionId);
    const next = get().sessions.find((item) => item.id !== sessionId);
    set((state) => ({
      sessions: state.sessions.filter((item) => item.id !== sessionId),
      activeSession:
        state.activeSession?.id === sessionId ? null : state.activeSession,
    }));
    if (!get().activeSession && next) await get().selectSession(next.id);
  },

  updateGoal: async (goal) => {
    const sessionId = get().activeSession?.id;
    if (!sessionId) return;
    const session = await window.electronAPI.updateWorkSessionGoal(
      sessionId,
      goal
    );
    set((state) => ({
      activeSession: session,
      sessions: state.sessions.map((item) =>
        item.id === session.id ? toSummary(session) : item
      ),
    }));
  },

  stopGoal: async () => {
    const sessionId = get().activeSession?.id;
    if (!sessionId) return;
    const session = await window.electronAPI.stopWorkSessionGoal(sessionId);
    set((state) => ({
      activeSession: session,
      sessions: state.sessions.map((item) =>
        item.id === session.id ? toSummary(session) : item
      ),
      error: null,
    }));
  },

  replanGoal: async () => {
    const sessionId = get().activeSession?.id;
    if (!sessionId) return;
    const session = await window.electronAPI.replanWorkSessionGoal(sessionId);
    set((state) => ({
      activeSession: session,
      sessions: state.sessions.map((item) =>
        item.id === session.id ? toSummary(session) : item
      ),
      error: null,
    }));
  },

  updateProject: async (project) => {
    const sessionId = get().activeSession?.id;
    if (!sessionId) return;
    const session = await window.electronAPI.updateWorkSessionProject(
      sessionId,
      project
    );
    set((state) => ({
      activeSession: session,
      sessions: state.sessions.map((item) =>
        item.id === session.id ? toSummary(session) : item
      ),
    }));
    if (project?.rootPath) {
      void window.electronAPI.detectProject(project.rootPath).catch(() => {
        // Project detection is supplemental; the selected directory remains usable.
      });
    }
  },

  updateAgent: async (agentId) => {
    const sessionId = get().activeSession?.id;
    if (!sessionId || !agentId.trim()) return;
    const session = await window.electronAPI.updateWorkSessionAgent(
      sessionId,
      agentId
    );
    set((state) => ({
      activeSession: session,
      sessions: state.sessions.map((item) =>
        item.id === session.id ? toSummary(session) : item
      ),
    }));
  },

  applyEvent: (event) =>
    set((state) => {
      if (state.activeSession?.id !== event.sessionId) return state;
      const events = state.activeSession.events.some(
        (item) => item.id === event.id
      )
        ? state.activeSession.events.map((item) =>
            item.id === event.id ? event : item
          )
        : [...state.activeSession.events, event];
      const status =
        event.status === "running"
          ? "running"
          : event.status === "failed"
            ? "failed"
            : event.status === "aborted"
              ? "aborted"
              : event.type === "summary"
                ? "completed"
                : state.activeSession.status;
      const activeSession = {
        ...state.activeSession,
        events,
        status,
        updatedAt: event.timestamp,
      } as WorkSession;
      return {
        activeSession,
        sessions: state.sessions.map((item) =>
          item.id === event.sessionId ? toSummary(activeSession) : item
        ),
      };
    }),

  clearError: () => set({ error: null }),
}));

function toSummary(session: WorkSession): WorkSessionSummary {
  return {
    id: session.id,
    title: session.title,
    activeAgentId: session.activeAgentId,
    status: session.status,
    goal: session.goal
      ? {
          id: session.goal.id,
          title: session.goal.title,
          status: session.goal.status,
        }
      : undefined,
    updatedAt: session.updatedAt,
    lastOpenedAt: session.lastOpenedAt,
    eventCount: session.events.length,
    parentSessionId: session.branch?.parentSessionId,
    branchMergeStatus: session.branch?.mergeStatus,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "工作会话读取失败";
}
