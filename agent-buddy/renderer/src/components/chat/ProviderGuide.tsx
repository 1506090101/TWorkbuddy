import { Bot, Settings2 } from "lucide-react";
import { Button, EmptyState } from "@components/common";
import { useTranslation } from "@i18n";
import { useUIStore } from "@stores/uiStore";

export function ProviderGuide() {
  const { t } = useTranslation();
  const openSettings = useUIStore((state) => state.openSettings);

  return (
    <EmptyState
      className="h-full"
      icon={<Bot size={24} />}
      title={t("agentGuide.title")}
      description={t("agentGuide.description")}
      action={
        <Button
          type="button"
          size="sm"
          variant="primary"
          icon={<Settings2 size={14} />}
          onClick={() => openSettings("providers")}
        >
          {t("agentGuide.openSettings")}
        </Button>
      }
    />
  );
}
