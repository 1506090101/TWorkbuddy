import { spawn } from "child_process";
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
  lstat,
} from "fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "path";
import type { BrowserWindow } from "electron";
import type {
  BuiltinToolName,
  Checkpoint,
  PermissionLevel,
  ToolDefinition,
  ToolExecutionResult,
} from "@shared/types";
import { getWorkSessionManager } from "../work-session/work-session-manager";
import { getPermissionManager } from "./permission-manager";
import { getChangeManager } from "../change/change-manager";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_LENGTH = 24_000;
const MAX_RESULTS = 200;
const MAX_SCAN_FILES = 1_000;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "out",
  "build",
  ".next",
  ".turbo",
]);

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: "read",
    label: "读取文件",
    description: "读取项目内的 UTF-8 文本文件",
    permission: "auto",
    category: "file_read",
  },
  {
    name: "ls",
    label: "浏览目录",
    description: "列出项目内目录内容",
    permission: "auto",
    category: "file_read",
  },
  {
    name: "grep",
    label: "搜索文本",
    description: "在项目文本文件中搜索内容",
    permission: "auto",
    category: "file_read",
  },
  {
    name: "find",
    label: "查找文件",
    description: "按文件名查找项目内文件",
    permission: "auto",
    category: "file_read",
  },
  {
    name: "write",
    label: "写入文件",
    description: "创建或覆盖项目内文本文件",
    permission: "confirm",
    category: "file_write",
  },
  {
    name: "edit",
    label: "编辑文件",
    description: "替换项目内文本文件中的一段内容",
    permission: "confirm",
    category: "file_write",
  },
  {
    name: "bash",
    label: "执行命令",
    description: "在项目根目录内启动一个不经过 shell 的命令",
    permission: "confirm_warn",
    category: "command_exec",
  },
];

export interface AgentToolCall {
  name: BuiltinToolName;
  args: Record<string, unknown>;
}

export class BuiltinToolManager {
  async execute(
    window: BrowserWindow,
    sessionId: string,
    toolCall: AgentToolCall,
    signal: AbortSignal
  ): Promise<ToolExecutionResult> {
    const definition = getToolDefinition(toolCall.name);
    const startedAt = Date.now();
    const workSessions = getWorkSessionManager();
    const projectRoot = await getProjectRoot(sessionId);

    workSessions.recordToolActivity(sessionId, {
      toolName: definition.name,
      title: `正在执行：${definition.label}`,
      status: "running",
      content: getToolTargetSummary(toolCall.args),
      metadata: { permission: definition.permission },
    });

    const permission = await getPermissionManager().request(window, {
      sessionId,
      toolName: definition.name,
      toolLabel: definition.label,
      permission: definition.permission,
      params: getPermissionSummary(toolCall.args),
      impact: getPermissionImpact(definition.permission, toolCall.args),
      category: definition.category,
    });
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (permission === "deny") {
      const result: ToolExecutionResult = {
        toolName: definition.name,
        output: "用户拒绝了此工具操作。",
        duration: Date.now() - startedAt,
        denied: true,
      };
      workSessions.recordToolActivity(sessionId, {
        toolName: definition.name,
        title: `已拒绝：${definition.label}`,
        status: "failed",
        content: result.output,
      });
      return result;
    }

    let checkpoint: Checkpoint | undefined;
    let mutationApplied = false;
    try {
      if (definition.name === "write" || definition.name === "edit") {
        checkpoint = await getChangeManager().createCheckpoint(
          sessionId,
          projectRoot,
          getString(toolCall.args.path, "path"),
          definition.name
        );
      }
      const result = await this.run(
        projectRoot,
        definition.name,
        toolCall.args,
        signal
      );
      const completed: ToolExecutionResult = {
        ...result,
        toolName: definition.name,
        duration: Date.now() - startedAt,
      };
      mutationApplied = Boolean(completed.changedPath);
      const executionStatus =
        completed.exitCode !== undefined && completed.exitCode !== 0
          ? "failed"
          : "completed";
      workSessions.recordToolActivity(sessionId, {
        toolName: definition.name,
        title:
          executionStatus === "completed"
            ? `已完成：${definition.label}`
            : `执行失败：${definition.label}`,
        status: executionStatus,
        content: completed.output,
        metadata:
          completed.exitCode === undefined
            ? undefined
            : { exitCode: completed.exitCode },
      });
      if (
        completed.changedPath &&
        (definition.name === "write" || definition.name === "edit")
      ) {
        const changeset = checkpoint
          ? await getChangeManager().captureChange(
              sessionId,
              checkpoint.id,
              projectRoot,
              workSessions.getLatestTaskSummary(sessionId)
            )
          : undefined;
        workSessions.recordFileChange(sessionId, {
          path: completed.changedPath,
          operation: definition.name,
          metadata: changeset
            ? {
                checkpointId: checkpoint?.id,
                changesetId: changeset.id,
                additions: changeset.totalAdditions,
                deletions: changeset.totalDeletions,
              }
            : undefined,
        });
      }
      return completed;
    } catch (error) {
      if (checkpoint && !mutationApplied) {
        getChangeManager().discardCheckpoint(sessionId, checkpoint.id);
      }
      const message = getErrorMessage(error);
      workSessions.recordToolActivity(sessionId, {
        toolName: definition.name,
        title: `执行失败：${definition.label}`,
        status: "failed",
        content: message,
      });
      throw error;
    }
  }

