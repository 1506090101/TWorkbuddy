import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, Zap } from "lucide-react";
import type {
  ContextBudgetSource,
  ContextUsage,
  WorkSession,
} from "@shared/types";
import { IconButton } from "@components/common";
import { cn } from "@utils/cn";

const BREAKDOWN: Array<{
  source: ContextBudgetSource;
  label: string;
  color: string;
}> = [
  { source: "systemPrompt", label: "系统", color: "bg-primary-500" },
  { source: "projectOverview", label: "项目", color: "bg-success-500" },
  { source: "gitStatus", label: "Git", color: "bg-warning-500" },
  { source: "toolDefinitions", label: "工具", color: "bg-accent-500" },
  {
    source: "conversationHistory",
    label: "历史",
    color: "bg-content-subtle",
  },
];

export function ContextBudgetSection({ session }: { session: WorkSession }) {
  const [usage, setUsage] = useState<ContextUsage>();
  const [isLoading, setIsLoading] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setUsage(await window.electronAPI.getContextUsage(session.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取上下文预算失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [session.id, session.events.length]);

  const compact = async () => {
    setIsCompacting(true);
    setError(null);
    try {
      setUsage(await window.electronAPI.compactContext(session.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "压缩上下文失败");
    } finally {
      setIsCompacting(false);
    }
  };

  return (
    <section className="border-b border-border pb-4 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-primary-500" />
          <h2 className="text-xs font-semibold text-content">上下文预算</h2>
        </div>
        <div className="flex items-center gap-0.5">
          {usage && (
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              icon={<Zap size={13} />}
              tooltip="压缩任务历史"
              aria-label="压缩任务历史"
              disabled={isCompacting || usage.historyMessages <= 1}
              onClick={() => void compact()}
            />
          )}
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={
              <RefreshCw
                size={13}
                className={isLoading ? "animate-spin" : ""}
              />
            }
            tooltip="刷新上下文预算"
            aria-label="刷新上下文预算"
            disabled={isLoading || isCompacting}
            onClick={() => void load()}
          />
        </div>
      </div>

      {!usage && !isLoading && !error && (
        <p className="mt-2 text-xs leading-5 text-content-muted">
          发送任务后显示本次 Agent 调用的上下文分配。
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}

      {usage && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 text-[11px] text-content-muted">
            <span>
              {formatTokens(usage.totalUsed)} / {formatTokens(usage.totalLimit)}
            </span>
            <span
              className={cn(
                "font-medium",
                usage.available > 10_000
                  ? "text-success-700"
                  : usage.available > 2_000
                    ? "text-warning-700"
                    : "text-danger-600"
              )}
            >
              剩余 {formatTokens(usage.available)}
            </span>
          </div>
          <div className="mt-2 flex h-1.5 overflow-hidden bg-surface-muted">
            {BREAKDOWN.map((item) => {
              const tokens = usage.breakdown[item.source];
              if (tokens === 0) return null;
              return (
                <span
                  key={item.source}
                  className={item.color}
                  style={{
                    width: `${Math.min(100, (tokens / usage.totalLimit) * 100)}%`,
                  }}
                  title={`${item.label}: ${formatTokens(tokens)}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-content-subtle">
            {BREAKDOWN.filter((item) => usage.breakdown[item.source] > 0).map(
              (item) => (
                <span
                  key={item.source}
                  className="inline-flex items-center gap-1"
                >
                  <i className={cn("h-1.5 w-1.5", item.color)} />
                  {item.label} {formatTokens(usage.breakdown[item.source])}
                </span>
              )
            )}
          </div>
          <p
            className={cn(
              "mt-2 text-[10px]",
              usage.needsCompact ? "text-warning-700" : "text-content-subtle"
            )}
          >
            {usage.needsCompact
              ? "历史接近预算，建议压缩"
              : `${usage.historyMessages} 条历史消息受预算管理`}
          </p>
        </div>
      )}
    </section>
  );
}

function formatTokens(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : String(value);
}
