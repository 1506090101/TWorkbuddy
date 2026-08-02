import { ArrowDown } from "lucide-react";
import { IconButton } from "@components/common";
import { useTranslation } from "@i18n";

export function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="absolute bottom-5 right-6 z-10">
      <IconButton
        type="button"
        size="md"
        variant="default"
        icon={<ArrowDown size={16} />}
        tooltip={t("chat.scrollToBottom")}
        aria-label={t("chat.scrollToBottom")}
        onClick={onClick}
        className="rounded-full border border-border bg-surface shadow-md hover:bg-surface-hover"
      />
    </div>
  );
}
