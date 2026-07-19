"use client";

import { useCallback, useRef } from "react";
import {
  BACKGROUND_PRESETS,
  DEFAULT_IMAGE_LAYOUT,
  IMAGE_ASPECT,
  type CropShape,
  type ImageLayoutParams,
} from "@/lib/image-layout";
import {
  angleDeg,
  pinchSnapshot,
  rotationFromPinch,
  scaleFromPinch,
  type PinchSnapshot,
  type Point,
} from "@/lib/photo-gestures";
import { useLocale } from "./LocaleProvider";

type Props = {
  imageSrc: string;
  value: ImageLayoutParams;
  onChange: (next: ImageLayoutParams) => void;
  disabled?: boolean;
  /** Grow stage to fill parent height (workspace modal). */
  fillStage?: boolean;
  showStage?: boolean;
  showControls?: boolean;
  /** Floating zoom/rotate bar on the canvas (mobile modal). Default: true when stage-only. */
  showMobileToolbar?: boolean;
};

type DragMode = "pan" | "rotate" | null;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function Stepper({
  label,
  value,
  step,
  onAdjust,
  disabled,
}: {
  label: string;
  value: string;
  step: number;
  onAdjust: (delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="w-7 shrink-0 text-[11px] text-[#495867]">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdjust(-step)}
        className="rounded border border-[#d4dde6] px-1.5 py-0.5 text-xs disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-[3.25rem] text-center font-mono text-[11px]">
        {value}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdjust(step)}
        className="rounded border border-[#d4dde6] px-1.5 py-0.5 text-xs disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

function MobileToolbarButton({
  label,
  onClick,
  onPointerDown,
  disabled,
  title,
}: {
  label: string;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#d4dde6] bg-white px-2.5 text-base text-[#0D131A] shadow-sm active:bg-[#eef3f7] disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export function PhotoCanvasEditor({
  imageSrc,
  value,
  onChange,
  disabled,
  fillStage = false,
  showStage = true,
  showControls = true,
  showMobileToolbar,
}: Props) {
  const { locale } = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const dragMode = useRef<DragMode>(null);
  const lastPoint = useRef<Point | null>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const pinchStart = useRef<PinchSnapshot | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const mobileToolbar =
    showMobileToolbar ?? (showStage && !showControls);

  const patch = useCallback(
    (partial: Partial<ImageLayoutParams>) => {
      const cur = valueRef.current;
      const next = { ...cur, ...partial };
      if (next.lockAspect && (partial.scaleX != null || partial.scaleY != null)) {
        if (partial.scaleX != null) next.scaleY = partial.scaleX;
        if (partial.scaleY != null && partial.scaleX == null) {
          next.scaleX = partial.scaleY;
        }
      }
      onChange(next);
    },
    [onChange]
  );

  function pointerList(): Point[] {
    return [...pointers.current.values()];
  }

  function beginPinchIfNeeded() {
    const pts = pointerList();
    if (pts.length !== 2) {
      pinchStart.current = null;
      return;
    }
    const cur = valueRef.current;
    pinchStart.current = pinchSnapshot(
      pts[0],
      pts[1],
      cur.scaleX,
      cur.scaleY,
      cur.rotation
    );
    dragMode.current = null;
    lastPoint.current = null;
  }

  function onInteractionPointerDown(e: React.PointerEvent, mode: DragMode = "pan") {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      beginPinchIfNeeded();
      return;
    }

    if (mode) {
      dragMode.current = mode;
      lastPoint.current = { x: e.clientX, y: e.clientY };
    }
  }

  function onInteractionPointerMove(e: React.PointerEvent) {
    if (disabled || !stageRef.current) return;
    if (!pointers.current.has(e.pointerId)) return;

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = stageRef.current.getBoundingClientRect();
    const pts = pointerList();
    const cur = valueRef.current;

    if (pts.length === 2 && pinchStart.current) {
      const start = pinchStart.current;
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ang = angleDeg(pts[0], pts[1]);
      const scaled = scaleFromPinch(start, dist, cur.lockAspect);
      patch({
        scaleX: clamp(scaled.scaleX, 0.1, 8),
        scaleY: clamp(scaled.scaleY, 0.1, 8),
        rotation: rotationFromPinch(start, ang),
      });
      return;
    }

    if (pts.length !== 1 || !lastPoint.current) return;

    const dx = (e.clientX - lastPoint.current.x) / rect.width;
    const dy = (e.clientY - lastPoint.current.y) / rect.height;
    lastPoint.current = { x: e.clientX, y: e.clientY };

    if (dragMode.current === "pan") {
      patch({
        offsetX: clamp(cur.offsetX + dx, -2, 2),
        offsetY: clamp(cur.offsetY + dy, -2, 2),
      });
    } else if (dragMode.current === "rotate") {
      patch({ rotation: cur.rotation + dx * 180 });
    }
  }

  function onInteractionPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      pinchStart.current = null;
      const remaining = pointerList()[0];
      if (remaining) {
        dragMode.current = "pan";
        lastPoint.current = remaining;
      }
    }
    if (pointers.current.size === 0) {
      dragMode.current = null;
      lastPoint.current = null;
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      beginPinchIfNeeded();
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (disabled) return;
    e.preventDefault();
    const cur = valueRef.current;
    const factor = e.deltaY > 0 ? 0.96 : 1.04;
    if (cur.lockAspect) {
      const s = clamp(cur.scaleX * factor, 0.1, 8);
      patch({ scaleX: s, scaleY: s });
    } else if (e.shiftKey) {
      patch({ scaleY: clamp(cur.scaleY * factor, 0.1, 8) });
    } else if (e.altKey) {
      patch({ scaleX: clamp(cur.scaleX * factor, 0.1, 8) });
    } else {
      patch({
        scaleX: clamp(cur.scaleX * factor, 0.1, 8),
        scaleY: clamp(cur.scaleY * factor, 0.1, 8),
      });
    }
  }

  function adjustScale(delta: number) {
    const cur = valueRef.current;
    if (cur.lockAspect) {
      const s = clamp(cur.scaleX + delta, 0.1, 8);
      patch({ scaleX: s, scaleY: s });
    } else {
      patch({
        scaleX: clamp(cur.scaleX + delta, 0.1, 8),
        scaleY: clamp(cur.scaleY + delta, 0.1, 8),
      });
    }
  }

  const inset = clamp(value.cropInset, 0, 0.4);
  const cropLeft = inset * 100;
  const cropTop = inset * 100;
  const cropW = (1 - 2 * inset) * 100;
  const cropH = (1 - 2 * inset) * 100;

  const photoStyle: React.CSSProperties = {
    position: "absolute",
    left: `${50 + value.offsetX * cropW}%`,
    top: `${50 + value.offsetY * cropH}%`,
    width: `${cropW * value.scaleX}%`,
    height: `${cropH * value.scaleY}%`,
    transform: `translate(-50%, -50%) rotate(${value.rotation}deg)`,
    transformOrigin: "center center",
    objectFit: value.lockAspect ? "cover" : "fill",
    pointerEvents: "none",
    userSelect: "none",
  };

  const mobileToolbarNode =
    mobileToolbar && showStage ? (
      <div
        className="pointer-events-auto absolute inset-x-2 bottom-2 z-20 flex flex-wrap items-center justify-center gap-1.5 sm:inset-x-auto sm:bottom-3 sm:left-1/2 sm:max-w-full sm:-translate-x-1/2 md:hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MobileToolbarButton
          label="−"
          title={locale === "fr" ? "Réduire" : "Zoom out"}
          disabled={disabled}
          onClick={() => adjustScale(-0.08)}
        />
        <MobileToolbarButton
          label="+"
          title={locale === "fr" ? "Agrandir" : "Zoom in"}
          disabled={disabled}
          onClick={() => adjustScale(0.08)}
        />
        <MobileToolbarButton
          label="↺"
          title="-90°"
          disabled={disabled}
          onClick={() => patch({ rotation: value.rotation - 90 })}
        />
        <MobileToolbarButton
          label="↻"
          title="+90°"
          disabled={disabled}
          onClick={() => patch({ rotation: value.rotation + 90 })}
        />
        <MobileToolbarButton
          label="↔°"
          title={
            locale === "fr"
              ? "Maintenir et glisser horizontalement pour pivoter librement"
              : "Hold and drag horizontally for free rotation"
          }
          disabled={disabled}
          onPointerDown={(e) => onInteractionPointerDown(e, "rotate")}
        />
      </div>
    ) : null;

  const stage = showStage ? (
    <div
      ref={stageRef}
      className={
        fillStage
          ? "relative h-full max-h-full max-w-full touch-none overflow-hidden rounded-lg border border-[#d4dde6] shadow-sm"
          : "relative mx-auto w-full max-w-[min(100%,360px)] touch-none overflow-hidden rounded-lg border border-[#d4dde6] shadow-sm"
      }
      style={{
        aspectRatio: String(IMAGE_ASPECT),
        ...(fillStage ? { width: "auto" } : {}),
        background:
          value.backgroundColor === "transparent"
            ? "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px"
            : value.backgroundColor,
      }}
      onWheel={onWheel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt="" draggable={false} style={photoStyle} />

      <div
        className="pointer-events-none absolute border-2 border-white/90"
        style={{
          left: `${cropLeft}%`,
          top: `${cropTop}%`,
          width: `${cropW}%`,
          height: `${cropH}%`,
          borderRadius: value.cropShape === "CIRCLE" ? "50%" : "2px",
          boxShadow: "0 0 0 9999px rgba(13,19,26,0.45)",
        }}
      />

      <div
        className="absolute inset-0 z-10 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => onInteractionPointerDown(e, "pan")}
        onPointerMove={onInteractionPointerMove}
        onPointerUp={onInteractionPointerUp}
        onPointerCancel={onInteractionPointerUp}
      />

      {mobileToolbarNode}

      {mobileToolbar && (
        <p className="pointer-events-none absolute left-2 right-2 top-2 z-20 rounded bg-black/45 px-2 py-1 text-center text-[10px] leading-snug text-white md:hidden">
          {locale === "fr"
            ? "1 doigt = déplacer · pincement = zoom/pivoter"
            : "1 finger = pan · pinch = zoom/rotate"}
        </p>
      )}
    </div>
  ) : null;

  const controls = showControls ? (
    <div className="space-y-3">
      <p className="hidden text-[11px] leading-snug text-[#495867] sm:block">
        {locale === "fr"
          ? "Glisser = déplacer · molette = zoom · Maj/Alt = axe Y/X"
          : "Drag = pan · wheel = zoom · Shift/Alt = Y/X"}
      </p>
      <p className="text-[11px] leading-snug text-[#495867] sm:hidden">
        {locale === "fr"
          ? "Glisser = déplacer · pincement = zoom/pivoter · boutons ci-dessous"
          : "Drag = pan · pinch = zoom/rotate · use buttons below"}
      </p>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        <Stepper
          label="X"
          value={value.offsetX.toFixed(2)}
          step={0.02}
          disabled={disabled}
          onAdjust={(d) => patch({ offsetX: clamp(value.offsetX + d, -2, 2) })}
        />
        <Stepper
          label="Y"
          value={value.offsetY.toFixed(2)}
          step={0.02}
          disabled={disabled}
          onAdjust={(d) => patch({ offsetY: clamp(value.offsetY + d, -2, 2) })}
        />
        <Stepper
          label={locale === "fr" ? "Éch." : "Sc."}
          value={value.scaleX.toFixed(2)}
          step={0.05}
          disabled={disabled}
          onAdjust={(d) => {
            if (value.lockAspect) {
              const s = clamp(value.scaleX + d, 0.1, 8);
              patch({ scaleX: s, scaleY: s });
            } else {
              patch({ scaleX: clamp(value.scaleX + d, 0.1, 8) });
            }
          }}
        />
        {!value.lockAspect && (
          <Stepper
            label="Y×"
            value={value.scaleY.toFixed(2)}
            step={0.05}
            disabled={disabled}
            onAdjust={(d) =>
              patch({ scaleY: clamp(value.scaleY + d, 0.1, 8) })
            }
          />
        )}
        <Stepper
          label="°"
          value={`${Math.round(value.rotation)}°`}
          step={1}
          disabled={disabled}
          onAdjust={(d) => patch({ rotation: value.rotation + d })}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => patch({ rotation: value.rotation - 90 })}
            className="min-h-[44px] min-w-[44px] rounded border border-[#d4dde6] px-1.5 py-0.5 text-xs"
            title="-90°"
          >
            ↺
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => patch({ rotation: value.rotation + 90 })}
            className="min-h-[44px] min-w-[44px] rounded border border-[#d4dde6] px-1.5 py-0.5 text-xs"
            title="+90°"
          >
            ↻
          </button>
          <button
            type="button"
            disabled={disabled}
            onPointerDown={(e) => onInteractionPointerDown(e, "rotate")}
            title={
              locale === "fr"
                ? "Maintenir et glisser horizontalement pour pivoter librement"
                : "Hold and drag horizontally for free rotation"
            }
            className="min-h-[44px] rounded border border-[#d4dde6] px-2 py-0.5 text-[10px]"
          >
            {locale === "fr" ? "Pivot libre" : "Free rotate"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#495867]">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={value.lockAspect}
            disabled={disabled}
            onChange={(e) => {
              const lock = e.target.checked;
              patch(
                lock
                  ? { lockAspect: true, scaleY: value.scaleX }
                  : { lockAspect: false }
              );
            }}
          />
          {locale === "fr" ? "Ratio" : "Aspect"}
        </label>
        <label className="flex items-center gap-1.5">
          Crop
          <select
            value={value.cropShape}
            disabled={disabled}
            onChange={(e) =>
              patch({ cropShape: e.target.value as CropShape })
            }
            className="rounded border border-[#d4dde6] px-1.5 py-0.5 text-xs"
          >
            <option value="RECT">
              {locale === "fr" ? "Rect" : "Rect"}
            </option>
            <option value="CIRCLE">
              {locale === "fr" ? "Cercle" : "Circle"}
            </option>
          </select>
        </label>
        <label className="flex min-w-[8rem] flex-1 items-center gap-1.5">
          Inset
          <input
            type="range"
            min={0}
            max={0.25}
            step={0.01}
            value={value.cropInset}
            disabled={disabled}
            onChange={(e) => patch({ cropInset: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] text-[#495867]">
          {locale === "fr" ? "Fond" : "Bg"}
        </span>
        {BACKGROUND_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={locale === "fr" ? p.labelFr : p.labelEn}
            disabled={disabled}
            onClick={() => patch({ backgroundColor: p.value })}
            className={`h-8 w-8 rounded border-2 sm:h-6 sm:w-6 ${
              value.backgroundColor === p.value
                ? "border-[#495867]"
                : "border-[#d4dde6]"
            }`}
            style={{
              background:
                p.value === "transparent"
                  ? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px"
                  : p.value,
            }}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ ...DEFAULT_IMAGE_LAYOUT })}
        className="text-[11px] text-[#495867] underline"
      >
        {locale === "fr" ? "Réinitialiser" : "Reset"}
      </button>
    </div>
  ) : null;

  if (showStage && showControls && !fillStage) {
    return (
      <div className="space-y-3">
        {stage}
        {controls}
      </div>
    );
  }

  if (showStage && !showControls) {
    return fillStage ? (
      <div className="flex h-full w-full items-center justify-center p-2 sm:p-4">
        {stage}
      </div>
    ) : (
      <>{stage}</>
    );
  }

  if (!showStage && showControls) {
    return <>{controls}</>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
      <div className="flex min-h-[36vh] flex-1 items-center justify-center bg-[#eef3f7] p-2 lg:min-h-0">
        {stage}
      </div>
      <div className="shrink-0 overflow-y-auto border-t border-[#d4dde6] p-3 lg:w-[320px] lg:border-l lg:border-t-0">
        {controls}
      </div>
    </div>
  );
}
