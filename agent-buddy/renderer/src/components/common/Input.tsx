/**
 * F0.4: Input component
 *
 * With label, error, hint text
 */
import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, className, id, showPasswordToggle, type, ...props },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-content mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            "w-full h-9 px-3 text-sm rounded-lg",
            "bg-surface border border-border",
            "placeholder:text-content-subtle",
            "focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent",
            "transition-all duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-danger-400 focus:ring-danger-400",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-danger-500 animate-fade-in">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1 text-xs text-content-subtle">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
