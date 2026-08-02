import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clock3, ShieldAlert, X } from "lucide-react";
import { Button } from "@components/common";
import { usePermissionStore } from "@stores/permissionStore";

const TIMEOUT_SECONDS = 30;

export function PermissionOverlay() {
  const request = usePermissionStore((state) => state.request);
  const error = usePermissionStore((state) => state.error);
  const setRequest = usePermissionStore((state) => state.setRequest);
  const respond = usePermissionStore((state) => state.respond);
  const clear = usePermissionStore((state) => state.clear);
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onPermissionRequest(setRequest);
    return () => unsubscribe?.();
  }, [setRequest]);

  useEffect(() => {
    if (!request) return;
    const update = () => {
      const elapsed = Math.floor((Date.now() - request.timestamp) / 1000);
      setSecondsLeft(Math.max(0, TIMEOUT_SECONDS - elapsed));
    };
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [request]);

  useEffect(() => {
    if (request && secondsLeft === 0) clear();
  }, [clear, request, secondsLeft]);

  useEffect(() => {
    if (!request) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") void respond("deny");
      if (event.key === "Enter") void respond("allow");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [request, respond]);

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/20 px-5 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-title"
        className="w-full max-w-lg border border-border bg-surface p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={
                request.permission === "confirm_warn"
                  ? "flex h-9 w-9 items-center justify-center bg-danger-50 text-danger-600"
                  : "flex h-9 w-9 items-center justify-center bg-warning-50 text-warning-700"
              }
            >
              {request.permission === "confirm_warn" ? (
                <AlertTriangle size={18} />
              ) : (
                <ShieldAlert size={18} />
              )}
            </span>
            <div>
              <h2
                id="permission-title"
                className="text-sm font-semibold text-content"
              >
                Agent 请求执行工具
              </h2>
              <p className="mt-1 text-xs text-content-muted">
                {request.toolLabel} · {request.toolName}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭权限请求"
            className="text-content-subtle hover:text-content"
            onClick={() => void respond("deny")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 border-l-2 border-warning-400 bg-warning-50 px-3 py-2.5 text-xs leading-5 text-warning-900 dark:bg-warning-900/20 dark:text-warning-200">
          {request.impact}
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-content-subtle">
            参数摘要
          </p>
          <pre className="selectable mt-1 max-h-32 overflow-auto border border-border bg-surface-muted p-2 font-code text-[10px] leading-4 text-content-muted">
            {JSON.stringify(request.params, null, 2)}
          </pre>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-content-subtle">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={12} />
            {secondsLeft} 秒后自动拒绝
          </span>
          {error && <span className="text-danger-600">{error}</span>}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<X size={13} />}
            onClick={() => void respond("deny")}
          >
            拒绝
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Check size={13} />}
            onClick={() => void respond("allow_always")}
          >
            允许并记住
          </Button>
          <Button
            size="sm"
            variant={
              request.permission === "confirm_warn" ? "danger" : "primary"
            }
            icon={<Check size={13} />}
            onClick={() => void respond("allow")}
          >
            允许
          </Button>
        </div>
      </div>
    </div>
  );
}
