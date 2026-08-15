"use client";

import type { ReactNode } from "react";
import { EditorEntityBackButton } from "./EditorEntityBackButton";

type Props = {
  backHref: string;
  onBackClick?: () => void;
  title: string;
  meta?: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

/** Entity page title with chevron back immediately left of the heading. */
export function EditorEntityPageTitle({
  backHref,
  onBackClick,
  title,
  meta,
  sub,
  trailing,
  className,
}: Props) {
  return (
    <header className={`mb-6 ${className ?? ""}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-1 sm:gap-2">
          <EditorEntityBackButton href={onBackClick ? undefined : backHref} onClick={onBackClick} />
          <div className="min-w-0 pt-1.5 sm:pt-0.5">
            <h1 className="text-xl font-semibold tracking-tight text-[#0D131A] sm:text-2xl">
              {title}
            </h1>
            {meta ? <p className="mt-1 text-sm text-[#495867]">{meta}</p> : null}
            {sub ? <p className="mt-1 text-xs text-[#495867]">{sub}</p> : null}
          </div>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </header>
  );
}
