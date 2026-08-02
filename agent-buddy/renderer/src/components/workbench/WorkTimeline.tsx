import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleDot,
  FileCode2,
  ListFilter,
  Flag,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
  UserRound,
} from "lucide-react";
import type { WorkEvent } from "@shared/types";
import { MarkdownRenderer } from "@components/chat/MarkdownRenderer";
import { cn } from "@utils/cn";
import { useState } from "react";
import { InlineChangeCard } from "./InlineChangeCard";
import { InlineSessionChangesSummary } from "./InlineSessionChangesSummary";

interface WorkTimelineProps {
  sessionId: string;
  events: WorkEvent[];
  goalId?: string;
  onViewChangeInPanel: (changesetId: string) => void;
}

export function WorkTimeline({
  sessionId,
  events,
  goalId,
  onViewChangeInPanel,
}: WorkTimelineProps) {
  const [goalOnly, setGoalOnly] = useState(false);
  const visibleEvents =
    goalOnly && goalId
      ? events.filter((event) => event.metadata?.goalId === goalId)
      : events;
  if (events.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-muted text-content-subtle">
            <CircleDot size={19} />
          </div>
          <h2 className="text-sm font-semibold text-content">
            任务工作流已准备
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-content-muted">
            在下方 Composer 中描述任务。Agent
            的进度、工具调用、变更和验证会按时间线出现在这里。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
      <div className="mx-auto w-full max-w-3xl space-y-1">
        {goalId && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              className={cn(
                "inline-flex h-7 items-center gap-1.5 border px-2 text-[11px] transition-colors",
                goalOnly
                  ? "border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                  : "border-border text-content-muted hover:bg-surface-hover hover:text-content"
              )}
              onClick={() => setGoalOnly((value) => !value)}
            >
              <ListFilter size={13} />
              {goalOnly ? "目标事件" : "全部事件"}
            </button>
          </div>
        )}
        {visibleEvents.length === 0 && goalOnly && (
          <div className="py-12 text-center text-xs text-content-muted">
            当前目标尚无关联工作事件
          </div>
        )}
        {visibleEvents.map((event, index) => (
          <WorkEventRow
            key={event.id}
            event={event}
            isLast={index === visibleEvents.length - 1}
            sessionId={sessionId}
            refreshToken={events.length}
            onViewChangeInPanel={onViewChangeInPanel}
          />
        ))}
      </div>
    </div>
  );
}

