"use client";

import { useCallback, useRef } from "react";
import {
  BACKGROUND_PRESETS,
  DEFAULT_IMAGE_LAYOUT,
  IMAGE_ASPECT,
  type CropShape,
  type ImageLayoutParams,
} from "@/lib/image-layout";
import { useLocale } from "./LocaleProvider";

type Props = {
  imageSrc: string;
  value: ImageLayoutParams;
  onChange: (next: ImageLayoutParams) => void;
  disabled?: boolean;
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
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-[#495867]">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdjust(-step)}
        className="rounded border border-[#d4dde6] px-2 py-0.5 text-sm disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-[4.5rem] text-center font-mono text-xs">{value}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdjust(step)}
        className="rounded border border-[#d4dde6] px-2 py-0.5 text-sm disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

export function PhotoCanvasEditor({
  imageSrc,
  value,
  onChange,
  disabled,
}: Props) {
  const { locale } = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const dragMode = useRef<DragMode>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

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

  function onPointerDown(e: React.PointerEvent, mode: DragMode) {
    if (disabled || !mode) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragMode.current = mode;
    lastPoint.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragMode.current || !lastPoint.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const dx = (e.clientX - lastPoint.current.x) / rect.width;
    const dy = (e.clientY - lastPoint.current.y) / rect.height;
    lastPoint.current = { x: e.clientX, y: e.clientY };
    const cur = valueRef.current;

    if (dragMode.current === "pan") {
      patch({
        offsetX: clamp(cur.offsetX + dx, -2, 2),
        offsetY: clamp(cur.offsetY + dy, -2, 2),
      });
    } else if (dragMode.current === "rotate") {
      patch({ rotation: cur.rotation + dx * 180 });
    }
  }

  function onPointerUp() {
    dragMode.current = null;
    lastPoint.current = null;
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

  return (
    <div className="space-y-4">
      <div
        ref={stageRef}
        className="relative mx-auto w-full max-w-[min(100%,360px)] touch-none overflow-hidden rounded-lg border border-[#d4dde6] shadow-sm"
        style={{
          aspectRatio: String(IMAGE_ASPECT),
          background:
            value.backgroundColor === "transparent"
              ? "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px"
              : value.backgroundColor,
        }}
        onWheel={onWheel}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => onPointerDown(e, "pan")}
        />
      </div>

      <p className="text-center text-[11px] text-[#495867]">
        {locale === "fr"
          ? "Glisser pour déplacer · molette pour zoomer · Maj/Alt = axe Y/X"
          : "Drag to pan · wheel to zoom · Shift/Alt = Y/X axis"}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
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
          label={locale === "fr" ? "Échelle" : "Scale"}
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
            label="Échelle Y"
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
        <div className="flex items-center gap-2">
          <span className="w-16 text-xs text-[#495867]">90°</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => patch({ rotation: value.rotation - 90 })}
            className="rounded border border-[#d4dde6] px-2 py-0.5 text-sm"
          >
            ↺
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => patch({ rotation: value.rotation + 90 })}
            className="rounded border border-[#d4dde6] px-2 py-0.5 text-sm"
          >
            ↻
          </button>
          <button
            type="button"
            disabled={disabled}
            onPointerDown={(e) => onPointerDown(e, "rotate")}
            className="rounded border border-[#d4dde6] px-2 py-0.5 text-xs"
          >
            {locale === "fr" ? "Glisser °" : "Drag °"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
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
          <span className="text-xs text-[#495867]">
            {locale === "fr" ? "Conserver le ratio" : "Lock aspect ratio"}
          </span>
        </label>
        <label className="flex items-center gap-2 text-xs text-[#495867]">
          Crop
          <select
            value={value.cropShape}
            disabled={disabled}
            onChange={(e) =>
              patch({ cropShape: e.target.value as CropShape })
            }
            className="rounded border border-[#d4dde6] px-2 py-1"
          >
            <option value="RECT">
              {locale === "fr" ? "Rectangle" : "Rectangle"}
            </option>
            <option value="CIRCLE">
              {locale === "fr" ? "Cercle" : "Circle"}
            </option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-[#495867]">
          Inset
          <input
            type="range"
            min={0}
            max={0.25}
            step={0.01}
            value={value.cropInset}
            disabled={disabled}
            onChange={(e) => patch({ cropInset: Number(e.target.value) })}
          />
        </label>
      </div>

      <div>
        <p className="mb-1 text-xs text-[#495867]">
          {locale === "fr" ? "Fond" : "Background"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BACKGROUND_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={locale === "fr" ? p.labelFr : p.labelEn}
              disabled={disabled}
              onClick={() => patch({ backgroundColor: p.value })}
              className={`h-7 w-7 rounded border-2 ${
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
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ ...DEFAULT_IMAGE_LAYOUT })}
        className="text-xs text-[#495867] underline"
      >
        {locale === "fr" ? "Réinitialiser la mise en page" : "Reset layout"}
      </button>
    </div>
  );
}
