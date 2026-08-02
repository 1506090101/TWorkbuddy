/**
 * F0.2 / F1.17: Settings Dialog
 *
 * Multi-tab settings:
 * - Providers (F1.7 — stub)
 * - Model Assignment (F1.8 — stub)
 * - Appearance (theme, font size, language — functional now)
 * - Shortcuts (F1.16 — stub)
 */
import { useMemo, useState, type ReactNode } from "react";
import { Button, Dialog, Tabs } from "@components/common";
import { ProviderManagementPanel } from "./ProviderManagementPanel";
import { ModelAssignmentPanel } from "./ModelAssignmentPanel";
import { UsageSettingsPanel } from "./UsageSettingsPanel";
import { useUIStore } from "@stores/uiStore";
import { useTranslation } from "@i18n";
import { SUPPORTED_LOCALES } from "@i18n/translations";
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Key,
  Cpu,
  Keyboard,
  Languages,
  AlertTriangle,
  Check,
  RotateCcw,
  Search,
  Type,
  Coins,
} from "lucide-react";
import type { Locale } from "@shared/types";
import {
  captureKeybinding,
  getKeybinding,
  KEYBINDING_DEFINITIONS,
} from "../../commands/keybindings";
import { cn } from "@utils/cn";

export function SettingsDialog() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.settingsOpen);
  const activeTab = useUIStore((s) => s.settingsTab);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const openSettings = useUIStore((s) => s.openSettings);

  return (
    <Dialog
      open={open}
      onClose={closeSettings}
      title={t("settings.title")}
      size="xl"
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => openSettings(key)}
        items={[
          {
            key: "providers",
            label: t("settings.tabs.providers"),
            icon: <Key size={14} />,
            content: <ProviderManagementPanel />,
          },
          {
            key: "models",
            label: t("settings.tabs.models"),
            icon: <Cpu size={14} />,
            content: <ModelAssignmentPanel />,
          },
          {
            key: "usage",
            label: "用量",
            icon: <Coins size={14} />,
            content: <UsageSettingsPanel />,
          },
          {
            key: "appearance",
            label: t("settings.tabs.appearance"),
            icon: <Palette size={14} />,
            content: <AppearanceTab />,
          },
          {
            key: "shortcuts",
            label: t("settings.tabs.shortcuts"),
            icon: <Keyboard size={14} />,
            content: <ShortcutsTab />,
          },
        ]}
        className="h-[500px]"
      />
    </Dialog>
  );
}

