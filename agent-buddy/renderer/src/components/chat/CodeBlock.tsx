import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "@components/common";
import { useTranslation } from "@i18n";

export function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="group my-3 overflow-hidden rounded-md border border-border bg-surface-subtle text-content">
      <div className="flex h-8 items-center justify-between border-b border-border bg-surface-muted px-3">
        <span className="font-code text-[11px] text-content-subtle">
          {language || "text"}
        </span>
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          icon={copied ? <Check size={13} /> : <Copy size={13} />}
          tooltip={copied ? t("chat.copied") : t("chat.copyCode")}
          aria-label={copied ? t("chat.copied") : t("chat.copyCode")}
          onClick={() => void copy()}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        />
      </div>
      <pre className="selectable max-h-80 overflow-auto p-3 font-code text-xs leading-6">
        <code>{code}</code>
      </pre>
    </div>
  );
}
