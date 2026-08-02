/**
 * F0.6: UI Store — Layout state, theme, panel visibility
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ThemeMode, Locale } from "@shared/types";
import type {
  KeybindingCommandId,
  KeybindingOverrides,
} from "../commands/keybindings";

interface UIState {
  // === Theme ===
  themeMode: ThemeMode; // user preference: light/dark/system
  resolvedTheme: "light" | "dark"; // actual applied theme
  setThemeMode: (mode: ThemeMode) => void;
  setResolvedTheme: (theme: "light" | "dark") => void;
  uiFontSize: number;
  codeFontSize: number;
  codeFontFamily: string;
  setUIFontSize: (size: number) => void;
  setCodeFontSize: (size: number) => void;
  setCodeFontFamily: (family: string) => void;

  // === Locale (i18n) ===
  locale: Locale; // "zh-CN" | "en", default "zh-CN"
  setLocale: (locale: Locale) => void;

  // === Layout — Panel visibility ===
  sidebarCollapsed: boolean;
  rightPanelVisible: boolean;
  rightPanelWidth: number;
  sidebarWidth: number;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelVisible: (visible: boolean) => void;
  setRightPanelWidth: (width: number) => void;
  setSidebarWidth: (width: number) => void;

  // === Layout — Active view ===
  activeView:
    | "chat"
    | "settings"
    | "knowledge"
    | "memory"
    | "agents"
    | "workflows"
    | "channels";
  setActiveView: (view: UIState["activeView"]) => void;

  // === Settings dialog ===
  settingsOpen: boolean;
  settingsTab: string;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;

  // === Command palette ===
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;

  // === F1.17: custom workbench keybindings ===
  keybindingOverrides: KeybindingOverrides;
  setKeybindingOverride: (id: KeybindingCommandId, keys: string) => void;
  resetKeybindingOverrides: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // === Theme ===
      themeMode: "system",
      resolvedTheme: "light",
      setThemeMode: (mode) => set({ themeMode: mode }),
      setResolvedTheme: (theme) => set({ resolvedTheme: theme }),
      uiFontSize: 14,
      codeFontSize: 14,
      codeFontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      setUIFontSize: (size) => set({ uiFontSize: clamp(size, 12, 18) }),
      setCodeFontSize: (size) => set({ codeFontSize: clamp(size, 12, 20) }),
      setCodeFontFamily: (family) =>
        set({ codeFontFamily: family.trim() || "monospace" }),

      // === Locale ===
      locale: "zh-CN",
      setLocale: (locale) => set({ locale }),

      // === Layout — Panel visibility ===
      sidebarCollapsed: false,
      rightPanelVisible: true,
      rightPanelWidth: 360,
      sidebarWidth: 260,

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleRightPanel: () =>
        set((s) => ({ rightPanelVisible: !s.rightPanelVisible })),
      setRightPanelVisible: (visible) => set({ rightPanelVisible: visible }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      // === Layout — Active view ===
      activeView: "chat",
      setActiveView: (view) => set({ activeView: view }),

      // === Settings dialog ===
      settingsOpen: false,
      settingsTab: "providers",
      openSettings: (tab) =>
        set({
          settingsOpen: true,
          settingsTab: tab ?? "providers",
        }),
      closeSettings: () => set({ settingsOpen: false }),

      // === Command palette ===
      commandPaletteOpen: false,
      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      // === F1.17: custom workbench keybindings ===
      keybindingOverrides: {},
      setKeybindingOverride: (id, keys) =>
        set((state) => ({
          keybindingOverrides: {
            ...state.keybindingOverrides,
            [id]: keys,
          },
        })),
      resetKeybindingOverrides: () => set({ keybindingOverrides: {} }),
    }),
    {
      name: "agent-buddy-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        uiFontSize: state.uiFontSize,
        codeFontSize: state.codeFontSize,
        codeFontFamily: state.codeFontFamily,
        locale: state.locale,
        sidebarCollapsed: state.sidebarCollapsed,
        rightPanelVisible: state.rightPanelVisible,
        rightPanelWidth: state.rightPanelWidth,
        sidebarWidth: state.sidebarWidth,
        keybindingOverrides: state.keybindingOverrides,
      }),
    }
  )
);

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : minimum;
}
