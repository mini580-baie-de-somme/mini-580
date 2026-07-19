"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const HANDLE_HEIGHT = 44;
const EXPANDED_RATIO = 1 / 3;
const COLLAPSE_THRESHOLD = 52;

type Props = {
  children: ReactNode;
  /** Accessible label for the drag handle (locale-specific). */
  handleLabel: string;
  className?: string;
};

/** Mobile bottom sheet for photo editor fields; normal scrollable sidebar from md up. */
export function EditorSheetPanel({
  children,
  handleLabel,
  className = "",
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(280);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number; moved: boolean } | null>(
    null
  );

  const measureExpanded = useCallback(() => {
    const parent = shellRef.current?.parentElement;
    if (!parent) return Math.round(window.innerHeight * EXPANDED_RATIO);
    return Math.max(
      HANDLE_HEIGHT + 80,
      Math.round(parent.clientHeight * EXPANDED_RATIO)
    );
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const syncMobile = () => setMobile(mq.matches);
    syncMobile();
    mq.addEventListener("change", syncMobile);
    return () => mq.removeEventListener("change", syncMobile);
  }, []);

  useEffect(() => {
    const parent = shellRef.current?.parentElement;
    if (!parent) return;

    const sync = () => {
      const next = measureExpanded();
      setExpandedHeight(next);
      setPanelHeight((prev) => {
        if (collapsed) return HANDLE_HEIGHT;
        if (prev == null) return next;
        return Math.min(prev, Math.round(parent.clientHeight * 0.85));
      });
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [collapsed, measureExpanded]);

  const effectiveHeight = collapsed
    ? HANDLE_HEIGHT
    : (panelHeight ?? expandedHeight);

  function onHandlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      startH: effectiveHeight,
      moved: false,
    };
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    if (Math.abs(dy) > 4) dragRef.current.moved = true;

    const parent = shellRef.current?.parentElement;
    const maxH = parent
      ? Math.round(parent.clientHeight * 0.85)
      : Math.round(window.innerHeight * 0.85);
    const next = Math.max(HANDLE_HEIGHT, dragRef.current.startH + dy);
    setPanelHeight(Math.min(next, maxH));
    setCollapsed(next <= COLLAPSE_THRESHOLD);
  }

  function onHandlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (!drag.moved) {
      if (collapsed) {
        setCollapsed(false);
        setPanelHeight(expandedHeight);
      } else {
        setCollapsed(true);
        setPanelHeight(HANDLE_HEIGHT);
      }
      return;
    }

    const h = panelHeight ?? expandedHeight;
    if (h <= COLLAPSE_THRESHOLD) {
      setCollapsed(true);
      setPanelHeight(HANDLE_HEIGHT);
      return;
    }

    setCollapsed(false);
    if (h < expandedHeight * 0.55) {
      setPanelHeight(expandedHeight);
    }
  }

  return (
    <aside
      ref={shellRef}
      style={mobile ? { height: effectiveHeight } : undefined}
      className={`flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-[#d4dde6] transition-[height] duration-150 ease-out md:h-auto md:!max-h-none md:flex-1 md:overflow-y-auto md:overscroll-y-contain md:transition-none ${className}`}
    >
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={handleLabel}
        className="flex shrink-0 touch-none flex-col items-center justify-center gap-1 border-b border-[#eef3f7] bg-[#fafbfc] py-2 active:bg-[#eef3f7] md:hidden"
        style={{ height: HANDLE_HEIGHT }}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        <span className="h-1 w-10 rounded-full bg-[#c5d0da]" />
        <span className="text-[10px] text-[#495867]">
          {collapsed ? "▲" : "▼"}
        </span>
      </button>

      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain ${
          collapsed ? "hidden md:block" : ""
        }`}
      >
        {children}
      </div>
    </aside>
  );
}