  list(): ToolDefinition[] {
    return BUILTIN_TOOLS.map((tool) => ({ ...tool }));
  }

  private async run(
    root: string,
    name: BuiltinToolName,
    args: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<Omit<ToolExecutionResult, "toolName" | "duration">> {
    switch (name) {
      case "read":
        return this.read(root, args);
      case "ls":
        return this.listDirectory(root, args);
      case "grep":
        return this.grep(root, args);
      case "find":
        return this.find(root, args);
      case "write":
        return this.write(root, args);
      case "edit":
        return this.edit(root, args);
      case "bash":
        return this.runCommand(root, args, signal);
    }
  }

  private async read(root: string, args: Record<string, unknown>) {
    const target = await resolveProjectPath(root, getString(args.path, "path"));
    const text = await readTextFile(target);
    return { output: text };
  }

  private async listDirectory(root: string, args: Record<string, unknown>) {
    const target = await resolveProjectPath(
      root,
      getOptionalString(args.path) ?? "."
    );
    const info = await stat(target);
    if (!info.isDirectory()) throw new Error("目标不是目录");
    const entries = await readdir(target, { withFileTypes: true });
    const output = entries
      .filter((entry) => !SKIPPED_DIRECTORIES.has(entry.name))
      .slice(0, MAX_RESULTS)
      .map(
        (entry) => `${entry.isDirectory() ? "[dir]" : "[file]"} ${entry.name}`
      )
      .join("\n");
    return { output: output || "目录为空" };
  }

  private async grep(root: string, args: Record<string, unknown>) {
    const query = getString(args.query, "query").trim();
    if (!query) throw new Error("搜索内容不能为空");
    if (query.length > 300) throw new Error("搜索内容过长");
    const searchRoot = await resolveProjectPath(
      root,
      getOptionalString(args.path) ?? "."
    );
    const files = await walkFiles(searchRoot);
    const results: string[] = [];
    for (const file of files) {
      if (results.length >= MAX_RESULTS) break;
      let text: string;
      try {
        text = await readTextFile(file);
      } catch {
        continue;
      }
      for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (!line.includes(query)) continue;
        results.push(
          `${toProjectRelative(root, file)}:${index + 1}: ${line.slice(0, 300)}`
        );
        if (results.length >= MAX_RESULTS) break;
      }
    }
    return { output: results.length ? results.join("\n") : "未找到匹配内容" };
  }

  private async find(root: string, args: Record<string, unknown>) {
    const query = getString(args.query, "query").trim().toLowerCase();
    if (!query) throw new Error("文件名查询不能为空");
    const searchRoot = await resolveProjectPath(
      root,
      getOptionalString(args.path) ?? "."
    );
    const files = await walkFiles(searchRoot);
    const results = files
      .filter((file) => basename(file).toLowerCase().includes(query))
      .slice(0, MAX_RESULTS)
      .map((file) => toProjectRelative(root, file));
    return { output: results.length ? results.join("\n") : "未找到匹配文件" };
  }

  private async write(root: string, args: Record<string, unknown>) {
    const target = await resolveProjectPath(root, getString(args.path, "path"));
    const content = getString(args.content, "content");
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      throw new Error("写入内容超过 2MB 限制");
    }
    await assertNoSymlinkPath(root, target);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    return {
      output: `已写入 ${toProjectRelative(root, target)}`,
      changedPath: toProjectRelative(root, target),
    };
  }

  private async edit(root: string, args: Record<string, unknown>) {
    const target = await resolveProjectPath(root, getString(args.path, "path"));
    const oldText = getString(args.oldText, "oldText");
    const newText = getString(args.newText, "newText");
    const text = await readTextFile(target);
    const index = text.indexOf(oldText);
    if (index < 0) throw new Error("未找到要替换的原始文本");
    if (text.indexOf(oldText, index + oldText.length) >= 0) {
      throw new Error("原始文本匹配多处，请提供更精确的内容");
    }
    const updated = `${text.slice(0, index)}${newText}${text.slice(index + oldText.length)}`;
    if (Buffer.byteLength(updated, "utf8") > MAX_FILE_BYTES) {
      throw new Error("编辑后的文件超过 2MB 限制");
    }
    await writeFile(target, updated, "utf8");
    return {
      output: `已编辑 ${toProjectRelative(root, target)}`,
      changedPath: toProjectRelative(root, target),
    };
  }

  private async runCommand(
    root: string,
    args: Record<string, unknown>,
    signal: AbortSignal
  ) {
    const command = getString(args.command, "command");
    const commandArgs = getStringArray(args.args, "args", 64);
    const cwd = await resolveProjectPath(
      root,
      getOptionalString(args.cwd) ?? "."
    );
    const { output, exitCode } = await runWithoutShell(
      command,
      commandArgs,
      cwd,
      signal
    );
    return { output, exitCode };
  }
}

