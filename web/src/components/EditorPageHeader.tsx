"use client";

import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Compact back link — shown above title on mobile, inline on desktop when set. */
  backLink?: ReactNode;
  actions?: ReactNode;
};

/** Editor list/manager page title row. Display locale toggle lives in AppShell top bar. */
export function EditorPageHeader({ title, subtitle, backLink, actions }: Props) {
  return (
    <header className="mb-5 sm:mb-6">
      <div className="rounded-xl border border-[#d4dde6] bg-white p-4 shadow-sm sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        {backLink ? (
          <div className="mb-3 sm:mb-2">{backLink}</div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="text-xl font-semibold tracking-tight text-[#0D131A] sm:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#495867] sm:mx-0 sm:max-w-2xl">
                {subtitle}
              </p>
            ) : null}
          </div>

          {actions ? (
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-start sm:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** Shared styles for primary/secondary header action buttons (touch-friendly on mobile). */
export function editorHeaderBtnSecondary(className = ""): string {
  return `inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-[#d4dde6] px-3 py-2 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50 sm:w-auto ${className}`.trim();
}

export function editorHeaderBtnPrimary(className = ""): string {
  return `inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#495867] px-3 py-2 text-sm font-medium text-white hover:bg-[#3a4654] disabled:opacity-50 sm:w-auto ${className}`.trim();
}
