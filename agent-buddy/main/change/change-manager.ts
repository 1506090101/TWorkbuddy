import { createHash, randomUUID } from "crypto";
import {
  mkdir,
  readFile,
  realpath,
  stat,
  unlink,
  writeFile,
  lstat,
} from "fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "path";
import { app } from "electron";
import Store from "electron-store";
import type {
  BuiltinToolName,
  ChangeHunkDecision,
  Changeset,
  ChangeFileReviewStatus,
  Checkpoint,
  DiffHunk,
  DiffLine,
  FileSnapshot,
  ReviewFileChange,
  SessionChangedFile,
  SessionChangesetView,
} from "@shared/types";
import { getWorkSessionManager } from "../work-session/work-session-manager";

const MAX_REVIEW_FILE_BYTES = 2 * 1024 * 1024;
const CHECKPOINT_TTL_MS = 30 * 60 * 1000;

interface ChangeStoreData {
  checkpoints: Record<string, Checkpoint[]>;
  changesets: Record<string, Changeset[]>;
  version: number;
}

export class ChangeManager {
  private readonly store: Store<ChangeStoreData>;

  constructor() {
    this.store = new Store<ChangeStoreData>({
      cwd: resolve(app.getPath("home"), ".agentbuddy", "changes"),
      name: "checkpoint-review",
      defaults: { checkpoints: {}, changesets: {}, version: 1 },
    });
  }

  async createCheckpoint(
    sessionId: string,
    projectRoot: string,
    path: string,
    toolName: Extract<BuiltinToolName, "write" | "edit">
  ): Promise<Checkpoint> {
    this.prune(sessionId);
    const root = await realpath(projectRoot);
    const target = await resolveProjectPath(root, path);
    const snapshot = await createSnapshot(root, target);
    const checkpoint: Checkpoint = {
      id: `checkpoint_${randomUUID()}`,
      sessionId,
      timestamp: Date.now(),
      description:
        toolName === "write"
          ? `写入文件 ${snapshot.path}`
          : `编辑文件 ${snapshot.path}`,
      files: [snapshot],
      trigger: "agent",
      toolName,
    };
    this.store.set("checkpoints", {
      ...this.store.get("checkpoints"),
      [sessionId]: [...this.listCheckpoints(sessionId), checkpoint],
    });
    return clone(checkpoint);
  }

