import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  FileText,
  FlaskConical,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { AgentListItem, WorkSession } from "@shared/types";
import { useWorkSessionStore } from "@stores/workSessionStore";
import { cn } from "@utils/cn";

interface AgentSelectorProps {
  session: WorkSession;
  compact?: boolean;
  disabled?: boolean;
}

export function AgentSelector({
  session,
  compact = false,
  disabled = false,
}: AgentSelectorProps) {
  const updateAgent = useWorkSessionStore((state) => state.updateAgent);
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let disposed = false;
    void window.electronAPI.listAgents().then((items) => {
      if (!disposed) setAgents(items);
    });
    return () => {
      disposed = true;
    };
  }, []);

  const selected =
    agents.find((agent) => agent.id === session.activeAgentId) ??
    fallbackAgent(session.activeAgentId);

  const selectAgent = async (agent: AgentListItem) => {
    if (agent.id === session.activeAgentId) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      await updateAgent(agent.id);
      setIsOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="切换当前 Agent"
        aria-expanded={isOpen}
        disabled={disabled || isUpdating}
        onClick={() => setIsOpen((value) => !value)}
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          compact
            ? "max-w-40 text-[11px] text-content-subtle hover:text-content"
            : "h-7 max-w-44 border border-border bg-surface px-2 text-[11px] text-content-muted hover:border-primary-300 hover:text-content"
        )}
      >
        <AgentIcon agent={selected} size={compact ? 11 : 12} />
        <span className="truncate">{selected.name}</span>
        <ChevronDown size={12} className={cn(isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 w-80 border border-border bg-surface p-1.5 shadow-lg">
          <p className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-content-subtle">
            当前任务的 Agent
          </p>
          {agents.map((agent) => {
            const isSelected = agent.id === session.activeAgentId;
            return (
              <button
                key={agent.id}
                type="button"
                className={cn(
                  "flex w-full items-start gap-2.5 px-2.5 py-2 text-left hover:bg-surface-hover",
                  isSelected && "bg-primary-50 dark:bg-primary-900/20"
                )}
                onClick={() => void selectAgent(agent)}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-border bg-surface-muted">
                  <AgentIcon agent={agent} size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-content">
                      {agent.name}
                    </span>
                    {agent.isDefault && (
                      <span className="text-[10px] text-content-subtle">
                        默认
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-content-muted">
                    {agent.description}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-content-subtle">
                    <Wrench size={10} />
                    {agent.tools.join(" · ")}
                    {agent.skills.length > 0 &&
                      ` · ${agent.skills.length} 个技能`}
                  </span>
                </span>
                {isSelected && (
                  <Check size={14} className="mt-1 text-primary-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentIcon({
  agent,
  size,
}: {
  agent: Pick<AgentListItem, "icon" | "color">;
  size: number;
}) {
  const props = { size, style: { color: agent.color } };
  switch (agent.icon) {
    case "shield-check":
      return <ShieldCheck {...props} />;
    case "flask-conical":
      return <FlaskConical {...props} />;
    case "file-text":
      return <FileText {...props} />;
    default:
      return <Bot {...props} />;
  }
}

function fallbackAgent(id: string): AgentListItem {
  return {
    id,
    name: id,
    description: "正在加载 Agent 定义",
    tools: [],
    skills: [],
    icon: "bot",
    color: "#64748b",
    isDefault: id === "default",
  };
}