function WorkEventRow({
  event,
  isLast,
  sessionId,
  refreshToken,
  onViewChangeInPanel,
}: {
  event: WorkEvent;
  isLast: boolean;
  sessionId: string;
  refreshToken: number;
  onViewChangeInPanel: (changesetId: string) => void;
}) {
  const [expanded, setExpanded] = useState(event.type === "agent_message");
  const config = getEventConfig(event.type);
  const isRunning = event.status === "running";
  const isExpandable = Boolean(
    event.metadata && Object.keys(event.metadata).length > 0
  );
  const changesetId = getInlineChangesetId(event);

  return (
    <div className="group relative flex gap-3">
      <div className="flex w-6 shrink-0 flex-col items-center">
        <span
          className={cn(
            "mt-2 flex h-6 w-6 items-center justify-center rounded-full border",
            config.iconClass
          )}
        >
          {isRunning ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            config.icon
          )}
        </span>
        {!isLast && <span className="w-px flex-1 bg-border" />}
      </div>
      <div
        className={cn(
          "mb-3 min-w-0 flex-1 border-b border-border-muted pb-3 pt-1",
          event.type === "user_task" && "border-l-2 border-l-primary-400 pl-3",
          event.type === "error" && "border-l-2 border-l-danger-400 pl-3",
          event.type === "tool_call" && "border-l-2 border-l-warning-400 pl-3"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("text-xs font-medium", config.titleClass)}>
              {event.title}
            </span>
            {event.status !== "info" && (
              <span className={cn("text-[10px]", getStatusClass(event.status))}>
                {getEventStatusLabel(event.status)}
              </span>
            )}
          </div>
          <time className="shrink-0 text-[10px] text-content-subtle">
            {formatTime(event.timestamp)}
          </time>
        </div>

        {event.content && (
          <div
            className={cn(
              "mt-1.5",
              event.type === "agent_message"
                ? "text-content"
                : "text-content-muted"
            )}
          >
            {event.type === "agent_message" ? (
              <MarkdownRenderer
                content={event.content}
                isStreaming={isRunning}
              />
            ) : (
              <p className="selectable whitespace-pre-wrap break-words text-xs leading-5">
                {event.content}
              </p>
            )}
          </div>
        )}

        {event.attachmentIds && event.attachmentIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.attachmentIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 border border-border bg-surface-muted px-2 py-1 text-[10px] text-content-muted"
              >
                <FileCode2 size={11} />
                {id.slice(0, 12)}
              </span>
            ))}
          </div>
        )}

        {changesetId && (
          <InlineChangeCard
            sessionId={sessionId}
            changesetId={changesetId}
            refreshToken={refreshToken}
            onViewInPanel={onViewChangeInPanel}
          />
        )}

        {event.type === "summary" && (
          <InlineSessionChangesSummary
            sessionId={sessionId}
            refreshToken={refreshToken}
            onViewInPanel={onViewChangeInPanel}
          />
        )}

        {isExpandable && (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-content-subtle hover:text-content"
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown
              size={12}
              className={cn("transition-transform", expanded && "rotate-180")}
            />
            查看执行信息
          </button>
        )}
        {expanded && isExpandable && (
          <pre className="selectable mt-2 max-h-36 overflow-auto border border-border bg-surface-muted p-2 font-code text-[10px] leading-4 text-content-muted">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function getInlineChangesetId(event: WorkEvent): string | undefined {
  if (event.type !== "file_change") return undefined;
  const changesetId = event.metadata?.changesetId;
  const operation = event.metadata?.operation;
  if (
    typeof changesetId !== "string" ||
    (operation !== "write" && operation !== "edit")
  ) {
    return undefined;
  }
  return changesetId;
}

function getEventConfig(type: WorkEvent["type"]) {
  switch (type) {
    case "user_task":
      return {
        icon: <UserRound size={13} />,
        iconClass: "border-primary-200 bg-primary-50 text-primary-600",
        titleClass: "text-content",
      };
    case "agent_message":
      return {
        icon: <Sparkles size={13} />,
        iconClass: "border-accent-200 bg-accent-50 text-accent-600",
        titleClass: "text-content",
      };
    case "agent_progress":
      return {
        icon: <Loader2 size={13} />,
        iconClass: "border-border bg-surface-muted text-content-subtle",
        titleClass: "text-content-muted",
      };
    case "tool_call":
      return {
        icon: <TerminalSquare size={13} />,
        iconClass: "border-warning-200 bg-warning-50 text-warning-700",
        titleClass: "text-warning-700",
      };
    case "permission_request":
      return {
        icon: <ShieldAlert size={13} />,
        iconClass: "border-warning-200 bg-warning-50 text-warning-700",
        titleClass: "text-warning-700",
      };
    case "permission_decision":
      return {
        icon: <Check size={13} />,
        iconClass: "border-border bg-surface-muted text-content-muted",
        titleClass: "text-content-muted",
      };
    case "file_change":
      return {
        icon: <FileCode2 size={13} />,
        iconClass: "border-info-200 bg-info-50 text-info-700",
        titleClass: "text-info-700",
      };
    case "test_result":
      return {
        icon: <Check size={13} />,
        iconClass: "border-success-200 bg-success-50 text-success-700",
        titleClass: "text-success-700",
      };
    case "error":
      return {
        icon: <AlertCircle size={13} />,
        iconClass: "border-danger-200 bg-danger-50 text-danger-700",
        titleClass: "text-danger-700",
      };
    case "summary":
      return {
        icon: <Flag size={13} />,
        iconClass: "border-success-200 bg-success-50 text-success-700",
        titleClass: "text-success-700",
      };
    default:
      return {
        icon: <MessageSquare size={13} />,
        iconClass: "border-border bg-surface-muted text-content-subtle",
        titleClass: "text-content-muted",
      };
  }
}

function getStatusClass(status: WorkEvent["status"]): string {
  return {
    pending: "text-warning-600",
    running: "text-primary-600",
    completed: "text-success-600",
    failed: "text-danger-600",
    aborted: "text-content-subtle",
    info: "text-content-subtle",
  }[status];
}

function getEventStatusLabel(status: WorkEvent["status"]): string {
  return {
    pending: "等待",
    running: "进行中",
    completed: "完成",
    failed: "失败",
    aborted: "已停止",
    info: "",
  }[status];
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}
