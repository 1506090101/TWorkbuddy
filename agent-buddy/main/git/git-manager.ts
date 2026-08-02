import { spawn } from "child_process";
import type { FileChange, GitStatus } from "@shared/types";

const MAX_GIT_OUTPUT = 512 * 1024;

export class GitManager {
  async getStatus(rootPath: string): Promise<GitStatus | null> {
    const repository = await this.run(rootPath, [
      "rev-parse",
      "--is-inside-work-tree",
    ]);
    if (!repository.ok || repository.output.trim() !== "true") return null;

    const [branchResult, upstreamResult, statusResult] = await Promise.all([
      this.run(rootPath, ["symbolic-ref", "--short", "HEAD"]),
      this.run(rootPath, [
        "rev-list",
        "--left-right",
        "--count",
        "HEAD...@{upstream}",
      ]),
      this.run(rootPath, ["status", "--porcelain=v1", "-z"]),
    ]);
    if (!statusResult.ok) return null;

    const [ahead, behind] = upstreamResult.ok
      ? parseAheadBehind(upstreamResult.output)
      : [0, 0];
    const changes = parsePorcelainStatus(statusResult.output);
    return {
      branch: branchResult.ok ? branchResult.output.trim() || "HEAD" : "HEAD",
      ahead,
      behind,
      staged: changes.staged,
      unstaged: changes.unstaged,
      untracked: changes.untracked,
      totalChanges:
        changes.staged.length +
        changes.unstaged.length +
        changes.untracked.length,
    };
  }

  private run(
    cwd: string,
    args: string[]
  ): Promise<{ ok: boolean; output: string }> {
    return new Promise((resolve) => {
      const child = spawn("git", args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: getSafeEnvironment(),
      });
      let output = "";
      const append = (chunk: Buffer) => {
        output = `${output}${chunk.toString("utf8")}`.slice(-MAX_GIT_OUTPUT);
      };
      const timeout = setTimeout(() => child.kill(), 5_000);
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      child.once("error", () => {
        clearTimeout(timeout);
        resolve({ ok: false, output: "" });
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        resolve({ ok: code === 0, output });
      });
    });
  }
}

function parseAheadBehind(output: string): [number, number] {
  const [ahead, behind] = output
    .trim()
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10));
  return [
    Number.isFinite(ahead) ? ahead : 0,
    Number.isFinite(behind) ? behind : 0,
  ];
}

function parsePorcelainStatus(output: string): {
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
} {
  const staged: FileChange[] = [];
  const unstaged: FileChange[] = [];
  const untracked: string[] = [];
  const entries = output.split("\0");

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || entry.length < 4) continue;
    const code = entry.slice(0, 2);
    const path = entry.slice(3);
    if (code === "??") {
      untracked.push(path);
      continue;
    }
    const change = { path, status: toFileStatus(code) };
    if (code[0] !== " ") staged.push(change);
    if (code[1] !== " ") unstaged.push(change);
    if (code[0] === "R" || code[0] === "C") index += 1;
  }

  return { staged, unstaged, untracked };
}

function toFileStatus(code: string): FileChange["status"] {
  if (code.includes("A")) return "added";
  if (code.includes("D")) return "deleted";
  if (code.includes("R") || code.includes("C")) return "renamed";
  return "modified";
}

function getSafeEnvironment(): Record<string, string> {
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

let manager: GitManager | undefined;

export function getGitManager(): GitManager {
  manager ??= new GitManager();
  return manager;
}
