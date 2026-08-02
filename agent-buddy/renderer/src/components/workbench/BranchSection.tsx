import { useEffect, useState } from "react";
import { GitBranch, Merge, Save, Trash2 } from "lucide-react";
import type { WorkSession } from "@shared/types";
import { Button, Textarea } from "@components/common";
import { useWorkSessionStore } from "@stores/workSessionStore";

export function BranchSection({ session }: { session: WorkSession }) {
  const sessions = useWorkSessionStore((state) => state.sessions);
  const updateBranchSummary = useWorkSessionStore(
    (state) => state.updateBranchSummary
  );
  const mergeBranch = useWorkSessionStore((state) => state.mergeBranch);
  const discardBranch = useWorkSessionStore((state) => state.discardBranch);
  const [summary, setSummary] = useState(session.branch?.contextSummary ?? "");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(session.branch?.contextSummary ?? "");
    setError(null);
  }, [session.branch?.contextSummary, session.id]);

  if (!session.branch) return null;

  const parent = sessions.find(
    (item) => item.id === session.branch?.parentSessionId
  );
  const isPending = session.branch.mergeStatus === "pending";
  const save = async () => {
    setIsWorking(true);
    setError(null);
    try {
      await updateBranchSummary(summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存分支摘要失败");
    } finally {
      setIsWorking(false);
    }
  };
  const merge = async () => {
    setIsWorking(true);
    setError(null);
    try {
      await mergeBranch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "合并分支失败");
    } finally {
      setIsWorking(false);
    }
  };
  const discard = async () => {
    if (!window.confirm("丢弃该分支任务？此操作会归档分支及其工作记录。")) {
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      await discardBranch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "丢弃分支失败");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className="border-b border-border pb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-accent-500" />
          <h2 className="text-xs font-semibold text-content">任务分支</h2>
        </div>
        <BranchStatus status={session.branch.mergeStatus} />
      </div>
      <p className="mt-2 text-xs leading-5 text-content-muted">
        来源：{parent?.title ?? "原任务"}
      </p>
      <Textarea
        aria-label="分支上下文摘要"
        className="mt-3 min-h-28 text-xs leading-5"
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        disabled={!isPending || isWorking}
        maxLength={4000}
      />
      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}
      {isPending && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            icon={<Save size={13} />}
            disabled={isWorking || !summary.trim()}
            onClick={() => void save()}
          >
            保存摘要
          </Button>
          <Button
            type="button"
            size="sm"
            variant="success"
            icon={<Merge size={13} />}
            loading={isWorking}
            onClick={() => void merge()}
          >
            合并结果
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            icon={<Trash2 size={13} />}
            disabled={isWorking}
            onClick={() => void discard()}
          >
            丢弃分支
          </Button>
        </div>
      )}
    </section>
  );
}

function BranchStatus({
  status,
}: {
  status: NonNullable<WorkSession["branch"]>["mergeStatus"];
}) {
  const labels = {
    pending: "待合并",
    merged: "已合并",
    discarded: "已丢弃",
  };
  const colors = {
    pending: "text-warning-600",
    merged: "text-success-600",
    discarded: "text-content-subtle",
  };
  return (
    <span className={`text-[11px] ${colors[status]}`}>{labels[status]}</span>
  );
}
