"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { AppUser } from "@/lib/auth";
import { deriveUserName } from "@/lib/user-names";
import { useLocale } from "./LocaleProvider";

function userInitials(user: AppUser): string {
  const name =
    user.name ?? deriveUserName(user.firstName, user.lastName) ?? user.email;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function displayName(user: AppUser): string {
  return user.name ?? deriveUserName(user.firstName, user.lastName) ?? user.email;
}

export function SidebarProfileChip({
  user,
  onClick,
}: {
  user: AppUser;
  onClick: () => void;
}) {
  const name = displayName(user);
  const initials = userInitials(user);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-[#eef3f7]"
      aria-haspopup="dialog"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#495867] text-xs font-semibold text-white">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[#0D131A]">
          {name}
        </span>
        <span className="block truncate text-xs text-[#495867]">{user.email}</span>
      </span>
    </button>
  );
}

export function ProfileDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AppUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { t } = useLocale();

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    close();
    router.push("/");
    router.refresh();
  }

  if (!open) return null;

  const name = displayName(user);

  return (
    <>
      <button
        type="button"
        aria-label={t("profile.close")}
        className="fixed inset-0 z-50 bg-black/30"
        onClick={close}
      />
      <div
        role="dialog"
        aria-labelledby="profile-dialog-title"
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-lg border border-[#d4dde6] bg-white p-4 shadow-xl sm:inset-x-auto"
      >
        <h2
          id="profile-dialog-title"
          className="text-base font-semibold text-[#0D131A]"
        >
          {t("profile.title")}
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[#495867]/70">
              {t("profile.name")}
            </dt>
            <dd className="text-[#0D131A]">{name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[#495867]/70">
              {t("profile.email")}
            </dt>
            <dd className="break-all text-[#0D131A]">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[#495867]/70">
              {t("profile.role")}
            </dt>
            <dd className="text-[#0D131A]">
              {user.isAdmin ? t("profile.roleAdmin") : t("profile.roleEditor")}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 w-full rounded-md border border-[#d4dde6] px-4 py-2 text-sm font-medium text-[#495867] hover:bg-[#f4f7fa]"
        >
          {t("editor.logout")}
        </button>
      </div>
    </>
  );
}
