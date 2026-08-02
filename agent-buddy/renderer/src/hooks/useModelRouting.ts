import { useEffect, useState } from "react";
import type { RoutingDecision } from "@shared/types";

export function useModelRouting(hasImages: boolean) {
  const [decision, setDecision] = useState<RoutingDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasImages) {
      setDecision(null);
      setError(null);
      return;
    }

    let active = true;
    void window.electronAPI
      .getActiveModel("default", true)
      .then((nextDecision) => {
        if (!active) return;
        setDecision(nextDecision);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setDecision(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "请配置 Vision Model 后重试"
        );
      });

    return () => {
      active = false;
    };
  }, [hasImages]);

  return { decision, error };
}
