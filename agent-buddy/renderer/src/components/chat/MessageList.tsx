import { Bot } from "lucide-react";
import type { ChatMessage } from "@shared/types";
import { useSmartScroll } from "@hooks/useSmartScroll";
import { useTranslation } from "@i18n";
import { MessageBubble } from "./MessageBubble";
import { ScrollToBottomButton } from "./ScrollToBottomButton";

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const { t } = useTranslation();
  const { containerRef, onScroll, scrollToBottom, showScrollButton } =
    useSmartScroll(messages);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary-500/10 text-primary-500">
              <Bot size={22} />
            </div>
            <h2 className="text-base font-semibold text-content">
              {t("chat.emptyTitle")}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-content-muted">
              {t("chat.emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>
      {showScrollButton && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  );
}
