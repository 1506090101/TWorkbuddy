import { useEffect, useState } from "react";
import { Coins, Hash } from "lucide-react";
import type { SessionUsage } from "@shared/types";

export function SessionUsageIndicator({
  sessionId,
  refreshToken,
}: {
  sessionId: string;
  refreshToken: number;
}) {
  const [usage, setUsage] = useState<SessionUsage>();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    setLoadFailed(false);
    void window.electronAPI
      .getSessionUsage(sessionId)
      .then((next) => {
        if (!disposed) setUsage(next);
      })
      .catch(() => {
        if (!disposed) setLoadFailed(true);
      });
    return () => {
      disposed = true;
    };
  }, [refreshToken, sessionId]);

  if (loadFailed) {
    return <span className="text-status-danger">用量不可用</span>;
  }
  if (!usage || usage.requests === 0) return null;

  return (
    <span className="hidden items-center gap-2 text-[10px] text-content-subtle md:inline-flex">
      <span className="inline-flex items-center gap-0.5">
        <Hash size={11} />
        {formatTokens(usage.tokens)}
      </span>
      <span className="inline-flex items-center gap-0.5">
        <Coins size={11} />
        {usage.pricedRequests > 0 ? formatUsd(usage.costUsd) : "未定价"}
      </span>
    </span>
  );
}

function formatTokens(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : String(value);
}

function formatUsd(value: number): string {
  return value >= 0.01 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}
