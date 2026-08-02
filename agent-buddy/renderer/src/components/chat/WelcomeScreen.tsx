/**
 * F0.3: Foundation welcome screen retained for future empty-workspace views.
 * The active chat workspace is implemented in ChatView.
 */
import { MessageSquare, Sparkles, Settings, BookOpen } from "lucide-react";
import { useUIStore } from "@stores/uiStore";
import { useTranslation } from "@i18n";

export function WelcomeScreen() {
  const { t } = useTranslation();
  const openSettings = useUIStore((s) => s.openSettings);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 overflow-y-auto">
      <div className="max-w-2xl w-full text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-500 flex items-center justify-center shadow-glow">
            <Sparkles size={32} className="text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-content mb-2">
          {t("welcome.title")}
        </h1>
        <p className="text-content-muted text-base mb-8">
          {t("welcome.subtitle")}
        </p>

        {/* Quick action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <ActionCard
            icon={<MessageSquare size={20} />}
            title={t("welcome.startChatting")}
            description={t("welcome.startChattingDesc")}
            onClick={() => openSettings("providers")}
          />
          <ActionCard
            icon={<Settings size={20} />}
            title={t("welcome.settings")}
            description={t("welcome.settingsDesc")}
            onClick={() => openSettings("appearance")}
          />
          <ActionCard
            icon={<BookOpen size={20} />}
            title={t("welcome.knowledge")}
            description={t("welcome.knowledgeDesc")}
            onClick={() => useUIStore.getState().setActiveView("knowledge")}
          />
        </div>

        {/* Feature highlights */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {[
            t("welcome.featureMultiProvider"),
            t("welcome.featureVisionModel"),
            t("welcome.featureMcpTools"),
            t("welcome.featureCodeGraph"),
            t("welcome.featureGit"),
            t("welcome.featureWorkflows"),
          ].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-xs rounded-full bg-surface-subtle text-content-muted border border-border"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-3 p-5 rounded-xl border border-border bg-surface hover:bg-surface-hover hover:border-primary-300 transition-all duration-200 ease-out-expo text-center"
    >
      <div className="w-10 h-10 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-200 ease-out-expo">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-content mb-1">{title}</h3>
        <p className="text-xs text-content-muted">{description}</p>
      </div>
    </button>
  );
}
