/**
 * F0.4: Switch (toggle) component
 */
import { type ButtonHTMLAttributes } from "react";
import { cn } from "@utils/cn";

interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "sm" | "md";
  label?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  size = "md",
  label,
  className,
  disabled,
  ...props
}: SwitchProps) {
  const dimensions = {
    sm: { track: "w-7 h-4", thumb: "w-3 h-3", translate: "translate-x-3" },
    md: { track: "w-9 h-5", thumb: "w-4 h-4", translate: "translate-x-4" },
  };

  const d = dimensions[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex items-center gap-2",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "relative inline-flex items-center rounded-full transition-colors duration-200",
          d.track,
          checked ? "bg-primary-500" : "bg-neutral-300 dark:bg-neutral-700"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 inline-block bg-white rounded-full shadow-sm transition-transform duration-200 ease-out-expo",
            d.thumb,
            checked && d.translate
          )}
        />
      </span>
      {label && (
        <span className="text-sm text-content select-none">{label}</span>
      )}
    </button>
  );
}
