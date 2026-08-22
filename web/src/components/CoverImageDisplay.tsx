import {
  coverDisplayAspectRatio,
  coverDisplayIsCircle,
} from "@/lib/cover-display";
import type { CropAspectFormat } from "@/lib/image-layout";

type CoverImageDisplayProps = {
  src: string;
  cropAspectFormat?: CropAspectFormat | string | null;
  cropShape?: string | null;
  className?: string;
  wrapperClassName?: string;
  imgClassName?: string;
  onClick?: () => void;
};

export function CoverImageDisplay({
  src,
  cropAspectFormat,
  cropShape,
  className = "",
  wrapperClassName = "",
  imgClassName = "",
  onClick,
}: CoverImageDisplayProps) {
  const isCircle = coverDisplayIsCircle(cropAspectFormat, cropShape);
  const rounded = isCircle ? "rounded-full" : "rounded-xl";
  const wrapperClasses = [
    "block w-full overflow-hidden",
    rounded,
    wrapperClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      className={`h-full w-full object-cover ${imgClassName}`.trim()}
      style={{ aspectRatio: coverDisplayAspectRatio(cropAspectFormat) }}
    />
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={wrapperClasses}>
        {img}
      </button>
    );
  }

  return <div className={wrapperClasses}>{img}</div>;
}
