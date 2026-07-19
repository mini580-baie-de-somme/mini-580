type GalleryImageData = {
  urlOrigin?: string;
  url?: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  titleFr?: string;
  titleEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  captionFr?: string;
  captionEn?: string;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  rotation?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
};

function displaySrc(image: GalleryImageData): string {
  return (
    image.urlMoyenne ||
    image.urlGrande ||
    image.urlPetite ||
    image.urlOrigin ||
    image.url ||
    ""
  );
}

/**
 * Public display: baked WebP variants (crop/zoom/rotate already applied on save).
 * Edit preview: origin + CSS transforms for live editor feedback.
 */
export function GalleryImage({
  image,
  locale,
  alt,
  mode = "display",
}: {
  image: GalleryImageData;
  locale: "fr" | "en";
  alt?: string;
  mode?: "display" | "edit";
}) {
  const title = locale === "fr" ? image.titleFr : image.titleEn;
  const description =
    locale === "fr"
      ? image.descriptionFr ?? image.captionFr
      : image.descriptionEn ?? image.captionEn;
  const label = alt || title || description || "";

  if (mode === "edit") {
    const focusX = image.focusX ?? 0.5;
    const focusY = image.focusY ?? 0.5;
    const zoom = image.zoom ?? 1;
    const rotation = image.rotation ?? 0;
    const cropX = image.cropX ?? 0;
    const cropY = image.cropY ?? 0;
    const cropW = image.cropW ?? 1;
    const cropH = image.cropH ?? 1;
    const src = image.urlOrigin || displaySrc(image);

    return (
      <figure className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
        <div
          className="relative w-full overflow-hidden bg-[#eef3f7]"
          style={{
            aspectRatio: `${Math.max(cropW, 0.01)} / ${Math.max(cropH, 0.01)}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
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
        {(title || description) && (
          <figcaption className="px-4 py-3 text-sm text-[#495867]">
            {title && <div className="font-medium text-[#0D131A]">{title}</div>}
            {description && (
              <div className={title ? "mt-1" : ""}>{description}</div>
            )}
          </figcaption>
        )}
      </figure>
    );
  }

  const src = displaySrc(image);
  return (
    <figure className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
      <div className="relative w-full overflow-hidden bg-[#eef3f7] aspect-[3/4]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="h-full w-full object-cover"
        />
      </div>
      {(title || description) && (
        <figcaption className="px-4 py-3 text-sm text-[#495867]">
          {title && <div className="font-medium text-[#0D131A]">{title}</div>}
          {description && <div className={title ? "mt-1" : ""}>{description}</div>}
        </figcaption>
      )}
    </figure>
  );
}
