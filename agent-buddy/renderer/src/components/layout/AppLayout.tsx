/**
 * F0.3: AppLayout — Three-column layout skeleton
 *
 * ┌──────────────────────────────────────────────────────┐
 * │  TitleBar (40px, drag region, window controls)       │
 * ├────────┬─────────────────────────────┬───────────────┤
 * │        │                             │               │
 * │ Side   │   Main Content (flex-1)     │  Right Panel  │
 * │ bar    │                             │  (collapsible)│
 * │ (260px)│                             │  (360px)      │
 * │        │                             │               │
 * ├────────┴─────────────────────────────┤               │
 * │  Input Bar (adaptive height)          │               │
 * └──────────────────────────────────────┴───────────────┘
 */
import { type ReactNode } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { useUIStore } from "@stores/uiStore";
import { cn } from "@utils/cn";
import { PanelRightClose, PanelRight } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
  rightPanel?: ReactNode;
}

export function AppLayout({ children, rightPanel }: AppLayoutProps) {
  const rightPanelVisible = useUIStore((s) => s.rightPanelVisible);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);

  return (
    <div className="flex flex-col h-screen w-screen bg-surface text-content overflow-hidden">
      {/* Title bar */}
      <TitleBar />

      {/* Main content area: sidebar + main + right panel */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {children}

          {/* Right panel toggle button (floating) */}
          <button
            onClick={toggleRightPanel}
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 w-6 h-12",
              "flex items-center justify-center",
              "bg-surface-muted border border-border border-r-0 rounded-l-md",
              "text-content-muted hover:text-content hover:bg-surface-hover",
              "transition-colors duration-150 z-10"
            )}
            title={rightPanelVisible ? "Hide panel" : "Show panel"}
          >
            {rightPanelVisible ? (
              <PanelRightClose size={14} />
            ) : (
              <PanelRight size={14} />
            )}
          </button>
        </main>

        {/* Right panel (collapsible) */}
        {rightPanelVisible && rightPanel && (
          <aside
            className="border-l border-border bg-surface-muted overflow-hidden flex flex-col"
            style={{ width: "var(--layout-rightpanel-width)" }}
          >
            {rightPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
