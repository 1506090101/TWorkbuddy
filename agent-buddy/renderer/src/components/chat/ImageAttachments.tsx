import type { ImageAttachment } from "@shared/types";

export function ImageAttachments({ images }: { images?: ImageAttachment[] }) {
  if (!images?.length) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {images.map((image) => (
        <img
          key={image.id}
          src={`data:${image.mimeType};base64,${image.data}`}
          alt={image.name}
          className="max-h-52 max-w-full rounded-md object-contain"
        />
      ))}
    </div>
  );
}
