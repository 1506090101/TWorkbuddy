import { Plus, Trash2 } from "lucide-react";
import { IconButton, Input } from "@components/common";
import type { ModelInfo } from "@shared/types";

interface ModelListEditorProps {
  models: ModelInfo[];
  onChange: (models: ModelInfo[]) => void;
  addLabel: string;
  idLabel: string;
  contextLabel: string;
  visionLabel: string;
  removeLabel: string;
}

export function ModelListEditor({
  models,
  onChange,
  addLabel,
  idLabel,
  contextLabel,
  visionLabel,
  removeLabel,
}: ModelListEditorProps) {
  const updateModel = (index: number, changes: Partial<ModelInfo>) => {
    onChange(
      models.map((model, modelIndex) =>
        modelIndex === index ? { ...model, ...changes } : model
      )
    );
  };

  return (
    <div className="space-y-2">
      {models.map((model, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1fr)_8rem_auto_auto] items-center gap-2"
        >
          <Input
            aria-label={idLabel}
            value={model.id}
            onChange={(event) =>
              updateModel(index, {
                id: event.target.value,
                name: event.target.value,
              })
            }
            placeholder="gpt-4o"
          />
          <Input
            aria-label={contextLabel}
            type="number"
            min="1"
            value={model.contextWindow ?? ""}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              updateModel(index, {
                contextWindow: Number.isFinite(value) ? value : undefined,
              });
            }}
            placeholder={contextLabel}
          />
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-content-muted">
            <input
              type="checkbox"
              checked={model.supportsVision ?? false}
              onChange={(event) =>
                updateModel(index, { supportsVision: event.target.checked })
              }
              className="h-3.5 w-3.5 accent-primary-500"
            />
            {visionLabel}
          </label>
          <IconButton
            type="button"
            size="sm"
            variant="danger"
            icon={<Trash2 size={14} />}
            tooltip={removeLabel}
            aria-label={removeLabel}
            onClick={() => onChange(models.filter((_, item) => item !== index))}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange([
            ...models,
            {
              id: "",
              name: "",
              supportsStreaming: true,
              supportsVision: false,
            },
          ])
        }
        className="inline-flex items-center gap-1.5 py-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400"
      >
        <Plus size={14} />
        {addLabel}
      </button>
    </div>
  );
}
