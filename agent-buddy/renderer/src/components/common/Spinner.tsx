/**
 * F0.4: Spinner component
 */
import { Loader2 } from "lucide-react";
import { cn } from "@utils/cn";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: 14,
  md: 20,
  lg: 32,
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <Loader2
      size={sizeMap[size]}
      className={cn("animate-spin text-primary-500", className)}
    />
  );
}
