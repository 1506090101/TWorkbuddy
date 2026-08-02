/**
 * F0.4: Tabs component
 *
 * Variants: underline / pill
 */
import { type ReactNode, useState } from "react";
import { cn } from "@utils/cn";

interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  content?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultActiveKey?: string;
  activeKey?: string;
  onChange?: (key: string) => void;
  variant?: "underline" | "pill";
  className?: string;
}

export function Tabs({
  items,
  defaultActiveKey,
  activeKey: controlledActiveKey,
  onChange,
  variant = "underline",
  className,
}: TabsProps) {
  const [internalActive, setInternalActive] = useState(
    defaultActiveKey || items[0]?.key || ""
  );
  const activeKey = controlledActiveKey ?? internalActive;

  const handleChange = (key: string) => {
    setInternalActive(key);
    onChange?.(key);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tab bar */}
      <div
        className={cn(
          "flex items-center gap-1",
          variant === "underline" && "border-b border-border px-2",
          variant === "pill" && "bg-surface-subtle p-1 rounded-lg"
        )}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              onClick={() => handleChange(item.key)}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium transition-all duration-150",
                variant === "underline" &&
                  cn(
                    "px-3 py-2 border-b-2 -mb-px",
                    isActive
                      ? "border-primary-500 text-primary-600 dark:text-primary-400"
                      : "border-transparent text-content-muted hover:text-content"
                  ),
                variant === "pill" &&
                  cn(
                    "px-3 py-1.5 rounded-md",
                    isActive
                      ? "bg-surface text-content shadow-sm"
                      : "text-content-muted hover:text-content"
                  )
              )}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {items.find((item) => item.key === activeKey)?.content}
      </div>
    </div>
  );
}