function AppearanceTab() {
  const themeMode = useUIStore((state) => state.themeMode);
  const setThemeMode = useUIStore((state) => state.setThemeMode);
  const locale = useUIStore((state) => state.locale);
  const setLocale = useUIStore((state) => state.setLocale);
  const uiFontSize = useUIStore((state) => state.uiFontSize);
  const codeFontSize = useUIStore((state) => state.codeFontSize);
  const codeFontFamily = useUIStore((state) => state.codeFontFamily);
  const setUIFontSize = useUIStore((state) => state.setUIFontSize);
  const setCodeFontSize = useUIStore((state) => state.setCodeFontSize);
  const setCodeFontFamily = useUIStore((state) => state.setCodeFontFamily);
  const fontOptions = [
    { label: "JetBrains Mono", value: '"JetBrains Mono", monospace' },
    { label: "Fira Code", value: '"Fira Code", monospace' },
    { label: "Cascadia Code", value: '"Cascadia Code", monospace' },
    { label: "Source Code Pro", value: '"Source Code Pro", monospace' },
  ];
  const isCustomFont = !fontOptions.some(
    (option) => option.value === codeFontFamily
  );

  return (
    <div className="h-full overflow-y-auto p-4">
      <section>
        <h3 className="text-sm font-semibold text-content">主题</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <AppearanceOption
            active={themeMode === "light"}
            icon={<Sun size={16} />}
            label="浅色"
            onClick={() => setThemeMode("light")}
          />
          <AppearanceOption
            active={themeMode === "dark"}
            icon={<Moon size={16} />}
            label="深色"
            onClick={() => setThemeMode("dark")}
          />
          <AppearanceOption
            active={themeMode === "system"}
            icon={<Monitor size={16} />}
            label="跟随系统"
            onClick={() => setThemeMode("system")}
          />
        </div>
      </section>

      <section className="mt-5 border-t border-border pt-5">
        <div className="flex items-center gap-2">
          <Type size={15} className="text-content-muted" />
          <h3 className="text-sm font-semibold text-content">字体</h3>
        </div>
        <FontRange
          label="界面文字"
          value={uiFontSize}
          minimum={12}
          maximum={18}
          onChange={setUIFontSize}
        />
        <FontRange
          label="代码文字"
          value={codeFontSize}
          minimum={12}
          maximum={20}
          onChange={setCodeFontSize}
        />
        <label className="mt-4 block text-xs font-medium text-content-muted">
          代码字体
          <select
            value={isCustomFont ? "custom" : codeFontFamily}
            onChange={(event) => {
              if (event.target.value !== "custom")
                setCodeFontFamily(event.target.value);
            }}
            className="mt-1.5 h-8 w-full border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
          >
            {fontOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="custom">自定义字体</option>
          </select>
        </label>
        {isCustomFont && (
          <input
            value={codeFontFamily}
            onChange={(event) => setCodeFontFamily(event.target.value)}
            placeholder="输入系统已安装的字体名称"
            className="mt-2 h-8 w-full border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
          />
        )}
        <pre className="mt-3 overflow-hidden border border-border bg-surface-muted px-3 py-2 text-xs text-content">
          const task = "Agent Workbuddy";
        </pre>
      </section>

      <section className="mt-5 border-t border-border pt-5">
        <div className="flex items-center gap-2">
          <Languages size={15} className="text-content-muted" />
          <h3 className="text-sm font-semibold text-content">语言</h3>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {SUPPORTED_LOCALES.map((language) => (
            <AppearanceOption
              key={language.value}
              active={locale === language.value}
              icon={<span className="text-sm">{language.flag}</span>}
              label={language.label}
              onClick={() => setLocale(language.value as Locale)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AppearanceOption({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1 border px-2 text-xs transition-colors",
        active
          ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
          : "border-border text-content-muted hover:bg-surface-hover hover:text-content"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FontRange({
  label,
  value,
  minimum,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-4 block text-xs font-medium text-content-muted">
      <span className="flex items-center justify-between">
        {label}
        <span className="text-content">{value}px</span>
      </span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-primary-500"
      />
    </label>
  );
}

function ShortcutsTab() {
  const overrides = useUIStore((state) => state.keybindingOverrides);
  const setOverride = useUIStore((state) => state.setKeybindingOverride);
  const resetOverrides = useUIStore((state) => state.resetKeybindingOverrides);
  const [query, setQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string>();
  const [captureError, setCaptureError] = useState<string>();
  const rows = useMemo(
    () =>
      KEYBINDING_DEFINITIONS.map((definition) => ({
        ...definition,
        currentKeys: getKeybinding(definition.id, overrides),
      })),
    [overrides]
  );
  const conflicts = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of rows) {
      map.set(row.currentKeys, [...(map.get(row.currentKeys) ?? []), row.id]);
    }
    return new Set(
      [...map.values()].filter((ids) => ids.length > 1).flatMap((ids) => ids)
    );
  }, [rows]);
  const visibleRows = rows.filter((row) => {
    const text =
      `${row.label} ${row.category} ${row.currentKeys}`.toLocaleLowerCase();
    return text.includes(query.trim().toLocaleLowerCase());
  });

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-content">工作台快捷键</h3>
          <p className="mt-1 text-xs leading-5 text-content-muted">
            仅可修改全局工作台操作；文本编辑和变更审查快捷键保持原有边界。
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={resetOverrides}>
          <RotateCcw size={13} /> 恢复默认
        </Button>
      </div>

      <label className="mt-4 flex h-8 items-center gap-2 border border-border bg-surface px-2 text-content-muted focus-within:border-primary-400">
        <Search size={13} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索操作或按键"
          className="min-w-0 flex-1 bg-transparent text-xs text-content outline-none placeholder:text-content-subtle"
        />
      </label>

      {captureError && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-danger-600">
          <AlertTriangle size={13} />
          {captureError}
        </p>
      )}

      <div className="mt-3 divide-y divide-border border-y border-border">
        {visibleRows.map((row) => {
          const recording = recordingId === row.id;
          const conflict = conflicts.has(row.id);
          return (
            <div key={row.id} className="flex items-center gap-3 px-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-content">
                    {row.label}
                  </span>
                  <span className="text-[10px] text-content-subtle">
                    {row.category}
                  </span>
                </span>
                <span className="mt-0.5 block text-[10px] text-content-subtle">
                  默认 {row.defaultKeys}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setRecordingId(row.id);
                  setCaptureError(undefined);
                }}
                onKeyDown={(event) => {
                  if (!recording) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const result = captureKeybinding(event.nativeEvent);
                  if (result.error) {
                    setCaptureError(result.error);
                    return;
                  }
                  if (result.binding) {
                    setOverride(row.id, result.binding);
                    setRecordingId(undefined);
                  }
                }}
                className={cn(
                  "min-w-28 border px-2 py-1 text-center font-mono text-[11px] outline-none",
                  recording
                    ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                    : conflict
                      ? "border-danger-400 bg-danger-50 text-danger-700 dark:bg-danger-950/30 dark:text-danger-300"
                      : "border-border bg-surface-muted text-content-muted hover:border-primary-300"
                )}
              >
                {recording ? "按下组合键" : row.currentKeys}
              </button>
              {conflict && (
                <AlertTriangle size={14} className="shrink-0 text-danger-600" />
              )}
              {!conflict && row.currentKeys !== row.defaultKeys && (
                <Check size={14} className="shrink-0 text-success-600" />
              )}
            </div>
          );
        })}
        {visibleRows.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-content-muted">
            未找到快捷键
          </p>
        )}
      </div>
    </div>
  );
}
