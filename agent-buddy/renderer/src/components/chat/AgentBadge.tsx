import { Bot } from "lucide-react";
import { useTranslation } from "@i18n";

export function AgentBadge({ name }: { name?: string }) {
  const { t } = useTranslation();
  const label = name || t("chat.agent");

  return (
    <div className="mt-1 flex w-9 shrink-0 flex-col items-center gap-1">
      <span
        title={label}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-500/10 text-primary-500"
      >
        <Bot size={14} />
      </span>
      <span className="w-full truncate text-center text-[10px] text-content-subtle">
        {label}
      </span>
    </div>
  );
}
