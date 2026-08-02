/**
 * F0.2: Theme management hook
 *
 * - Resolves system theme preference (prefers-color-scheme)
 * - Applies dark class to <html> element
 * - Listens for system theme changes
 */
import { useEffect } from "react";
import { useUIStore } from "@stores/uiStore";

export function useTheme() {
  const themeMode = useUIStore((s) => s.themeMode);
  const resolvedTheme = useUIStore((s) => s.resolvedTheme);
  const setResolvedTheme = useUIStore((s) => s.setResolvedTheme);
  const uiFontSize = useUIStore((s) => s.uiFontSize);
  const codeFontSize = useUIStore((s) => s.codeFontSize);
  const codeFontFamily = useUIStore((s) => s.codeFontFamily);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const getSystemTheme = (): "light" | "dark" =>
      mediaQuery.matches ? "dark" : "light";

    const applyTheme = (theme: "light" | "dark") => {
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      setResolvedTheme(theme);
    };

    // Resolve actual theme based on mode
    if (themeMode === "system") {
      applyTheme(getSystemTheme());

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      applyTheme(themeMode);
    }
  }, [themeMode, setResolvedTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-size-base", `${uiFontSize}px`);
    root.style.setProperty("--font-size-code", `${codeFontSize}px`);
    root.style.setProperty("--font-code", codeFontFamily);
  }, [codeFontFamily, codeFontSize, uiFontSize]);

  return { themeMode, resolvedTheme, uiFontSize, codeFontSize, codeFontFamily };
}
