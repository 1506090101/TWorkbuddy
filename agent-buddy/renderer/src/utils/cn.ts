/**
 * F0.4: className utility — merge Tailwind classes
 */
import { clsx, type ClassValue } from "clsx";

// Note: We use clsx for now; twMerge can be added later if needed
// to resolve Tailwind class conflicts
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
