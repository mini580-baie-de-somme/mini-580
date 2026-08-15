"use client";

import Link from "next/link";

type Props = {
  href?: string;
  onClick?: () => void;
  className?: string;
  label?: string;
};

function BackChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** 44×44 min touch target — back to list (consultation) or consultation (edit). */
export function EditorEntityBackButton({ href, onClick, className, label = "Retour" }: Props) {
  const classes = [
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#495867] hover:bg-[#eef3f7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#495867]/30",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={label}>
        <BackChevronIcon />
      </button>
    );
  }

  if (!href) return null;

  return (
    <Link href={href} className={classes} aria-label={label}>
      <BackChevronIcon />
    </Link>
  );
}
