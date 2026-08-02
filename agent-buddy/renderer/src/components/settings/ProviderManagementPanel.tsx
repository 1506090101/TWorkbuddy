import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Search,
  Server,
  Trash2,
  Wifi,
} from "lucide-react";
import {
  Button,
  EmptyState,
  IconButton,
  Input,
  Spinner,
  Tooltip,
} from "@components/common";
import { useTranslation } from "@i18n";
import { useProviderStore } from "@stores/providerStore";
import { cn } from "@utils/cn";
import type {
  ModelInfo,
  ProviderConfig,
  ProviderConnectionResult,
  ProviderType,
} from "@shared/types";
import { ModelListEditor } from "./ModelListEditor";

interface ProviderFormData {
  id?: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseURL: string;
  models: ModelInfo[];
}

type FormMode = "idle" | "create" | "edit";

const providerTypes: Array<{ value: ProviderType; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "gemini", label: "Google Gemini" },
  { value: "mistral", label: "Mistral AI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom (OpenAI Compatible)" },
];

const baseURLPlaceholders: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  mistral: "https://api.mistral.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "https://api.example.com/v1",
};

function emptyForm(): ProviderFormData {
  return {
    name: "",
    type: "openai",
    apiKey: "",
    baseURL: "",
    models: [],
  };
}

function toForm(provider: ProviderConfig): ProviderFormData {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    apiKey: "",
    baseURL: provider.baseURL ?? "",
    models: provider.models.map((model) => ({ ...model })),
  };
}

