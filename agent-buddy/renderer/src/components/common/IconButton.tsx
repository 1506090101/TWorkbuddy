/**
 * F0.4: IconButton — Icon-only button with tooltip
 */
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Tooltip } from "./Tooltip";
import { cn } from "@utils/cn";

type Variant = "default" | "primary" | "danger" | "ghost";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  tooltip?: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<Variant, string> = {
  default: "text-content-muted hover:bg-surface-hover hover:text-content",
  primary: "text-primary-500 hover:bg-primary-500/10",
  danger: "text-danger-500 hover:bg-danger-500/10",
  ghost: "text-content-muted hover:text-content",
};

const sizeStyles = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

const iconSizes = {
  sm: 14,
  md: 16,
  lg: 20,
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { icon, tooltip, variant = "default", size = "md", className, ...props },
    ref
  ) => {
    const button = (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {icon}
      </button>
    );

    if (tooltip) {
      return <Tooltip content={tooltip}>{button}</Tooltip>;
    }

    return button;
  }
);

IconButton.displayName = "IconButton";

// Export icon sizes for use in icon components
export { iconSizes };
