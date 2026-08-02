/**
 * F0.3: Custom TitleBar
 *
 * - Drag region for window movement
 * - Window controls (minimize/maximize/close)
 * - Model selector + Agent switcher + Settings + Knowledge quick access
 */
import { Minus, Square, X, Copy } from "lucide-react";
import { useUIStore } from "@stores/uiStore";
import { useTranslation } from "@i18n";

export function TitleBar() {
  const { t } = useTranslation();
  const openSettings = useUIStore((s) => s.openSettings);
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <div
      className="drag-region flex items-center justify-between h-10 bg-surface-muted border-b border-border select-none"
      style={{ height: "var(--layout-titlebar-height)" }}
    >
      {/* Left: App name + nav */}
      <div className="flex items-center gap-1 px-3 no-drag">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">AB</span>
          </div>
          <span className="text-sm font-semibold text-content">
            {t("app.name")}
          </span>
        </div>

        <div className="w-px h-4 bg-border mx-2" />

        {/* Quick nav */}
        <button
          onClick={() => setActiveView("chat")}
          className="px-2 py-1 text-xs text-content-muted hover:text-content hover:bg-surface-hover rounded-md transition-colors duration-150"
        >
          {t("titlebar.chat")}
        </button>
        <button
          onClick={() => setActiveView("agents")}
          className="px-2 py-1 text-xs text-content-muted hover:text-content hover:bg-surface-hover rounded-md transition-colors duration-150"
        >
          {t("titlebar.agents")}
        </button>
        <button
          onClick={() => setActiveView("knowledge")}
          className="px-2 py-1 text-xs text-content-muted hover:text-content hover:bg-surface-hover rounded-md transition-colors duration-150"
        >
          {t("titlebar.knowledge")}
        </button>
      </div>

      {/* Center: Drag area (empty, for window dragging) */}
      <div className="flex-1 drag-region" />

      {/* Right: Quick actions + window controls */}
      <div className="flex items-center gap-1 px-2 no-drag">
        <button
          onClick={() => openSettings("appearance")}
          className="w-7 h-7 flex items-center justify-center text-content-muted hover:text-content hover:bg-surface-hover rounded-md transition-colors duration-150"
          title={t("titlebar.settings")}
        >
          <Settings2Icon />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Window controls */}
        <button
          onClick={() => window.electronAPI?.windowMinimize?.()}
          className="w-8 h-7 flex items-center justify-center text-content-muted hover:bg-surface-hover rounded-md transition-colors duration-150"
          title={t("titlebar.minimize")}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.electronAPI?.windowMaximize?.()}
          className="w-8 h-7 flex items-center justify-center text-content-muted hover:bg-surface-hover rounded-md transition-colors duration-150"
          title={t("titlebar.maximize")}
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.electronAPI?.windowClose?.()}
          className="w-8 h-7 flex items-center justify-center text-content-muted hover:bg-danger-500 hover:text-white rounded-md transition-colors duration-150"
          title={t("titlebar.close")}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// Simple inline icon to avoid extra imports during foundation phase
function Settings2Icon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  );
}

// Suppress unused import warning — Copy will be used in future model selector
void Copy;
