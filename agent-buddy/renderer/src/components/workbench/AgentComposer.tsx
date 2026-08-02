import { useEffect, useRef, useState } from "react";
import {
  CircleStop,
  FileCode2,
  FileImage,
  Goal,
  ImagePlus,
  Paperclip,
  Plus,
  RotateCcw,
  Plug,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ComposerAttachment,
  ComposerContext,
  ContentBlock,
  AgentListItem,
  ThinkingLevel,
  WorkSession,
} from "@shared/types";
import { Button, IconButton } from "@components/common";
import { useProviderStore } from "@stores/providerStore";
import { useWorkSessionStore } from "@stores/workSessionStore";
import { AgentSelector } from "./AgentSelector";
import { SessionUsageIndicator } from "./SessionUsageIndicator";
import { cn } from "@utils/cn";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_TEXT_SIZE = 2 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "mdx",
  "json",
  "yaml",
  "yml",
  "xml",
  "csv",
  "log",
  "env.example",
]);
const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "css",
  "scss",
  "html",
  "vue",
  "svelte",
  "py",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "cpp",
  "h",
  "hpp",
  "sql",
  "sh",
  "ps1",
  "toml",
]);

const QUICK_COMMANDS = [
  {
    id: "agent",
    label: "/agent",
    description: "按名称或 id 切换当前任务 Agent",
    needsArgument: true,
  },
  {
    id: "model",
    label: "/model",
    description: "按 Provider/模型切换当前会话模型",
    needsArgument: true,
  },
  {
    id: "goal",
    label: "/goal",
    description: "打开当前任务的目标编辑器",
    needsArgument: false,
  },
  {
    id: "project",
    label: "/project",
    description: "为当前任务选择项目目录",
    needsArgument: false,
  },
  {
    id: "files",
    label: "/files",
    description: "添加图片、文本或代码附件",
    needsArgument: false,
  },
] as const;

type QuickCommandId = (typeof QUICK_COMMANDS)[number]["id"];
type ComposerAction = "focus" | "files" | "goal";

interface AgentComposerProps {
  session: WorkSession;
  hasProvider: boolean;
}

