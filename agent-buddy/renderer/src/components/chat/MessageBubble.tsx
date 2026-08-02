import type { ChatMessage } from "@shared/types";
import { AgentBadge } from "./AgentBadge";
import { ImageAttachments } from "./ImageAttachments";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { StreamingCursor } from "./StreamingCursor";
import { ThinkingIndicator } from "./ThinkingIndicator";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <article
      data-index={message.id}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && <AgentBadge name={message.agentName} />}
      <div
        className={`max-w-[78%] break-words px-4 py-3 text-sm leading-6 ${
          isUser
            ? "rounded-2xl rounded-br-md bg-primary-500 text-white"
            : "rounded-md border border-border bg-surface text-content shadow-sm"
        }`}
      >
        <ImageAttachments images={message.images} />
        {isUser ? (
          message.content && (
            <p className="selectable whitespace-pre-wrap">{message.content}</p>
          )
        ) : message.content ? (
          <MarkdownRenderer
            content={message.content}
            isStreaming={message.isStreaming}
          />
        ) : message.isStreaming ? (
          <ThinkingIndicator />
        ) : null}
        {message.isStreaming && message.content && <StreamingCursor />}
        {message.error && (
          <p className="mt-2 border-t border-danger-500/20 pt-2 text-xs text-danger-600 dark:text-danger-400">
            {message.error}
          </p>
        )}
      </div>
    </article>
  );
}
