import { useTranslation } from "@i18n";

export function ThinkingIndicator() {
  const { t } = useTranslation();

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-content-muted">
      <span>{t("chat.thinking")}</span>
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-content-subtle" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-content-subtle [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-content-subtle [animation-delay:240ms]" />
      </span>
    </span>
  );
}
