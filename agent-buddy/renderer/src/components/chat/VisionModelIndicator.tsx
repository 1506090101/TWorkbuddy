import { AlertTriangle, Eye, Settings2 } from "lucide-react";
import { IconButton } from "@components/common";
import { useTranslation } from "@i18n";
import { useUIStore } from "@stores/uiStore";
import type { RoutingDecision } from "@shared/types";

export function VisionModelIndicator({
  hasImages,
  decision,
  error,
}: {
  hasImages: boolean;
  decision: RoutingDecision | null;
  error: string | null;
}) {
  const { t } = useTranslation();
  const openSettings = useUIStore((state) => state.openSettings);

  if (!hasImages) return null;
  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-danger-600 dark:text-danger-400">
        <AlertTriangle size={13} />
        <span>{t("vision.error")}</span>
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={() => openSettings("models")}
        >
          {t("vision.openSettings")}
        </button>
      </div>
    );
  }
  if (!decision) return null;

  const label =
    decision.useModel === "vision" ? t("vision.using") : t("vision.fallback");
  return (
    <div className="flex items-center gap-1.5 text-xs text-content-subtle">
      <Eye size={13} className="text-primary-500" />
      <span>
        {label}: {decision.modelAssignment.providerId}/
        {decision.modelAssignment.modelId}
      </span>
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        icon={<Settings2 size={12} />}
        tooltip={t("vision.openSettings")}
        aria-label={t("vision.openSettings")}
        onClick={() => openSettings("models")}
      />
    </div>
  );
}
