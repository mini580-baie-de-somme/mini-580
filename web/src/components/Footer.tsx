"use client";

import { useEffect, useState } from "react";
import { CLASS_GLOBE_LINKS } from "@/lib/constants";
import { FE_VERSION } from "@/lib/versions";
import { useLocale } from "./LocaleProvider";

export function Footer() {
  const { t } = useLocale();
  const [beVersion, setBeVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/version")
      .then(async (res) => {
        if (!res.ok) throw new Error(`version ${res.status}`);
        const data = (await res.json()) as { version?: string };
        if (!cancelled && typeof data.version === "string") {
          setBeVersion(data.version);
        }
      })
      .catch(() => {
        if (!cancelled) setBeVersion(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const versionLabel =
    beVersion !== null
      ? `FE v${FE_VERSION} / BE v${beVersion}`
      : `FE v${FE_VERSION} / BE …`;

  return (
    <footer className="mt-auto border-t border-[#d4dde6] bg-[#f4f7fa]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-[#0D131A]">Class Mini 5.80 Baie de Somme</p>
            <p className="mt-2 text-sm text-[#495867]">{t("footer.tagline")}</p>
          </div>
          <div>
            <p className="font-semibold text-[#0D131A]">Class Globe 5.80</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <a
                  href={CLASS_GLOBE_LINKS.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#495867] hover:underline"
                >
                  {t("footer.officialSite")}
                </a>
              </li>
              <li>
                <a
                  href={CLASS_GLOBE_LINKS.builders}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#495867] hover:underline"
                >
                  {t("footer.builderBlogs")}
                </a>
              </li>
              <li>
                <a
                  href={CLASS_GLOBE_LINKS.transat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#495867] hover:underline"
                >
                  {t("footer.transat")}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-[#495867]">{t("footer.credit")}</p>
        <p className="mt-2 text-center font-mono text-[11px] text-[#7a8794]">{versionLabel}</p>
      </div>
    </footer>
  );
}
