"use client";

import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
};

/** Destructive / lifecycle actions at the bottom of entity screens. */
export function EditorFormDangerZone({
  title = "Actions sensibles",
  description,
  children,
}: Props) {
  return (
    <section
      className="mt-8 rounded-lg border border-red-200 bg-red-50/40 p-4 sm:p-5"
      aria-label={title}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#0D131A]">{title}</h3>
        {description ? <p className="mt-1 text-sm text-[#495867]">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
