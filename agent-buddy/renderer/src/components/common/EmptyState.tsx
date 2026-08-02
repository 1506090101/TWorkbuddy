/**
 * F0.4: EmptyState component
 */
import { type ReactNode } from "react";
import { cn } from "@utils/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12",
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-surface-subtle flex items-center justify-center text-content-subtle mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-content mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-content-muted max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
