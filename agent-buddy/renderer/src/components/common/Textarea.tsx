/**
 * F0.4: Textarea component
 *
 * With label, auto-resize option
 */
import {
  type TextareaHTMLAttributes,
  forwardRef,
  useEffect,
  useRef,
} from "react";
import { cn } from "@utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  autoResize?: boolean;
  maxHeight?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      autoResize = false,
      maxHeight = 200,
      className,
      id,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    // Merge forwarded ref and inner ref
    const setRefs = (element: HTMLTextAreaElement | null) => {
      innerRef.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref)
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
          element;
    };

    // Auto-resize
    useEffect(() => {
      if (!autoResize || !innerRef.current) return;
      const el = innerRef.current;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
    }, [value, autoResize, maxHeight]);

    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-content mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={setRefs}
          id={textareaId}
          value={value}
          onChange={onChange}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg resize-none",
            "bg-surface border border-border",
            "placeholder:text-content-subtle",
            "focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent",
            "transition-all duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-danger-400 focus:ring-danger-400",
            className
          )}
          style={autoResize ? { maxHeight: `${maxHeight}px` } : undefined}
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

Textarea.displayName = "Textarea";
