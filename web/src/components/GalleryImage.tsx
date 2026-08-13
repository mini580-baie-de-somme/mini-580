import { IMAGE_ASPECT } from "@/lib/image-layout";

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

/** Lightbox: prefer largest baked variant, then origin — full crop visible. */
function slideshowSrc(image: GalleryImageData): string {
  return (
    image.urlGrande ||
    image.urlMoyenne ||
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
  hideCaption = false,
}: {
  image: GalleryImageData;
  locale: "fr" | "en";
  alt?: string;
  mode?: "display" | "edit" | "slideshow";
  /** Hide figcaption (e.g. lightbox uses footer instead). */
  hideCaption?: boolean;
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

  if (mode === "slideshow") {
    const lightboxSrc = slideshowSrc(image);
    const maxSlideHeight = "min(calc(100dvh - 9rem), 90vh)";

    return (
      <figure className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-2">
        <div className="relative flex w-full max-w-full items-center justify-center rounded-lg bg-[#0D131A]/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt={label}
            className="max-h-[min(calc(100dvh-9rem),90vh)] w-auto max-w-full object-contain"
            style={{ maxHeight: maxSlideHeight }}
          />
        </div>
        {!hideCaption && (title || description) ? (
          <figcaption className="mt-3 max-w-3xl px-2 text-center text-sm text-white/90">
            {title && <div className="font-medium text-white">{title}</div>}
            {description && (
              <div className={title ? "mt-1 text-white/80" : ""}>{description}</div>
            )}
          </figcaption>
        ) : null}
      </figure>
    );
  }

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
      {!hideCaption && (title || description) && (
        <figcaption className="px-4 py-3 text-sm text-[#495867]">
          {title && <div className="font-medium text-[#0D131A]">{title}</div>}
          {description && <div className={title ? "mt-1" : ""}>{description}</div>}
        </figcaption>
      )}
    </figure>
  );
}
