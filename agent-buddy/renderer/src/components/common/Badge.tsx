/**
 * F0.4: Badge component
 *
 * Variants: default / success / warning / danger / info / primary
 * Optional dot variant
 */
import { type HTMLAttributes } from "react";
import { cn } from "@utils/cn";

type Variant =
  "default" | "success" | "warning" | "danger" | "info" | "primary";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  dot?: boolean;
  size?: "sm" | "md";
}

const variantStyles: Record<Variant, string> = {
  default: "bg-surface-subtle text-content-muted border-border",
  success:
    "bg-success-500/10 text-success-600 dark:text-success-500 border-success-500/20",
  warning:
    "bg-warning-500/10 text-warning-600 dark:text-warning-500 border-warning-500/20",
  danger:
    "bg-danger-500/10 text-danger-600 dark:text-danger-500 border-danger-500/20",
  info: "bg-info-500/10 text-info-600 dark:text-info-500 border-info-500/20",
  primary:
    "bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20",
};

const dotColors: Record<Variant, string> = {
  default: "bg-neutral-400",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
  primary: "bg-primary-500",
};

export function Badge({
  variant = "default",
  dot = false,
  size = "sm",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
