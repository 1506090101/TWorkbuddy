import { useEffect, useMemo, useState } from "react";
import { Coins, RefreshCw, Save, Trash2 } from "lucide-react";
import type {
  ModelPricingEntry,
  MonthlyUsageBudget,
  ProviderConfig,
  UsageReport,
} from "@shared/types";
import { Button, IconButton } from "@components/common";

interface ModelChoice {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
}

export function UsageSettingsPanel() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [pricing, setPricing] = useState<ModelPricingEntry[]>([]);
  const [budget, setBudget] = useState<MonthlyUsageBudget>();
  const [report, setReport] = useState<UsageReport>();
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const choices = useMemo<ModelChoice[]>(
    () =>
      providers.flatMap((provider) =>
        provider.models.map((model) => ({
          providerId: provider.id,
          providerName: provider.name,
          modelId: model.id,
          modelName: model.name || model.id,
        }))
      ),
    [providers]
  );
  const providerChoices = useMemo(
    () => providers.filter((provider) => provider.models.length > 0),
    [providers]
  );
  const modelChoices = choices.filter((item) => item.providerId === providerId);

  const load = async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [nextProviders, nextPricing, nextBudget, nextReport] =
        await Promise.all([
          window.electronAPI.listProviders(),
          window.electronAPI.listModelPricing(),
          window.electronAPI.getMonthlyUsageBudget(),
          window.electronAPI.getUsageReport({
            groupBy: "provider",
            from: Date.now() - 30 * 24 * 60 * 60 * 1000,
          }),
        ]);
      setProviders(nextProviders);
      setPricing(nextPricing);
      setBudget(nextBudget);
      setReport(nextReport);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取用量设置失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (providerChoices.length === 0) return;
    const provider = providerChoices.find((item) => item.id === providerId);
    if (!provider) {
      setProviderId(providerChoices[0].id);
      setModelId(providerChoices[0].models[0].id);
      return;
    }
    if (!provider.models.some((model) => model.id === modelId)) {
      setModelId(provider.models[0].id);
    }
  }, [modelId, providerChoices, providerId]);

  useEffect(() => {
    const current = pricing.find(
      (entry) => entry.providerId === providerId && entry.modelId === modelId
    );
    setInputPrice(current ? String(current.inputUsdPerMillion) : "");
    setOutputPrice(current ? String(current.outputUsdPerMillion) : "");
  }, [modelId, pricing, providerId]);

  const savePricing = async () => {
    const inputUsdPerMillion = Number(inputPrice);
    const outputUsdPerMillion = Number(outputPrice);
    if (
      !providerId ||
      !modelId ||
      !inputPrice.trim() ||
      !outputPrice.trim() ||
      !Number.isFinite(inputUsdPerMillion) ||
      !Number.isFinite(outputUsdPerMillion) ||
      inputUsdPerMillion < 0 ||
      outputUsdPerMillion < 0
    ) {
      setError("请输入有效的非负定价");
      return;
    }
    setIsSaving(true);
    setError(undefined);
    try {
      await window.electronAPI.setModelPricing(providerId, modelId, {
        inputUsdPerMillion,
        outputUsdPerMillion,
      });
      setPricing(await window.electronAPI.listModelPricing());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存模型定价失败");
    } finally {
      setIsSaving(false);
    }
  };

  const clearPricing = async (entry?: ModelPricingEntry) => {
    const nextProviderId = entry?.providerId ?? providerId;
    const nextModelId = entry?.modelId ?? modelId;
    if (!nextProviderId || !nextModelId) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await window.electronAPI.setModelPricing(
        nextProviderId,
        nextModelId,
        undefined
      );
      setPricing(await window.electronAPI.listModelPricing());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "清除模型定价失败");
    } finally {
      setIsSaving(false);
    }
  };

  const saveBudget = async () => {
    if (!budget) return;
    setIsSaving(true);
    setError(undefined);
    try {
      setBudget(await window.electronAPI.updateMonthlyUsageBudget(budget));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存月度预算失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Coins size={15} className="text-primary-500" />
            <h3 className="text-sm font-semibold text-content">用量与定价</h3>
          </div>
          {report && (
            <p className="mt-1 text-xs text-content-muted">
              近 30 天 {formatTokens(report.totalTokens)} tokens ·{" "}
              {report.pricedRequests > 0
                ? formatUsd(report.totalCostUsd)
                : "未定价"}
            </p>
          )}
        </div>
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          icon={
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          }
          tooltip="刷新用量设置"
          aria-label="刷新用量设置"
          disabled={isLoading || isSaving}
          onClick={() => void load()}
        />
      </div>

      {error && <p className="mt-3 text-xs text-danger-600">{error}</p>}

      <section className="mt-5 border-t border-border pt-4">
        <h4 className="text-xs font-semibold text-content">月度预算</h4>
        {budget && (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <label className="block text-xs text-content-muted">
              美元上限
              <input
                type="number"
                min="0.0001"
                step="0.01"
                value={budget.monthlyLimitUsd}
                onChange={(event) =>
                  setBudget((current) =>
                    current
                      ? {
                          ...current,
                          monthlyLimitUsd: Number(event.target.value),
                        }
                      : current
                  )
                }
                className="mt-1.5 h-8 w-full border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
              />
            </label>
            <Button
              type="button"
              size="sm"
              icon={<Save size={13} />}
              loading={isSaving}
              onClick={() => void saveBudget()}
            >
              保存
            </Button>
            <label className="col-span-2 block text-xs text-content-muted">
              预警阈值 {Math.round(budget.alertThreshold * 100)}%
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={Math.round(budget.alertThreshold * 100)}
                onChange={(event) =>
                  setBudget((current) =>
                    current
                      ? {
                          ...current,
                          alertThreshold: Number(event.target.value) / 100,
                        }
                      : current
                  )
                }
                className="mt-2 w-full accent-primary-500"
              />
            </label>
          </div>
        )}
      </section>

      <section className="mt-5 border-t border-border pt-4">
        <h4 className="text-xs font-semibold text-content">模型定价</h4>
        {providerChoices.length === 0 ? (
          <p className="mt-2 text-xs leading-5 text-content-muted">
            先在 Provider 设置中添加包含模型的 Provider。
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-content-muted">
              Provider
              <select
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
                className="mt-1.5 h-8 w-full border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
              >
                {providerChoices.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-content-muted">
              模型
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                className="mt-1.5 h-8 w-full border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
              >
                {modelChoices.map((model) => (
                  <option key={model.modelId} value={model.modelId}>
                    {model.modelName}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <PriceInput
                label="输入 / 百万"
                value={inputPrice}
                onChange={setInputPrice}
              />
              <PriceInput
                label="输出 / 百万"
                value={outputPrice}
                onChange={setOutputPrice}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                icon={<Save size={13} />}
                loading={isSaving}
                onClick={() => void savePricing()}
              >
                保存定价
              </Button>
              {pricing.some(
                (entry) =>
                  entry.providerId === providerId && entry.modelId === modelId
              ) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={13} />}
                  disabled={isSaving}
                  onClick={() => void clearPricing()}
                >
                  清除
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      {pricing.length > 0 && (
        <section className="mt-5 border-t border-border pt-4">
          <h4 className="text-xs font-semibold text-content">已配置定价</h4>
          <div className="mt-2 divide-y divide-border border-y border-border">
            {pricing.map((entry) => (
              <div
                key={`${entry.providerId}:${entry.modelId}`}
                className="flex items-center gap-3 px-1 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-content">
                    {getProviderName(providers, entry.providerId)} ·{" "}
                    {entry.modelId}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-content-subtle">
                    输入 {formatUsd(entry.inputUsdPerMillion)} / 输出{" "}
                    {formatUsd(entry.outputUsdPerMillion)}
                  </span>
                </span>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={13} />}
                  tooltip="清除模型定价"
                  aria-label={`清除 ${entry.modelId} 定价`}
                  disabled={isSaving}
                  onClick={() => void clearPricing(entry)}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-content-muted">
      {label}
      <input
        type="number"
        min="0"
        step="0.0001"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="USD"
        className="mt-1.5 h-8 w-full border border-border bg-surface px-2 text-xs text-content outline-none focus:border-primary-400"
      />
    </label>
  );
}

function getProviderName(
  providers: ProviderConfig[],
  providerId: string
): string {
  return (
    providers.find((provider) => provider.id === providerId)?.name ?? providerId
  );
}

function formatTokens(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : String(value);
}

function formatUsd(value: number): string {
  return value >= 0.01 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}
