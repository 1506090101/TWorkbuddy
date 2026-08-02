import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { Button, EmptyState, Switch } from "@components/common";
import { useTranslation } from "@i18n";
import { useProviderStore } from "@stores/providerStore";
import { useUIStore } from "@stores/uiStore";
import type {
  ModelAssignment,
  ModelRef,
  ProviderConfig,
  ThinkingLevel,
} from "@shared/types";

const DEFAULT_AGENT_ID = "default";
const THINKING_LEVELS: Array<{
  value: ThinkingLevel;
  labelKey: "off" | "low" | "medium" | "high";
}> = [
  { value: "off", labelKey: "off" },
  { value: "low", labelKey: "low" },
  { value: "medium", labelKey: "medium" },
  { value: "high", labelKey: "high" },
];

export function ModelAssignmentPanel() {
  const { t } = useTranslation();
  const providers = useProviderStore((state) => state.providers);
  const loadProviders = useProviderStore((state) => state.loadProviders);
  const openSettings = useUIStore((state) => state.openSettings);
  const [assignments, setAssignments] = useState<
    Record<string, ModelAssignment>
  >({});
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT_ID);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void loadProviders();
    void window.electronAPI.getModelAssignments().then(setAssignments);
  }, [loadProviders]);

  const agentIds = useMemo(
    () => Array.from(new Set([DEFAULT_AGENT_ID, ...Object.keys(assignments)])),
    [assignments]
  );
  const current = assignments[selectedAgentId] ?? defaultAssignment(providers);
  const availableProviders = providers.filter(
    (provider) => provider.status !== "error"
  );
  const selectedChatProvider = findProvider(providers, current.chat.providerId);
  const selectedVisionProvider = findProvider(
    providers,
    current.vision?.providerId
  );

  const updateAssignment = (changes: Partial<ModelAssignment>) => {
    setAssignments((previous) => ({
      ...previous,
      [selectedAgentId]: { ...current, ...changes },
    }));
    setIsDirty(true);
    setFeedback(null);
  };

  const updateModel = (target: "chat" | "vision", value: Partial<ModelRef>) => {
    if (target === "chat") {
      updateAssignment({ chat: { ...current.chat, ...value } });
      return;
    }
    updateAssignment({
      vision: {
        providerId: current.vision?.providerId ?? "",
        modelId: current.vision?.modelId ?? "",
        ...value,
      },
    });
  };

  const save = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await window.electronAPI.saveModelAssignment(
        selectedAgentId,
        current
      );
      setAssignments((previous) => ({ ...previous, [selectedAgentId]: saved }));
      setIsDirty(false);
      setFeedback(t("models.saved"));
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : t("models.saveError")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const reset = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const resetAssignment =
        await window.electronAPI.resetModelAssignment(selectedAgentId);
      setAssignments((previous) => ({
        ...previous,
        [selectedAgentId]: resetAssignment,
      }));
      setIsDirty(false);
      setFeedback(t("models.reset"));
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : t("models.saveError")
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (providers.length === 0) {
    return (
      <EmptyState
        className="h-full"
        icon={<SlidersHorizontal size={24} />}
        title={t("models.noProvidersTitle")}
        description={t("models.noProvidersDescription")}
        action={
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => openSettings("providers")}
          >
            {t("models.openProviders")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-content">
            {t("models.title")}
          </h3>
          <p className="mt-1 text-xs text-content-muted">{t("models.desc")}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-subtle">
            {t("models.agent")}
          </p>
          <div className="flex flex-wrap gap-1 border-b border-border">
            {agentIds.map((agentId) => (
              <button
                key={agentId}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agentId);
                  setIsDirty(false);
                  setFeedback(null);
                }}
                className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                  selectedAgentId === agentId
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-content-muted hover:text-content"
                }`}
              >
                {agentId === DEFAULT_AGENT_ID
                  ? t("models.defaultAgent")
                  : agentId}
              </button>
            ))}
          </div>
        </div>

        <ModelSection
          title={t("models.chatModel")}
          provider={selectedChatProvider}
          providerId={current.chat.providerId}
          modelId={current.chat.modelId}
          providers={availableProviders}
          onProviderChange={(providerId) =>
            updateModel("chat", { providerId, modelId: "" })
          }
          onModelChange={(modelId) => updateModel("chat", { modelId })}
          providerLabel={t("models.provider")}
          modelLabel={t("models.model")}
          providerPlaceholder={t("models.chooseProvider")}
          modelPlaceholder={t("models.chooseModel")}
        />

        <section className="border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-content">
                {t("models.visionModel")}
              </h4>
              <p className="mt-1 text-xs text-content-muted">
                {t("models.visionDescription")}
              </p>
            </div>
            <Switch
              checked={Boolean(current.vision)}
              onCheckedChange={(enabled) =>
                updateAssignment(
                  enabled
                    ? { vision: { providerId: "", modelId: "" } }
                    : { vision: undefined }
                )
              }
              size="sm"
              aria-label={t("models.enableVision")}
            />
          </div>
          {current.vision ? (
            <div className="mt-4">
              <ModelSection
                provider={selectedVisionProvider}
                providerId={current.vision.providerId}
                modelId={current.vision.modelId}
                providers={availableProviders}
                onProviderChange={(providerId) =>
                  updateModel("vision", { providerId, modelId: "" })
                }
                onModelChange={(modelId) => updateModel("vision", { modelId })}
                providerLabel={t("models.provider")}
                modelLabel={t("models.model")}
                providerPlaceholder={t("models.chooseProvider")}
                modelPlaceholder={t("models.chooseModel")}
              />
            </div>
          ) : (
            <p className="mt-4 text-xs text-content-subtle">
              {current.fallbackToChatForImages
                ? t("models.visionFallbackHint")
                : t("models.visionRequiredHint")}
            </p>
          )}
        </section>

        <section className="border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-content">
            {t("models.behavior")}
          </h4>
          <div className="mt-3 divide-y divide-border border-y border-border">
            <SettingRow
              label={t("models.autoSwitch")}
              description={t("models.autoSwitchDescription")}
              checked={current.autoSwitchOnImage}
              onChange={(checked) =>
                updateAssignment({ autoSwitchOnImage: checked })
              }
            />
            <SettingRow
              label={t("models.fallback")}
              description={t("models.fallbackDescription")}
              checked={current.fallbackToChatForImages}
              onChange={(checked) =>
                updateAssignment({ fallbackToChatForImages: checked })
              }
            />
            <SettingRow
              label={t("models.retry")}
              description={t("models.retryDescription")}
              checked={current.retryOnProviderError}
              onChange={(checked) =>
                updateAssignment({ retryOnProviderError: checked })
              }
            />
          </div>
        </section>

        <section className="border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-content">
            {t("models.thinking")}
          </h4>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {THINKING_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => updateAssignment({ thinkingLevel: level.value })}
                className={`border px-2 py-2 text-center text-xs transition-colors ${
                  current.thinkingLevel === level.value
                    ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400"
                    : "border-border text-content-muted hover:border-primary-300 hover:text-content"
                }`}
              >
                {t(`models.thinking.${level.labelKey}`)}
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-2 border-t border-border pt-4">
          {feedback && (
            <span className="inline-flex items-center gap-1 text-xs text-success-600 dark:text-success-400">
              <Check size={14} /> {feedback}
            </span>
          )}
          <div className="min-w-0 flex-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={14} />}
            loading={isSaving}
            onClick={() => void reset()}
          >
            {t("models.resetButton")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={<Save size={14} />}
            loading={isSaving}
            disabled={
              !isDirty || !current.chat.providerId || !current.chat.modelId
            }
            onClick={() => void save()}
          >
            {t("models.saveButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModelSection({
  title,
  provider,
  providerId,
  modelId,
  providers,
  onProviderChange,
  onModelChange,
  providerLabel,
  modelLabel,
  providerPlaceholder,
  modelPlaceholder,
}: {
  title?: string;
  provider?: ProviderConfig;
  providerId: string;
  modelId: string;
  providers: ProviderConfig[];
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  providerLabel: string;
  modelLabel: string;
  providerPlaceholder: string;
  modelPlaceholder: string;
}) {
  return (
    <section className={title ? "" : undefined}>
      {title && <h4 className="text-sm font-semibold text-content">{title}</h4>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-content-muted">
            {providerLabel}
          </span>
          <select
            value={providerId}
            onChange={(event) => onProviderChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-content outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-400"
          >
            <option value="">{providerPlaceholder}</option>
            {providers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.type}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-content-muted">
            {modelLabel}
          </span>
          <select
            value={modelId}
            disabled={!providerId || !provider}
            onChange={(event) => onModelChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-content outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{modelPlaceholder}</option>
            {provider?.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name || model.id}
                {model.contextWindow
                  ? ` · ${Math.round(model.contextWindow / 1000)}K`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-content">{label}</p>
        <p className="mt-0.5 text-xs text-content-subtle">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} size="sm" />
    </div>
  );
}

function defaultAssignment(providers: ProviderConfig[]): ModelAssignment {
  const provider = providers.find((item) => item.status !== "error");
  const model = provider?.models[0];
  return {
    chat: {
      providerId: provider?.id ?? "",
      modelId: model?.id ?? "",
    },
    vision: undefined,
    thinkingLevel: "off",
    autoSwitchOnImage: true,
    fallbackToChatForImages: false,
    retryOnProviderError: true,
  };
}

function findProvider(
  providers: ProviderConfig[],
  providerId?: string
): ProviderConfig | undefined {
  return providers.find((provider) => provider.id === providerId);
}
