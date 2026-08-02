export const KEYBINDING_DEFINITIONS = [
  {
    id: "palette.open",
    label: "打开命令面板",
    category: "工作台",
    defaultKeys: "Ctrl+Shift+P",
  },
  {
    id: "session.new",
    label: "新建任务",
    category: "任务",
    defaultKeys: "Ctrl+N",
  },
  {
    id: "composer.focus",
    label: "聚焦任务输入",
    category: "工作台",
    defaultKeys: "Ctrl+K",
  },
  {
    id: "session.next",
    label: "切换到下一任务",
    category: "任务",
    defaultKeys: "Ctrl+Tab",
  },
  {
    id: "session.previous",
    label: "切换到上一任务",
    category: "任务",
    defaultKeys: "Ctrl+Shift+Tab",
  },
  {
    id: "settings.open",
    label: "打开设置",
    category: "设置",
    defaultKeys: "Ctrl+,",
  },
] as const;

export type KeybindingCommandId = (typeof KEYBINDING_DEFINITIONS)[number]["id"];
export type KeybindingOverrides = Partial<Record<KeybindingCommandId, string>>;

const RESERVED_BINDINGS = new Set([
  "Ctrl+A",
  "Ctrl+C",
  "Ctrl+V",
  "Ctrl+X",
  "Ctrl+Y",
  "Ctrl+Z",
]);

export function getKeybinding(
  id: KeybindingCommandId,
  overrides: KeybindingOverrides
): string {
  return overrides[id] ?? getKeybindingDefinition(id).defaultKeys;
}

export function getKeybindingDefinition(id: KeybindingCommandId) {
  return KEYBINDING_DEFINITIONS.find((definition) => definition.id === id)!;
}

export function matchesKeybinding(
  event: KeyboardEvent,
  binding: string
): boolean {
  const parts = binding.split("+");
  const expectedKey = parts.at(-1)?.toLocaleLowerCase();
  if (!expectedKey) return false;
  const wantsModifier = parts.includes("Ctrl");
  const wantsShift = parts.includes("Shift");
  const wantsAlt = parts.includes("Alt");
  return (
    (event.ctrlKey || event.metaKey) === wantsModifier &&
    event.shiftKey === wantsShift &&
    event.altKey === wantsAlt &&
    normalizeEventKey(event.key) === expectedKey
  );
}

export function captureKeybinding(event: KeyboardEvent): {
  binding?: string;
  error?: string;
} {
  if (["Control", "Meta", "Shift", "Alt"].includes(event.key)) {
    return { error: "请同时按下一个非修饰键" };
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey) {
    return { error: "快捷键必须包含 Ctrl/Cmd 或 Alt" };
  }
  const key = displayEventKey(event.key);
  if (!key) return { error: "该按键不能作为快捷键" };
  const binding = [
    event.ctrlKey || event.metaKey ? "Ctrl" : undefined,
    event.altKey ? "Alt" : undefined,
    event.shiftKey ? "Shift" : undefined,
    key,
  ]
    .filter(Boolean)
    .join("+");
  if (RESERVED_BINDINGS.has(binding)) {
    return { error: "不能覆盖复制、粘贴或撤销等系统编辑快捷键" };
  }
  return { binding };
}

function normalizeEventKey(key: string): string {
  if (key === " ") return "space";
  return key.toLocaleLowerCase();
}

function displayEventKey(key: string): string | undefined {
  if (key === " ") return "Space";
  if (key === "Escape") return "Esc";
  if (key.length === 1) return key.toLocaleUpperCase();
  if (
    ["Tab", "Enter", "Backspace", "Delete", "ArrowUp", "ArrowDown"].includes(
      key
    )
  ) {
    return key;
  }
  return undefined;
}