  async captureChange(
    sessionId: string,
    checkpointId: string,
    projectRoot: string,
    reason?: string
  ): Promise<Changeset | undefined> {
    const checkpoint = this.getCheckpoint(sessionId, checkpointId);
    const root = await realpath(projectRoot);
    const files: ReviewFileChange[] = [];
    for (const snapshot of checkpoint.files) {
      const target = await resolveProjectPath(root, snapshot.path);
      const current = await readCurrentFile(target);
      const change = createReviewChange(snapshot, current);
      if (change) files.push(change);
    }
    if (files.length === 0) return undefined;

    const changeset: Changeset = {
      id: `changeset_${randomUUID()}`,
      sessionId,
      checkpointId,
      reason: sanitizeReason(reason),
      files,
      totalAdditions: files.reduce((total, file) => total + file.additions, 0),
      totalDeletions: files.reduce((total, file) => total + file.deletions, 0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.set("changesets", {
      ...this.store.get("changesets"),
      [sessionId]: [...this.listChangesets(sessionId), changeset],
    });
    return clone(changeset);
  }

  listCheckpoints(sessionId: string): Checkpoint[] {
    this.prune(sessionId);
    return clone(this.store.get("checkpoints")[sessionId] ?? []);
  }

  listChangesets(sessionId: string): Changeset[] {
    this.prune(sessionId);
    return clone(this.store.get("changesets")[sessionId] ?? []);
  }

  getSessionChangesetView(sessionId: string): SessionChangesetView {
    const changesets = this.listChangesets(sessionId);
    const files = new Map<string, SessionChangedFile>();
    for (const changeset of changesets) {
      for (const file of changeset.files) {
        const current = files.get(file.path);
        const decisionCounts = countHunkDecisions(file);
        if (current) {
          current.additions += file.additions;
          current.deletions += file.deletions;
          current.acceptedHunks += decisionCounts.accepted;
          current.rejectedHunks += decisionCounts.rejected;
          current.totalHunks += file.hunks.length;
          current.changesetIds.push(changeset.id);
          if (!current.checkpointIds.includes(changeset.checkpointId)) {
            current.checkpointIds.push(changeset.checkpointId);
          }
          if (changeset.reason) current.reason = changeset.reason;
          current.changeType = toSessionChangeType(file.status);
          current.reviewStatus = getFileReviewStatus(current);
          continue;
        }
        const entry: SessionChangedFile = {
          path: file.path,
          reason: changeset.reason ?? "Agent 修改项目文件",
          changeType: toSessionChangeType(file.status),
          additions: file.additions,
          deletions: file.deletions,
          checkpointIds: [changeset.checkpointId],
          changesetIds: [changeset.id],
          acceptedHunks: decisionCounts.accepted,
          rejectedHunks: decisionCounts.rejected,
          totalHunks: file.hunks.length,
          reviewStatus: "pending",
          agentChanges: true,
        };
        entry.reviewStatus = getFileReviewStatus(entry);
        files.set(file.path, entry);
      }
    }
    const entries = [...files.values()];
    const timestamps = changesets.map((changeset) => changeset.createdAt);
    const session = getWorkSessionManager().get(sessionId);
    return {
      id: `session-changeset_${sessionId}`,
      sessionId,
      title: session.goal?.title ?? session.title,
      files: entries,
      totalFiles: entries.length,
      totalAdditions: entries.reduce(
        (total, file) => total + file.additions,
        0
      ),
      totalDeletions: entries.reduce(
        (total, file) => total + file.deletions,
        0
      ),
      checkpointCount: this.listCheckpoints(sessionId).length,
      pendingFiles: entries.filter((file) => file.reviewStatus === "pending")
        .length,
      acceptedFiles: entries.filter((file) => file.reviewStatus === "accepted")
        .length,
      rejectedFiles: entries.filter((file) => file.reviewStatus === "rejected")
        .length,
      createdAt: timestamps.length
        ? Math.min(...timestamps)
        : session.createdAt,
      updatedAt: timestamps.length
        ? Math.max(...timestamps)
        : session.updatedAt,
    };
  }

  async acceptFile(
    sessionId: string,
    path: string
  ): Promise<SessionChangesetView> {
    const changesets = this.listChangesets(sessionId);
    let changed = false;
    for (const changeset of changesets) {
      for (const file of changeset.files) {
        if (file.path !== path) continue;
        file.hunks = file.hunks.map((hunk) => {
          if (hunk.decision !== "pending") return hunk;
          changed = true;
          return { ...hunk, decision: "accepted" };
        });
      }
      changeset.updatedAt = Date.now();
    }
    if (!changed) throw new Error("CHANGE_FILE_NOT_FOUND_OR_REVIEWED");
    this.setChangesets(sessionId, changesets);
    getWorkSessionManager().recordFileChange(sessionId, {
      path,
      operation: "accept",
      metadata: { scope: "file" },
    });
    return this.getSessionChangesetView(sessionId);
  }

  async rejectFile(
    sessionId: string,
    path: string
  ): Promise<SessionChangesetView> {
    const checkpoint = this.findFirstCheckpointForFile(sessionId, path);
    if (!checkpoint) throw new Error("CHANGE_FILE_NOT_FOUND");
    const snapshot = checkpoint.files.find((file) => file.path === path);
    if (!snapshot) throw new Error("CHECKPOINT_FILE_NOT_FOUND");
    await this.restoreSnapshot(sessionId, snapshot);
    const changesets = this.listChangesets(sessionId);
    for (const changeset of changesets) {
      for (const file of changeset.files) {
        if (file.path === path) {
          file.hunks = file.hunks.map((hunk) => ({
            ...hunk,
            decision: "rejected",
          }));
        }
      }
      changeset.updatedAt = Date.now();
    }
    this.setChangesets(sessionId, changesets);
    getWorkSessionManager().recordFileChange(sessionId, {
      path,
      operation: "revert",
      metadata: { scope: "file" },
    });
    return this.getSessionChangesetView(sessionId);
  }

  acceptAll(sessionId: string): SessionChangesetView {
    const changesets = this.listChangesets(sessionId);
    const paths = new Set<string>();
    let changed = false;
    for (const changeset of changesets) {
      for (const file of changeset.files) {
        paths.add(file.path);
        file.hunks = file.hunks.map((hunk) => {
          if (hunk.decision !== "pending") return hunk;
          changed = true;
          return { ...hunk, decision: "accepted" };
        });
      }
      changeset.updatedAt = Date.now();
    }
    if (changed) {
      this.setChangesets(sessionId, changesets);
      for (const path of paths) {
        getWorkSessionManager().recordFileChange(sessionId, {
          path,
          operation: "accept",
          metadata: { scope: "all" },
        });
      }
    }
    return this.getSessionChangesetView(sessionId);
  }

  async revertAll(sessionId: string): Promise<SessionChangesetView> {
    const first = this.listCheckpoints(sessionId)[0];
    if (!first) return this.getSessionChangesetView(sessionId);
    await this.rollbackCheckpoint(sessionId, first.id);
    return this.getSessionChangesetView(sessionId);
  }

  acceptChangeset(sessionId: string, changesetId: string): Changeset {
    const changesets = this.listChangesets(sessionId);
    const index = changesets.findIndex((item) => item.id === changesetId);
    if (index < 0) throw new Error("CHANGESET_NOT_FOUND");
    const changeset = changesets[index];
    const paths = new Set<string>();
    let changed = false;
    for (const file of changeset.files) {
      paths.add(file.path);
      file.hunks = file.hunks.map((hunk) => {
        if (hunk.decision !== "pending") return hunk;
        changed = true;
        return { ...hunk, decision: "accepted" };
      });
    }
    if (!changed) return clone(changeset);
    changeset.updatedAt = Date.now();
    changesets[index] = changeset;
    this.setChangesets(sessionId, changesets);
    for (const path of paths) {
      getWorkSessionManager().recordFileChange(sessionId, {
        path,
        operation: "accept",
        metadata: { changesetId, scope: "changeset" },
      });
    }
    return clone(changeset);
  }

  async rejectChangeset(
    sessionId: string,
    changesetId: string
  ): Promise<Changeset> {
    const changesets = this.listChangesets(sessionId);
    const index = changesets.findIndex((item) => item.id === changesetId);
    if (index < 0) throw new Error("CHANGESET_NOT_FOUND");
    const changeset = changesets[index];
    const checkpoint = this.getCheckpoint(sessionId, changeset.checkpointId);
    for (const file of changeset.files) {
      const snapshot = checkpoint.files.find((item) => item.path === file.path);
      if (!snapshot) throw new Error("CHECKPOINT_FILE_NOT_FOUND");
      await this.restoreSnapshot(sessionId, snapshot);
      file.hunks = file.hunks.map((hunk) => ({
        ...hunk,
        decision: "rejected",
      }));
      getWorkSessionManager().recordFileChange(sessionId, {
        path: file.path,
        operation: "revert",
        metadata: { changesetId, scope: "changeset" },
      });
    }
    changeset.updatedAt = Date.now();
    changesets[index] = changeset;
    this.setChangesets(sessionId, changesets);
    return clone(changeset);
  }

  async undoLastCheckpoint(sessionId: string): Promise<Changeset[]> {
    const checkpoint = this.listCheckpoints(sessionId).at(-1);
    if (!checkpoint) return this.listChangesets(sessionId);
    return this.rollbackCheckpoint(sessionId, checkpoint.id);
  }

  async decideHunk(
    sessionId: string,
    changesetId: string,
    path: string,
    hunkIndex: number,
    decision: ChangeHunkDecision
  ): Promise<Changeset> {
    if (!["accepted", "rejected"].includes(decision)) {
      throw new Error("CHANGE_DECISION_INVALID");
    }
    const changesets = this.listChangesets(sessionId);
    const index = changesets.findIndex((item) => item.id === changesetId);
    if (index < 0) throw new Error("CHANGESET_NOT_FOUND");
    const changeset = changesets[index];
    const file = changeset.files.find((item) => item.path === path);
    if (!file) throw new Error("DIFF_HUNK_NOT_FOUND");
    if (!file.hunks.some((hunk) => hunk.index === hunkIndex)) {
      throw new Error("DIFF_HUNK_NOT_FOUND");
    }

    if (decision === "rejected") {
      const checkpoint = this.getCheckpoint(sessionId, changeset.checkpointId);
      const snapshot = checkpoint.files.find((item) => item.path === file.path);
      if (!snapshot) throw new Error("CHECKPOINT_FILE_NOT_FOUND");
      await this.restoreSnapshot(sessionId, snapshot);
    }

    file.hunks = file.hunks.map((hunk) =>
      hunk.index === hunkIndex ? { ...hunk, decision } : hunk
    );
    changeset.updatedAt = Date.now();
    changesets[index] = changeset;
    this.setChangesets(sessionId, changesets);
    getWorkSessionManager().recordFileChange(sessionId, {
      path: file.path,
      operation: decision === "rejected" ? "revert" : "accept",
      metadata: { changesetId, path, hunkIndex, decision },
    });
    return clone(changeset);
  }

  async rollbackCheckpoint(
    sessionId: string,
    checkpointId: string
  ): Promise<Changeset[]> {
    const checkpoints = this.listCheckpoints(sessionId);
    const index = checkpoints.findIndex((item) => item.id === checkpointId);
    if (index < 0) throw new Error("CHECKPOINT_NOT_FOUND");
    const snapshots = new Map<string, FileSnapshot>();
    for (const checkpoint of checkpoints.slice(index)) {
      for (const snapshot of checkpoint.files) {
        if (!snapshots.has(snapshot.path))
          snapshots.set(snapshot.path, snapshot);
      }
    }
    for (const snapshot of snapshots.values()) {
      await this.restoreSnapshot(sessionId, snapshot);
      getWorkSessionManager().recordFileChange(sessionId, {
        path: snapshot.path,
        operation: "revert",
        metadata: { checkpointId },
      });
    }
    const remainingCheckpoints = checkpoints.slice(0, index);
    const revertedCheckpointIds = new Set(
      checkpoints.slice(index).map((checkpoint) => checkpoint.id)
    );
    const remainingChangesets = this.listChangesets(sessionId).filter(
      (changeset) => !revertedCheckpointIds.has(changeset.checkpointId)
    );
    this.store.set("checkpoints", {
      ...this.store.get("checkpoints"),
      [sessionId]: remainingCheckpoints,
    });
    this.store.set("changesets", {
      ...this.store.get("changesets"),
      [sessionId]: remainingChangesets,
    });
    return clone(remainingChangesets);
  }

  discardCheckpoint(sessionId: string, checkpointId: string): void {
    const checkpoints = this.listCheckpoints(sessionId).filter(
      (checkpoint) => checkpoint.id !== checkpointId
    );
    this.store.set("checkpoints", {
      ...this.store.get("checkpoints"),
      [sessionId]: checkpoints,
    });
  }

  private setChangesets(sessionId: string, changesets: Changeset[]): void {
    this.store.set("changesets", {
      ...this.store.get("changesets"),
      [sessionId]: changesets,
    });
  }

  private findFirstCheckpointForFile(
    sessionId: string,
    path: string
  ): Checkpoint | undefined {
    return this.listCheckpoints(sessionId).find((checkpoint) =>
      checkpoint.files.some((file) => file.path === path)
    );
  }

  private getCheckpoint(sessionId: string, checkpointId: string): Checkpoint {
    const checkpoint = this.listCheckpoints(sessionId).find(
      (item) => item.id === checkpointId
    );
    if (!checkpoint) throw new Error("CHECKPOINT_NOT_FOUND");
    return checkpoint;
  }

  private async restoreSnapshot(
    sessionId: string,
    snapshot: FileSnapshot
  ): Promise<void> {
    const root = await getSessionProjectRoot(sessionId);
    const target = await resolveProjectPath(root, snapshot.path);
    await assertNoSymlinkPath(root, target);
    if (!snapshot.existed) {
      try {
        const details = await lstat(target);
        if (details.isSymbolicLink()) throw new Error("不能回滚符号链接路径");
        await unlink(target);
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
      return;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, snapshot.content, "utf8");
  }

  private prune(sessionId: string): void {
    const minimum = Date.now() - CHECKPOINT_TTL_MS;
    const checkpoints = this.store
      .get("checkpoints")
      [sessionId]?.filter((checkpoint) => checkpoint.timestamp >= minimum);
    if (!checkpoints) return;
    const checkpointIds = new Set(
      checkpoints.map((checkpoint) => checkpoint.id)
    );
    const changesets = (this.store.get("changesets")[sessionId] ?? []).filter(
      (changeset) => checkpointIds.has(changeset.checkpointId)
    );
    this.store.set("checkpoints", {
      ...this.store.get("checkpoints"),
      [sessionId]: checkpoints,
    });
    this.store.set("changesets", {
      ...this.store.get("changesets"),
      [sessionId]: changesets,
    });
  }
}

async function getSessionProjectRoot(sessionId: string): Promise<string> {
  const rootPath = getWorkSessionManager().get(sessionId).project?.rootPath;
  if (!rootPath) throw new Error("PROJECT_ROOT_REQUIRED");
  const root = await realpath(rootPath);
  const details = await stat(root);
  if (!details.isDirectory()) throw new Error("PROJECT_ROOT_NOT_DIRECTORY");
  return root;
}

async function createSnapshot(
  root: string,
  target: string
): Promise<FileSnapshot> {
  const current = await readCurrentFile(target);
  return {
    path: toProjectRelative(root, target),
    existed: current.existed,
    content: current.content,
    hash: createHash("sha256").update(current.content).digest("hex"),
    size: Buffer.byteLength(current.content, "utf8"),
  };
}

async function readCurrentFile(
  target: string
): Promise<{ existed: boolean; content: string }> {
  try {
    const details = await stat(target);
    if (!details.isFile()) throw new Error("CHECKPOINT_TARGET_NOT_FILE");
    if (details.size > MAX_REVIEW_FILE_BYTES) {
      throw new Error("CHECKPOINT_FILE_TOO_LARGE");
    }
    const content = await readFile(target, "utf8");
    if (content.includes("\u0000"))
      throw new Error("CHECKPOINT_TARGET_NOT_TEXT");
    return { existed: true, content };
  } catch (error) {
    if (isNotFound(error)) return { existed: false, content: "" };
    throw error;
  }
}

function createReviewChange(
  snapshot: FileSnapshot,
  current: { existed: boolean; content: string }
): ReviewFileChange | undefined {
  if (
    snapshot.existed === current.existed &&
    snapshot.content === current.content
  ) {
    return undefined;
  }
  const hunk = createSingleHunk(snapshot.content, current.content);
  return {
    path: snapshot.path,
    status: !snapshot.existed
      ? "added"
      : !current.existed
        ? "deleted"
        : "modified",
    additions: hunk.lines.filter((line) => line.type === "addition").length,
    deletions: hunk.lines.filter((line) => line.type === "deletion").length,
    hunks: [hunk],
  };
}

function createSingleHunk(before: string, after: string): DiffHunk {
  const oldLines = toLines(before);
  const newLines = toLines(after);
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix += 1;
  }
  let oldEnd = oldLines.length;
  let newEnd = newLines.length;
  while (
    oldEnd > prefix &&
    newEnd > prefix &&
    oldLines[oldEnd - 1] === newLines[newEnd - 1]
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  const contextStart = Math.max(0, prefix - 3);
  const contextEndOld = Math.min(oldLines.length, oldEnd + 3);
  const contextEndNew = Math.min(newLines.length, newEnd + 3);
  const lines: DiffLine[] = [];
  for (let index = contextStart; index < prefix; index += 1) {
    lines.push({
      type: "context",
      content: oldLines[index],
      oldLineNumber: index + 1,
      newLineNumber: index + 1,
    });
  }
  for (let index = prefix; index < oldEnd; index += 1) {
    lines.push({
      type: "deletion",
      content: oldLines[index],
      oldLineNumber: index + 1,
    });
  }
  for (let index = prefix; index < newEnd; index += 1) {
    lines.push({
      type: "addition",
      content: newLines[index],
      newLineNumber: index + 1,
    });
  }
  for (let offset = 0; offset < contextEndOld - oldEnd; offset += 1) {
    const oldIndex = oldEnd + offset;
    const newIndex = newEnd + offset;
    if (newIndex >= contextEndNew) break;
    lines.push({
      type: "context",
      content: oldLines[oldIndex],
      oldLineNumber: oldIndex + 1,
      newLineNumber: newIndex + 1,
    });
  }
  const oldCount = contextEndOld - contextStart;
  const newCount = contextEndNew - contextStart;
  return {
    index: 0,
    oldStart: contextStart + 1,
    oldLines: oldCount,
    newStart: contextStart + 1,
    newLines: newCount,
    header: `@@ -${contextStart + 1},${oldCount} +${contextStart + 1},${newCount} @@`,
    lines,
    decision: "pending",
  };
}

function toLines(content: string): string[] {
  return content ? content.split(/\r?\n/) : [];
}

async function resolveProjectPath(root: string, path: string): Promise<string> {
  const target = resolve(root, path);
  const pathToRoot = relative(root, target);
  if (
    !path.trim() ||
    pathToRoot.startsWith(`..${sep}`) ||
    pathToRoot === ".." ||
    isAbsolute(pathToRoot)
  ) {
    throw new Error("CHANGE_PATH_OUTSIDE_PROJECT");
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
      const details = await lstat(current);
      if (details.isSymbolicLink()) throw new Error("CHANGE_PATH_IS_SYMLINK");
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  }
}

function toProjectRelative(root: string, target: string): string {
  return relative(root, target).replaceAll("\\", "/") || ".";
}

function sanitizeReason(value?: string): string | undefined {
  const reason = value?.trim().replace(/\s+/g, " ").slice(0, 240);
  return reason || undefined;
}

function countHunkDecisions(file: ReviewFileChange): {
  accepted: number;
  rejected: number;
} {
  return file.hunks.reduce(
    (counts, hunk) => ({
      accepted: counts.accepted + (hunk.decision === "accepted" ? 1 : 0),
      rejected: counts.rejected + (hunk.decision === "rejected" ? 1 : 0),
    }),
    { accepted: 0, rejected: 0 }
  );
}

function toSessionChangeType(
  status: ReviewFileChange["status"]
): SessionChangedFile["changeType"] {
  if (status === "added") return "create";
  if (status === "deleted") return "delete";
  return "modify";
}

function getFileReviewStatus(
  file: Pick<
    SessionChangedFile,
    "acceptedHunks" | "rejectedHunks" | "totalHunks"
  >
): ChangeFileReviewStatus {
  if (
    file.totalHunks === 0 ||
    (file.acceptedHunks === 0 && file.rejectedHunks === 0)
  ) {
    return "pending";
  }
  if (file.acceptedHunks === file.totalHunks) return "accepted";
  if (file.rejectedHunks === file.totalHunks) return "rejected";
  return "mixed";
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let manager: ChangeManager | undefined;

export function getChangeManager(): ChangeManager {
  manager ??= new ChangeManager();
  return manager;
}