export function AgentComposer({ session, hasProvider }: AgentComposerProps) {
  const providers = useProviderStore((state) => state.providers);
  const refreshActive = useWorkSessionStore((state) => state.refreshActive);
  const updateGoal = useWorkSessionStore((state) => state.updateGoal);
  const updateAgent = useWorkSessionStore((state) => state.updateAgent);
  const updateProject = useWorkSessionStore((state) => state.updateProject);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [pluginIds] = useState<string[]>([]);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(
    session.modelOverride?.thinkingLevel ?? "off"
  );
  const [modelValue, setModelValue] = useState("");
  const [defaultModelValue, setDefaultModelValue] = useState("");
  const [isModelOverridden, setIsModelOverridden] = useState(
    Boolean(session.modelOverride)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menu, setMenu] = useState<"files" | "plugins" | "goal" | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState(session.goal?.title ?? "");
  const [goalDescription, setGoalDescription] = useState(
    session.goal?.description ?? ""
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const [quickCommandIndex, setQuickCommandIndex] = useState(0);

  useEffect(() => {
    let disposed = false;
    const syncModel = async () => {
      if (session.modelOverride) {
        setIsModelOverridden(true);
        setModelValue(
          `${session.modelOverride.providerId}/${session.modelOverride.modelId}`
        );
      } else {
        setIsModelOverridden(false);
        try {
          const assignment = await window.electronAPI.getModelAssignment(
            session.activeAgentId
          );
          if (
            !disposed &&
            assignment.chat.providerId &&
            assignment.chat.modelId
          ) {
            setDefaultModelValue(
              `${assignment.chat.providerId}/${assignment.chat.modelId}`
            );
            setModelValue(
              `${assignment.chat.providerId}/${assignment.chat.modelId}`
            );
            setThinkingLevel(assignment.thinkingLevel);
            return;
          }
        } catch {
          // Fall back to the first configured model while settings are loading.
        }
        if (!disposed) {
          const first = providers[0]?.models[0];
          const fallback = first ? `${providers[0].id}/${first.id}` : "";
          setDefaultModelValue(fallback);
          setModelValue(fallback);
        }
      }
    };
    void syncModel();
    setThinkingLevel(session.modelOverride?.thinkingLevel ?? "off");
    setGoalTitle(session.goal?.title ?? "");
    setGoalDescription(session.goal?.description ?? "");
    return () => {
      disposed = true;
    };
  }, [providers, session.activeAgentId, session.goal, session.modelOverride]);

  const selectedModel = findModel(providers, modelValue);
  const slashInput = parseSlashInput(draft);
  const quickCommands = getQuickCommands(slashInput?.command ?? "");
  const isRunning = session.status === "running" || isSubmitting;
  const canSubmit =
    hasProvider &&
    !isRunning &&
    Boolean(draft.trim() || attachments.length > 0) &&
    Boolean(selectedModel);

  useEffect(() => {
    setQuickCommandIndex(0);
  }, [draft]);

  useEffect(() => {
    const handler = (event: Event) => {
      const action = (event as CustomEvent<ComposerAction>).detail;
      if (action === "focus") {
        composerInputRef.current?.focus();
      } else if (action === "files") {
        fileInputRef.current?.click();
      } else if (action === "goal") {
        setMenu("goal");
      }
    };
    window.addEventListener("agent-buddy:composer-action", handler);
    return () =>
      window.removeEventListener("agent-buddy:composer-action", handler);
  }, []);

  const submit = async () => {
    if (!canSubmit || !selectedModel) return;
    setIsSubmitting(true);
    setComposerError(null);
    const context: ComposerContext = {
      agentId: session.activeAgentId,
      modelOverride: isModelOverridden
        ? {
            providerId: selectedModel.providerId,
            modelId: selectedModel.modelId,
            thinkingLevel,
          }
        : undefined,
      thinkingLevel,
      attachments,
      pluginIds,
      goalId: session.goal?.id,
    };
    const blocks: ContentBlock[] = [];
    if (draft.trim()) blocks.push({ type: "text", text: draft.trim() });
    for (const attachment of attachments) {
      if (attachment.kind === "image") {
        blocks.push({
          type: "image",
          source: { data: attachment.data, media_type: attachment.mimeType },
        });
      } else {
        blocks.push({
          type: "text",
          text: `[附件：${attachment.name}]\n${attachment.data}`,
        });
      }
    }

    try {
      const result = await window.electronAPI.prompt({
        sessionId: session.id,
        agentId: session.activeAgentId,
        context,
        message: { role: "user", content: blocks },
      });
      if (!result.success) {
        setComposerError(result.error ?? "Agent 运行失败");
      } else {
        setDraft("");
        setAttachments([]);
      }
      await refreshActive();
    } catch (error) {
      setComposerError(getErrorMessage(error));
      await refreshActive();
    } finally {
      setIsSubmitting(false);
    }
  };

  const stop = async () => {
    await window.electronAPI.abort(session.id);
    await refreshActive();
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setComposerError(null);
    const next: ComposerAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        next.push(await readAttachment(file));
      } catch (error) {
        setComposerError(getErrorMessage(error));
      }
    }
    if (next.length > 0) setAttachments((current) => [...current, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMenu(null);
  };

  const saveGoal = async () => {
    if (!goalTitle.trim()) return;
    await updateGoal({
      id: session.goal?.id,
      title: goalTitle,
      description: goalDescription,
      status: session.goal?.status ?? "active",
    });
    setMenu(null);
  };

  const executeSlashCommand = async (overrideId?: QuickCommandId) => {
    const parsed = parseSlashInput(draft);
    if (!parsed) return;
    const command = QUICK_COMMANDS.find(
      (item) => item.id === (overrideId ?? parsed.command)
    );
    if (!command) {
      setComposerError(`未知命令：/${parsed.command || draft.slice(1)}`);
      return;
    }
    if (command.needsArgument && !parsed.arguments) {
      setComposerError(`${command.label} 需要一个参数`);
      return;
    }
    setComposerError(null);
    try {
      switch (command.id) {
        case "agent": {
          const agents = await window.electronAPI.listAgents();
          const agent = findSlashAgent(agents, parsed.arguments);
          if (!agent) {
            throw new Error(`未找到 Agent：${parsed.arguments}`);
          }
          await updateAgent(agent.id);
          break;
        }
        case "model": {
          const model = findSlashModel(providers, parsed.arguments);
          if (!model) {
            throw new Error(
              "未找到唯一模型，请使用 Provider/模型名称或模型 id"
            );
          }
          setModelValue(`${model.providerId}/${model.modelId}`);
          setIsModelOverridden(true);
          break;
        }
        case "goal":
          setMenu("goal");
          break;
        case "project": {
          const project = await window.electronAPI.chooseWorkSessionProject();
          if (project) await updateProject(project);
          break;
        }
        case "files":
          fileInputRef.current?.click();
          break;
        default:
          return;
      }
      setDraft("");
    } catch (error) {
      setComposerError(getErrorMessage(error));
    }
  };

  const completeQuickCommand = (command: (typeof QUICK_COMMANDS)[number]) => {
    if (!command.needsArgument) {
      void executeSlashCommand(command.id);
      return;
    }
    if (slashInput?.hasArguments) {
      void executeSlashCommand(command.id);
      return;
    }
    setDraft(`${command.label} `);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  return (
    <div className="relative shrink-0 border-t border-border bg-surface px-5 py-4">
      {composerError && (
        <div className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-3 text-xs text-danger-600">
          <span>{composerError}</span>
          <button
            type="button"
            onClick={() => setComposerError(null)}
            aria-label="关闭错误"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 border border-border bg-surface-muted px-2 py-1.5 text-xs text-content-muted"
            >
              {attachment.kind === "image" ? (
                <FileImage size={13} />
              ) : (
                <FileCode2 size={13} />
              )}
              <span className="max-w-40 truncate">{attachment.name}</span>
              <button
                type="button"
                aria-label={`移除 ${attachment.name}`}
                onClick={() =>
                  setAttachments((current) =>
                    current.filter((item) => item.id !== attachment.id)
                  )
                }
                className="text-content-subtle hover:text-content"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {menu === "files" && (
        <div className="absolute bottom-16 left-6 z-20 w-56 border border-border bg-surface p-1.5 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-content hover:bg-surface-hover"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={14} /> 添加图片、文本或代码文件
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-content hover:bg-surface-hover"
            onClick={() => setMenu("plugins")}
          >
            <Plug size={14} /> 插件上下文
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-content hover:bg-surface-hover"
            onClick={() => setMenu("goal")}
          >
            <Goal size={14} /> 设置会话目标
          </button>
        </div>
      )}

      {menu === "plugins" && (
        <div className="absolute bottom-16 left-6 z-20 w-64 border border-border bg-surface p-3 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium text-content">
            <Plug size={14} />
            插件上下文
          </div>
          <p className="mt-2 text-xs leading-5 text-content-muted">
            首轮仅保留入口和上下文状态，暂无可用插件。
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => setMenu(null)}
          >
            完成
          </Button>
        </div>
      )}

      {menu === "goal" && (
        <div className="absolute bottom-16 left-6 z-20 w-72 border border-border bg-surface p-3 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium text-content">
            <Goal size={14} />
            会话目标
          </div>
          <input
            value={goalTitle}
            onChange={(event) => setGoalTitle(event.target.value)}
            placeholder="目标标题"
            className="mt-3 h-8 w-full border border-border bg-surface px-2 text-xs outline-none focus:border-primary-400"
          />
          <textarea
            value={goalDescription}
            onChange={(event) => setGoalDescription(event.target.value)}
            placeholder="完成标准（可选）"
            rows={3}
            className="mt-2 w-full resize-none border border-border bg-surface px-2 py-1.5 text-xs leading-5 outline-none focus:border-primary-400"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMenu(null)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!goalTitle.trim()}
              onClick={() => void saveGoal()}
            >
              保存目标
            </Button>
          </div>
        </div>
      )}

      {slashInput && (
        <div className="mx-auto mb-2 max-w-3xl overflow-hidden border border-border bg-surface shadow-sm">
          {quickCommands.length === 0 ? (
            <p className="px-3 py-2 text-xs text-content-muted">
              未找到斜杠命令
            </p>
          ) : (
            quickCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                onMouseEnter={() => setQuickCommandIndex(index)}
                onClick={() => completeQuickCommand(command)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left",
                  index === quickCommandIndex
                    ? "bg-primary-50 dark:bg-primary-900/20"
                    : "hover:bg-surface-hover"
                )}
              >
                <code className="shrink-0 text-[11px] font-medium text-primary-700 dark:text-primary-300">
                  {command.label}
                </code>
                <span className="min-w-0 flex-1 truncate text-[11px] text-content-muted">
                  {command.description}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="mx-auto flex max-w-3xl flex-col gap-2 border border-border bg-surface-muted p-2 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/20">
        <textarea
          ref={composerInputRef}
          id="agent-buddy-composer-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onPaste={(event) => {
            const imageFiles = Array.from(event.clipboardData.files).filter(
              (file) => file.type.startsWith("image/")
            );
            if (imageFiles.length > 0) {
              event.preventDefault();
              void addFiles(createFileList(imageFiles));
            }
          }}
          onKeyDown={(event) => {
            if (slashInput && quickCommands.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setQuickCommandIndex((index) =>
                  Math.min(index + 1, quickCommands.length - 1)
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setQuickCommandIndex((index) => Math.max(index - 1, 0));
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setDraft("");
                return;
              }
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (slashInput) {
                const selected = quickCommands[quickCommandIndex];
                if (!slashInput.hasArguments && selected) {
                  completeQuickCommand(selected);
                } else {
                  void executeSlashCommand();
                }
              } else {
                void submit();
              }
            }
          }}
          placeholder="描述开发任务、问题或需要审查的变更，或输入 / 命令…"
          aria-label="Agent 任务输入"
          rows={2}
          className="selectable max-h-40 min-h-16 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-content outline-none placeholder:text-content-subtle"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.txt,.md,.mdx,.json,.yaml,.yml,.xml,.csv,.log,.ts,.tsx,.js,.jsx,.css,.html,.vue,.py,.go,.rs,.java,.sql,.sh,.ps1,.toml"
          multiple
          className="hidden"
          onChange={(event) => void addFiles(event.target.files)}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border-muted pt-1.5">
          <div className="flex min-w-0 items-center gap-1">
            <IconButton
              type="button"
              size="sm"
              variant={menu === "files" ? "primary" : "ghost"}
              icon={<Plus size={16} />}
              tooltip="添加文件、插件或目标"
              aria-label="添加文件、插件或目标"
              disabled={isRunning}
              onClick={() => setMenu(menu === "files" ? null : "files")}
            />
            <span className="h-4 w-px bg-border" />
            <AgentSelector session={session} disabled={isRunning} />
            <label className="flex h-7 items-center gap-1.5 border border-border bg-surface px-2 text-[11px] text-content-muted">
              <Sparkles size={12} className="text-primary-500" />
              <select
                value={modelValue}
                onChange={(event) => {
                  setModelValue(event.target.value);
                  setIsModelOverridden(true);
                }}
                disabled={isRunning || providers.length === 0}
                className="max-w-40 bg-transparent outline-none"
              >
                {providers.length === 0 && <option value="">未配置模型</option>}
                {providers.flatMap((provider) =>
                  provider.models.map((model) => (
                    <option
                      key={`${provider.id}/${model.id}`}
                      value={`${provider.id}/${model.id}`}
                    >
                      {provider.name} / {model.name}
                    </option>
                  ))
                )}
              </select>
              {isModelOverridden && (
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw size={12} />}
                  tooltip="恢复 Agent 默认模型"
                  aria-label="恢复 Agent 默认模型"
                  disabled={isRunning}
                  onClick={() => {
                    setIsModelOverridden(false);
                    setModelValue(defaultModelValue);
                  }}
                />
              )}
            </label>
            <label className="hidden h-7 items-center gap-1.5 border border-border bg-surface px-2 text-[11px] text-content-muted sm:flex">
              <span>思考</span>
              <select
                value={thinkingLevel}
                onChange={(event) =>
                  setThinkingLevel(event.target.value as ThinkingLevel)
                }
                disabled={isRunning}
                className="bg-transparent outline-none"
              >
                <option value="off">关闭</option>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </label>
            <span className="hidden items-center gap-1 text-[10px] text-content-subtle md:flex">
              <Paperclip size={11} />
              {session.goal ? "目标已关联" : "可添加目标"}
            </span>
          </div>
          {isRunning ? (
            <IconButton
              type="button"
              size="md"
              variant="danger"
              icon={<CircleStop size={17} />}
              tooltip="停止 Agent 工作"
              aria-label="停止 Agent 工作"
              onClick={() => void stop()}
            />
          ) : (
            <IconButton
              type="button"
              size="md"
              variant="primary"
              icon={<Send size={17} />}
              tooltip="发送任务"
              aria-label="发送任务"
              disabled={!canSubmit}
              onClick={() => void submit()}
            />
          )}
        </div>
      </div>
      <p className="mx-auto mt-2 flex max-w-3xl items-center justify-between text-[10px] text-content-subtle">
        <span className="flex items-center gap-2">
          <span>Enter 发送 · Shift+Enter 换行 · / 命令</span>
          <SessionUsageIndicator
            sessionId={session.id}
            refreshToken={session.events.length}
          />
        </span>
        <span>
          {selectedModel
            ? `${selectedModel.providerName} / ${selectedModel.modelName}`
            : "未选择模型"}
        </span>
      </p>
    </div>
  );
}

function findModel(
  providers: ReturnType<typeof useProviderStore.getState>["providers"],
  value: string
) {
  const [providerId, ...modelParts] = value.split("/");
  const modelId = modelParts.join("/");
  const provider = providers.find((item) => item.id === providerId);
  const model = provider?.models.find((item) => item.id === modelId);
  return provider && model
    ? {
        providerId: provider.id,
        modelId: model.id,
        providerName: provider.name,
        modelName: model.name,
      }
    : undefined;
}

function parseSlashInput(value: string):
  | {
      command: string;
      arguments: string;
      hasArguments: boolean;
    }
  | undefined {
  if (!value.startsWith("/")) return undefined;
  const raw = value.slice(1);
  const [command = "", ...argumentParts] = raw.trimStart().split(/\s+/);
  const argumentsValue = argumentParts.join(" ").trim();
  return {
    command: command.toLocaleLowerCase(),
    arguments: argumentsValue,
    hasArguments: argumentsValue.length > 0,
  };
}

function getQuickCommands(query: string) {
  const normalized = query.toLocaleLowerCase();
  return QUICK_COMMANDS.filter((command) =>
    command.id.toLocaleLowerCase().startsWith(normalized)
  );
}

function findSlashAgent(
  agents: AgentListItem[],
  query: string
): AgentListItem | undefined {
  const normalized = query.trim().toLocaleLowerCase();
  const exact = agents.filter(
    (agent) =>
      agent.id.toLocaleLowerCase() === normalized ||
      agent.name.toLocaleLowerCase() === normalized
  );
  if (exact.length === 1) return exact[0];
  const partial = agents.filter(
    (agent) =>
      agent.id.toLocaleLowerCase().includes(normalized) ||
      agent.name.toLocaleLowerCase().includes(normalized)
  );
  return partial.length === 1 ? partial[0] : undefined;
}

function findSlashModel(
  providers: ReturnType<typeof useProviderStore.getState>["providers"],
  query: string
) {
  const normalized = query.trim().toLocaleLowerCase();
  const candidates = providers.flatMap((provider) =>
    provider.models.map((model) => ({
      providerId: provider.id,
      modelId: model.id,
      providerName: provider.name,
      modelName: model.name,
    }))
  );
  const matches = (candidate: (typeof candidates)[number]) =>
    [
      candidate.providerId,
      candidate.providerName,
      candidate.modelId,
      candidate.modelName,
      `${candidate.providerId}/${candidate.modelId}`,
      `${candidate.providerName}/${candidate.modelName}`,
    ].map((value) => value.toLocaleLowerCase());
  const exact = candidates.filter((candidate) =>
    matches(candidate).includes(normalized)
  );
  if (exact.length === 1) return exact[0];
  const partial = candidates.filter((candidate) =>
    matches(candidate).some((value) => value.includes(normalized))
  );
  return partial.length === 1 ? partial[0] : undefined;
}

async function readAttachment(file: File): Promise<ComposerAttachment> {
  const extension = file.name.includes(".")
    ? (file.name.split(".").pop()?.toLowerCase() ?? "")
    : "";
  const isImage = file.type.startsWith("image/");
  const kind = isImage
    ? "image"
    : TEXT_EXTENSIONS.has(extension)
      ? "text"
      : CODE_EXTENSIONS.has(extension)
        ? "code"
        : undefined;
  if (!kind) throw new Error(`不支持的附件类型：${file.name}`);
  if (kind === "image") {
    if (file.size > MAX_IMAGE_SIZE)
      throw new Error(`图片超过 20MB：${file.name}`);
    const dataUrl = await readAsDataURL(file);
    const comma = dataUrl.indexOf(",");
    return {
      id: makeAttachmentId(file),
      name: file.name,
      mimeType: file.type || "image/png",
      size: file.size,
      kind,
      createdAt: Date.now(),
      data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
      encoding: "base64",
    };
  }
  if (file.size > MAX_TEXT_SIZE)
    throw new Error(`文本文件超过 2MB：${file.name}`);
  const data = await file.text();
  if (data.includes("\u0000"))
    throw new Error(`文件不是可读文本：${file.name}`);
  return {
    id: makeAttachmentId(file),
    name: file.name,
    mimeType: file.type || "text/plain",
    size: file.size,
    kind,
    createdAt: Date.now(),
    data,
    encoding: "utf8",
  };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function makeAttachmentId(file: File): string {
  return `${file.name}_${file.lastModified}_${Math.random().toString(36).slice(2)}`;
}

function createFileList(files: File[]): FileList {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  return transfer.files;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "附件处理失败";
}
