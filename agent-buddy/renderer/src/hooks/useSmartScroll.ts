import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_PAUSE_DISTANCE = 200;

export function useSmartScroll(items: readonly unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    autoScrollRef.current = true;
    setShowScrollButton(false);
  }, []);

  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldAutoScroll = distanceFromBottom <= SCROLL_PAUSE_DISTANCE;
    autoScrollRef.current = shouldAutoScroll;
    setShowScrollButton(!shouldAutoScroll);
  }, []);

  useEffect(() => {
    if (autoScrollRef.current) scrollToBottom();
  }, [items, scrollToBottom]);

  return { containerRef, onScroll, scrollToBottom, showScrollButton };
}