function getToolDefinition(name: BuiltinToolName): ToolDefinition {
  const definition = BUILTIN_TOOLS.find((tool) => tool.name === name);
  if (!definition) throw new Error(`不支持的工具：${name}`);
  return definition;
}

async function getProjectRoot(sessionId: string): Promise<string> {
  const rootPath = getWorkSessionManager().get(sessionId).project?.rootPath;
  if (!rootPath) throw new Error("请先选择项目目录，再让 Agent 使用工具");
  const root = await realpath(rootPath);
  const details = await stat(root);
  if (!details.isDirectory()) throw new Error("当前项目目录不可用");
  return root;
}

async function resolveProjectPath(
  root: string,
  requestedPath: string
): Promise<string> {
  if (!requestedPath.trim()) throw new Error("路径不能为空");
  const target = resolve(root, requestedPath);
  const pathToRoot = relative(root, target);
  if (
    pathToRoot.startsWith(`..${sep}`) ||
    pathToRoot === ".." ||
    isAbsolute(pathToRoot)
  ) {
    throw new Error("工具不能访问项目目录之外的路径");
  }
  await assertNoSymlinkPath(root, target);
  return target;
}

async function assertNoSymlinkPath(
  root: string,
  target: string
): Promise<void> {
  const segments = relative(root, target).split(sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = resolve(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error("工具不能跟随符号链接");
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  }
}

async function readTextFile(path: string): Promise<string> {
  const info = await stat(path);
  if (!info.isFile()) throw new Error("目标不是文件");
  if (info.size > MAX_FILE_BYTES) throw new Error("文件超过 2MB 读取限制");
  const buffer = await readFile(path);
  if (buffer.includes(0)) throw new Error("目标不是可读取的文本文件");
  return buffer.toString("utf8");
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    if (files.length >= MAX_SCAN_FILES) return;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_SCAN_FILES) return;
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const target = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
    }
  };
  await visit(root);
  return files;
}

function runWithoutShell(
  command: string,
  args: string[],
  cwd: string,
  signal: AbortSignal
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: getSafeCommandEnvironment(),
    });
    let output = "";
    const append = (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-MAX_OUTPUT_LENGTH);
    };
    const timeout = setTimeout(() => child.kill(), 120_000);
    const abort = () => child.kill();
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", (error) => {
      cleanup();
      rejectPromise(error);
    });
    child.once("close", (code) => {
      cleanup();
      resolvePromise({
        output: output.trim() || "命令没有输出",
        exitCode: typeof code === "number" ? code : 1,
      });
    });

    function cleanup() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  });
}

function getSafeCommandEnvironment(): Record<string, string> {
  const allowed = [
    "PATH",
    "Path",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "PATHEXT",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
  ];
  return Object.fromEntries(
    allowed.flatMap((key) => {
      const value = process.env[key];
      return value ? [[key, value]] : [];
    })
  );
}

function getPermissionSummary(
  args: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, 200) : value,
    ])
  );
}

function getPermissionImpact(
  permission: PermissionLevel,
  args: Record<string, unknown>
): string {
  const path = getOptionalString(args.path);
  if (permission === "confirm_warn") {
    return "该命令会在当前项目目录中执行，可能读取、修改或删除文件。请确认命令和参数。";
  }
  return path
    ? `该操作会修改项目文件：${path}`
    : "该操作会修改当前项目中的内容。";
}

function getToolTargetSummary(
  args: Record<string, unknown>
): string | undefined {
  return getOptionalString(args.path) ?? getOptionalString(args.command);
}

function getString(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} 必须是文本`);
  return value;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown, name: string, max: number): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > max ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(`${name} 必须是字符串数组`);
  }
  return value.map((item) => item.slice(0, 500));
}

function toProjectRelative(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/") || ".";
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "工具执行失败";
}

let manager: BuiltinToolManager | undefined;

export function getBuiltinToolManager(): BuiltinToolManager {
  manager ??= new BuiltinToolManager();
  return manager;
}
