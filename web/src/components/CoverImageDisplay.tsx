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
  const wrapperStyle = {
    aspectRatio: coverDisplayAspectRatio(cropAspectFormat),
  };
  const wrapperClasses = [
    "block w-full max-w-full overflow-hidden",
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
      className={`block h-full w-full object-contain ${imgClassName}`.trim()}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={wrapperClasses}
        style={wrapperStyle}
      >
        {img}
      </button>
    );
  }

  return (
    <div className={wrapperClasses} style={wrapperStyle}>
      {img}
    </div>
  );
}