export function ProviderManagementPanel() {
  const { t } = useTranslation();
  const providers = useProviderStore((state) => state.providers);
  const isLoading = useProviderStore((state) => state.isLoading);
  const storeError = useProviderStore((state) => state.error);
  const loadProviders = useProviderStore((state) => state.loadProviders);
  const createProvider = useProviderStore((state) => state.createProvider);
  const updateProvider = useProviderStore((state) => state.updateProvider);
  const deleteProvider = useProviderStore((state) => state.deleteProvider);
  const detectModels = useProviderStore((state) => state.detectModels);
  const testProvider = useProviderStore((state) => state.testProvider);

  const [mode, setMode] = useState<FormMode>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showAPIKey, setShowAPIKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionResult, setConnectionResult] =
    useState<ProviderConnectionResult | null>(null);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const startCreating = () => {
    if (!confirmDiscard()) return;
    setMode("create");
    setSelectedId(null);
    setForm(emptyForm());
    setErrors({});
    setIsDirty(false);
    setConnectionResult(null);
  };

  const selectProvider = (provider: ProviderConfig) => {
    if (provider.id === selectedId || !confirmDiscard()) return;
    setMode("edit");
    setSelectedId(provider.id);
    setForm(toForm(provider));
    setErrors({});
    setIsDirty(false);
    setConnectionResult(null);
  };

  const updateForm = <Key extends keyof ProviderFormData>(
    key: Key,
    value: ProviderFormData[Key]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setIsDirty(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = t("providers.validation.name");
    if (mode === "create" && !form.apiKey.trim()) {
      nextErrors.apiKey = t("providers.validation.apiKey");
    }
    if (form.type === "custom" && !form.baseURL.trim()) {
      nextErrors.baseURL = t("providers.validation.baseURL");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setIsSaving(true);
    setConnectionResult(null);

    try {
      const input = {
        name: form.name,
        type: form.type,
        apiKey: form.apiKey,
        baseURL: form.baseURL,
        models: form.models,
      };
      const provider =
        mode === "create"
          ? await createProvider(input)
          : await updateProvider(form.id!, input);
      setMode("edit");
      setSelectedId(provider.id);
      setForm(toForm(provider));
      setIsDirty(false);
    } catch {
      // The store exposes a user-facing error in the panel.
    } finally {
      setIsSaving(false);
    }
  };

  const detect = async () => {
    if (!selectedId) return;
    setIsDetecting(true);
    setConnectionResult(null);
    try {
      const models = await detectModels(selectedId);
      updateForm("models", models);
    } catch {
      // The store exposes a user-facing error in the panel.
    } finally {
      setIsDetecting(false);
    }
  };

  const test = async () => {
    if (!selectedId) return;
    setIsTesting(true);
    setConnectionResult(null);
    try {
      setConnectionResult(await testProvider(selectedId));
    } catch {
      // The store exposes a user-facing error in the panel.
    } finally {
      setIsTesting(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    const confirmed = window.confirm(
      t("providers.deleteConfirm", { name: form.name })
    );
    if (!confirmed) return;

    try {
      await deleteProvider(selectedId);
      setMode("idle");
      setSelectedId(null);
      setForm(emptyForm());
      setIsDirty(false);
      setConnectionResult(null);
    } catch {
      // The store exposes a user-facing error in the panel.
    }
  };

  function confirmDiscard(): boolean {
    return !isDirty || window.confirm(t("providers.discardChanges"));
  }

  const showEditor = mode !== "idle";

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface-muted">
        <div className="p-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            className="w-full"
            onClick={startCreating}
          >
            {t("providers.add")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : providers.length === 0 ? (
            <EmptyState
              className="px-3 py-8"
              icon={<Server size={20} />}
              title={t("providers.empty.title")}
              description={t("providers.empty.description")}
            />
          ) : (
            <div className="space-y-1">
              {providers.map((provider) => (
                <ProviderListItem
                  key={provider.id}
                  provider={provider}
                  selected={provider.id === selectedId}
                  onSelect={() => selectProvider(provider)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        {!showEditor ? (
          <EmptyState
            className="h-full"
            icon={<KeyRound size={24} />}
            title={t("providers.editor.emptyTitle")}
            description={t("providers.editor.emptyDescription")}
            action={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<Plus size={14} />}
                onClick={startCreating}
              >
                {t("providers.add")}
              </Button>
            }
          />
        ) : (
          <div className="mx-auto max-w-2xl space-y-5 px-6 py-5">
            <div>
              <h3 className="text-sm font-semibold text-content">
                {mode === "create"
                  ? t("providers.editor.createTitle")
                  : t("providers.editor.editTitle")}
              </h3>
              <p className="mt-1 text-xs text-content-muted">
                {t("providers.editor.description")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t("providers.type")}>
                <select
                  value={form.type}
                  onChange={(event) =>
                    updateForm("type", event.target.value as ProviderType)
                  }
                  className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-content outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-400"
                >
                  {providerTypes.map((providerType) => (
                    <option key={providerType.value} value={providerType.value}>
                      {providerType.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("providers.name")} required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder={t("providers.namePlaceholder")}
                  error={errors.name}
                />
              </Field>
            </div>

            <Field
              label={t("providers.apiKey")}
              required={mode === "create"}
              hint={
                mode === "edit"
                  ? t("providers.apiKeyEditHint")
                  : t("providers.apiKeyHint")
              }
              error={errors.apiKey}
            >
              <div className="relative">
                <Input
                  type={showAPIKey ? "text" : "password"}
                  value={form.apiKey}
                  onChange={(event) => updateForm("apiKey", event.target.value)}
                  placeholder={mode === "edit" ? "••••••••" : "sk-..."}
                  className="pr-10"
                  error={errors.apiKey}
                  autoComplete="off"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={showAPIKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    tooltip={
                      showAPIKey
                        ? t("providers.hideAPIKey")
                        : t("providers.showAPIKey")
                    }
                    aria-label={
                      showAPIKey
                        ? t("providers.hideAPIKey")
                        : t("providers.showAPIKey")
                    }
                    onClick={() => setShowAPIKey((visible) => !visible)}
                  />
                </div>
              </div>
            </Field>

            <Field
              label={t("providers.baseURL")}
              required={form.type === "custom"}
              hint={
                form.type === "custom"
                  ? t("providers.baseURLCustomHint")
                  : t("providers.baseURLHint")
              }
              error={errors.baseURL}
            >
              <Input
                type="url"
                value={form.baseURL}
                onChange={(event) => updateForm("baseURL", event.target.value)}
                placeholder={baseURLPlaceholders[form.type]}
                error={errors.baseURL}
              />
            </Field>

            <Field
              label={t("providers.models")}
              hint={t("providers.modelsHint")}
            >
              <ModelListEditor
                models={form.models}
                onChange={(models) => updateForm("models", models)}
                addLabel={t("providers.addModel")}
                idLabel={t("providers.modelId")}
                contextLabel={t("providers.contextWindow")}
                visionLabel={t("providers.vision")}
                removeLabel={t("providers.removeModel")}
              />
            </Field>

            {storeError && <StatusMessage tone="error" message={storeError} />}
            {connectionResult && (
              <StatusMessage
                tone={connectionResult.success ? "success" : "error"}
                message={connectionResult.message}
              />
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<Search size={14} />}
                loading={isDetecting}
                disabled={mode !== "edit" || isTesting}
                onClick={detect}
              >
                {t("providers.detect")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<Wifi size={14} />}
                loading={isTesting}
                disabled={mode !== "edit" || isDetecting}
                onClick={test}
              >
                {t("providers.test")}
              </Button>
              <div className="min-w-0 flex-1" />
              {mode === "edit" && (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={14} />}
                  disabled={isSaving}
                  onClick={remove}
                >
                  {t("providers.delete")}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={isSaving}
                disabled={!isDirty}
                onClick={save}
              >
                {mode === "create"
                  ? t("providers.create")
                  : t("providers.save")}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ProviderListItem({
  provider,
  selected,
  onSelect,
}: {
  provider: ProviderConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const statusConfig = {
    connected: {
      label: t("providers.status.connected"),
      dotClass: "bg-success-500",
    },
    untested: {
      label: t("providers.status.untested"),
      dotClass: "bg-warning-500",
    },
    error: {
      label: t("providers.status.error"),
      dotClass: "bg-danger-500",
    },
  }[provider.status];
  const tooltip = provider.statusMessage
    ? `${statusConfig.label}：${provider.statusMessage}`
    : statusConfig.label;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
        selected
          ? "bg-primary-500/10 text-primary-700 dark:text-primary-300"
          : "text-content-muted hover:bg-surface-hover hover:text-content"
      )}
    >
      <span className="text-content-subtle">
        {provider.type === "custom" ? <Server size={15} /> : <Bot size={15} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {provider.name}
      </span>
      <Tooltip content={tooltip} placement="left">
        <span
          className={cn("h-2 w-2 rounded-full", statusConfig.dotClass)}
          aria-label={tooltip}
        />
      </Tooltip>
    </button>
  );
}

function Field({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1">
        <span className="text-sm font-medium text-content">{label}</span>
        {required && <span className="text-danger-500">*</span>}
      </div>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-content-subtle">{hint}</p>
      )}
    </div>
  );
}

function StatusMessage({
  tone,
  message,
}: {
  tone: "success" | "error";
  message: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : CircleAlert;
  return (
    <div
      className={cn(
        "flex items-start gap-2 border px-3 py-2 text-xs",
        tone === "success"
          ? "border-success-500/30 bg-success-500/10 text-success-700 dark:text-success-400"
          : "border-danger-500/30 bg-danger-500/10 text-danger-700 dark:text-danger-400"
      )}
      role="status"
    >
      <Icon size={15} className="mt-0.5 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  );
}
