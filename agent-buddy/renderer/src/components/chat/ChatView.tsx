import { useRef, useState } from "react";
import { CircleStop, ImagePlus, Send, Sparkles, X } from "lucide-react";
import { Button, IconButton } from "@components/common";
import { useTranslation } from "@i18n";
import { useAgent } from "@hooks/useAgent";
import { useModelRouting } from "@hooks/useModelRouting";
import { useChatStore } from "@stores/chatStore";
import type { ImageAttachment } from "@shared/types";
import { ProviderGuide } from "./ProviderGuide";
import { VisionModelIndicator } from "./VisionModelIndicator";
import { MessageList } from "./MessageList";

export function ChatView() {
  const { t } = useTranslation();
  const { sendMessage, abort } = useAgent();
  const messages = useChatStore((state) => state.messages);
  const status = useChatStore((state) => state.status);
  const hasProvider = useChatStore((state) => state.hasProvider);
  const modelId = useChatStore((state) => state.modelId);
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRouting = useModelRouting(pendingImages.length > 0);
  const canSubmit =
    status !== "generating" &&
    (draft.trim().length > 0 || pendingImages.length > 0) &&
    !(pendingImages.length > 0 && imageRouting.error);

  if (!hasProvider) return <ProviderGuide />;

  const submit = () => {
    if (!canSubmit) return;
    void sendMessage(draft, pendingImages);
    setDraft("");
    setPendingImages([]);
  };

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const attachments = await Promise.all(
      Array.from(files).map((file) => fileToAttachment(file))
    );
    setPendingImages((current) => [...current, ...attachments]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-500/10 text-primary-500">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-content">
              {t("chat.title")}
            </h1>
            <p className="truncate text-[11px] text-content-subtle">
              {status === "generating"
                ? t("chat.status.generating")
                : modelId || t("chat.status.ready")}
            </p>
          </div>
        </div>
        <span
          className={`h-2 w-2 rounded-full ${
            status === "generating"
              ? "animate-pulse bg-primary-500"
              : "bg-success-500"
          }`}
          title={
            status === "generating"
              ? t("chat.status.generating")
              : t("chat.status.ready")
          }
        />
      </header>

      <MessageList messages={messages} />

      <div className="shrink-0 border-t border-border bg-surface px-6 py-4">
        {pendingImages.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
            {pendingImages.map((image) => (
              <div
                key={image.id}
                className="flex items-center gap-1.5 border border-border bg-surface-muted px-2 py-1 text-xs text-content-muted"
              >
                <img
                  src={`data:${image.mimeType};base64,${image.data}`}
                  alt={image.name}
                  className="h-6 w-6 rounded object-cover"
                />
                <span className="max-w-32 truncate">{image.name}</span>
                <button
                  type="button"
                  aria-label={t("chat.removeImage")}
                  onClick={() =>
                    setPendingImages((current) =>
                      current.filter((item) => item.id !== image.id)
                    )
                  }
                  className="text-content-subtle hover:text-content"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mx-auto mb-2 flex max-w-3xl items-center">
          <VisionModelIndicator
            hasImages={pendingImages.length > 0}
            decision={imageRouting.decision}
            error={imageRouting.error}
          />
        </div>
        <div className="mx-auto flex max-w-3xl items-end gap-2 border border-border bg-surface-muted p-2 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/20">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void addImages(event.target.files);
              event.target.value = "";
            }}
          />
          <IconButton
            type="button"
            size="md"
            variant="ghost"
            icon={<ImagePlus size={17} />}
            tooltip={t("chat.addImage")}
            aria-label={t("chat.addImage")}
            disabled={status === "generating"}
            onClick={() => fileInputRef.current?.click()}
          />
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            rows={1}
            className="selectable max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-content outline-none placeholder:text-content-subtle"
          />
          {status === "generating" ? (
            <IconButton
              type="button"
              size="md"
              variant="danger"
              icon={<CircleStop size={17} />}
              tooltip={t("chat.stop")}
              aria-label={t("chat.stop")}
              onClick={() => void abort()}
            />
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<Send size={14} />}
              disabled={!canSubmit}
              onClick={submit}
            >
              {t("chat.send")}
            </Button>
          )}
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-content-subtle">
          {t("chat.inputHint")}
        </p>
      </div>
    </div>
  );
}

async function fileToAttachment(file: File): Promise<ImageAttachment> {
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
  const separator = dataURL.indexOf(",");
  return {
    id: `${file.name}_${file.lastModified}_${Math.random().toString(36).slice(2)}`,
    data: separator >= 0 ? dataURL.slice(separator + 1) : dataURL,
    mimeType: file.type || "image/png",
    name: file.name,
  };
}
