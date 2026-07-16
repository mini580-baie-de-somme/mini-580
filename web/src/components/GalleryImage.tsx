type GalleryImageData = {
  url: string;
  titleFr?: string;
  titleEn?: string;
  captionFr: string;
  captionEn: string;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  rotation?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
};

/**
 * Renders a post image with crop / zoom / rotation / focus stored as metadata.
 * Transform is CSS-only (source file unchanged).
 */
export function GalleryImage({
  image,
  locale,
  alt,
}: {
  image: GalleryImageData;
  locale: "fr" | "en";
  alt?: string;
}) {
  const title = locale === "fr" ? image.titleFr : image.titleEn;
  const caption = locale === "fr" ? image.captionFr : image.captionEn;
  const focusX = image.focusX ?? 0.5;
  const focusY = image.focusY ?? 0.5;
  const zoom = image.zoom ?? 1;
  const rotation = image.rotation ?? 0;
  const cropX = image.cropX ?? 0;
  const cropY = image.cropY ?? 0;
  const cropW = image.cropW ?? 1;
  const cropH = image.cropH ?? 1;

  const label = alt || title || caption || "";

  return (
    <figure className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
      <div
        className="relative w-full overflow-hidden bg-[#eef3f7]"
        style={{ aspectRatio: `${Math.max(cropW, 0.01)} / ${Math.max(cropH, 0.01)}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={label}
          className="absolute max-w-none origin-center"
          style={{
            width: `${100 / Math.max(cropW, 0.01)}%`,
            height: `${100 / Math.max(cropH, 0.01)}%`,
            left: `${(-cropX / Math.max(cropW, 0.01)) * 100}%`,
            top: `${(-cropY / Math.max(cropH, 0.01)) * 100}%`,
            objectFit: "cover",
            objectPosition: `${focusX * 100}% ${focusY * 100}%`,
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        />
      </div>
      {(title || caption) && (
        <figcaption className="px-4 py-3 text-sm text-[#495867]">
          {title && <div className="font-medium text-[#0D131A]">{title}</div>}
          {caption && <div className={title ? "mt-1" : ""}>{caption}</div>}
        </figcaption>
      )}
    </figure>
  );
}
