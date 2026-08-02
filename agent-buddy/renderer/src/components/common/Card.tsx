/**
 * F0.4: Card component
 *
 * With header / body / footer slots
 */
import { type HTMLAttributes } from "react";
import { cn } from "@utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  hover = false,
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-xl",
        hover &&
          "hover:border-primary-300 hover:shadow-md transition-all duration-200 ease-out-expo",
        className
      )}
      {...props}
    >
      {padding !== "none" && (
        <div
          className={cn(
            padding === "sm" && "p-3",
            padding === "md" && "p-4",
            padding === "lg" && "p-6"
          )}
        >
          {children}
        </div>
      )}
      {padding === "none" && children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-border flex items-center justify-between",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-t border-border flex items-center justify-end gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
