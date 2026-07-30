"use client";

import type { ReactNode } from "react";
import { DisplayLangToggle } from "./DisplayLangToggle";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

/** Editor list/manager page title row — display locale toggle sits right of the title. */
export function EditorPageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold text-[#0D131A]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[#495867]">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-start gap-3">
        <DisplayLangToggle />
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
