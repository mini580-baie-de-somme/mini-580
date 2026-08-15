"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { editorHeaderBtnPrimary } from "./EditorPageHeader";

type Props = {
  editHref?: string;
  editLabel?: string;
  showEdit?: boolean;
  children?: ReactNode;
};

/** Primary actions at top of consultation screens — no back button here. */
export function EditorEntityActionsBar({
  editHref,
  editLabel = "Modifier",
  showEdit = true,
  children,
}: Props) {
  const hasActions = (showEdit && editHref) || children;
  if (!hasActions) return null;

  return (
    <section
      className="mb-6 rounded-lg border border-[#d4dde6] bg-white p-4 sm:p-5"
      aria-label="Actions"
    >
      <div className="flex flex-wrap gap-2">
        {showEdit && editHref ? (
          <Link href={editHref} className={editorHeaderBtnPrimary()}>
            {editLabel}
          </Link>
        ) : null}
        {children}
      </div>
    </section>
  );
}
