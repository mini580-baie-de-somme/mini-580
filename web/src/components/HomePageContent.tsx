"use client";

import Link from "next/link";
import type { HullId } from "@/lib/types";
import { CLASS_GLOBE_LINKS } from "@/lib/constants";
import { PostCard } from "./PostCard";
import { useLocale } from "./LocaleProvider";

type LatestPost = {
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  coverImageUrl: string | null;
  publishedAt: Date | string | null;
  hulls: { hull: HullId }[];
  themes: { theme: { slug: string; labelFr: string; labelEn: string } }[];
};

const team = [
  {
    name: "Laurent",
    hull: "#268",
    roleKey: "team.laurent.role" as const,
    detailKey: "team.laurent.detail" as const,
  },
  {
    name: "Marco",
    hull: "#269",
    roleKey: "team.marco.role" as const,
    detailKey: "team.marco.detail" as const,
  },
  {
    name: "Rodolphe",
    hull: "#270",
    roleKey: "team.rodolphe.role" as const,
    detailKey: "team.rodolphe.detail" as const,
  },
];

export function HomePageContent({ latestPosts }: { latestPosts: LatestPost[] }) {
  const { t } = useLocale();

  return (
    <>
      <section className="hero-gradient border-b border-[#d4dde6]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-[#495867]">
            {t("home.heroLabel")}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-[#0D131A] sm:text-5xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[#495867]">{t("home.heroSubtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="rounded-md bg-[#495867] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3a4654]"
            >
              {t("home.readBlog")}
            </Link>
            <Link
              href="/timeline"
              className="rounded-md border border-[#495867] px-5 py-2.5 text-sm font-medium text-[#495867] hover:bg-white/60"
            >
              {t("home.timelineCta")}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-[#0D131A]">{t("home.teamTitle")}</h2>
        <p className="mt-2 max-w-2xl text-[#495867]">{t("home.teamIntro")}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {team.map((member) => (
            <div
              key={member.hull}
              className="rounded-lg border border-[#d4dde6] bg-white p-6 shadow-sm"
            >
              <span className="inline-block rounded bg-[#495867] px-2 py-0.5 text-xs font-bold text-white">
                {member.hull}
              </span>
              <h3 className="mt-3 text-lg font-semibold">{member.name}</h3>
              <p className="mt-1 text-sm font-medium text-[#495867]">{t(member.roleKey)}</p>
              <p className="mt-2 text-sm text-[#495867]/80">{t(member.detailKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d4dde6] bg-[#f4f7fa]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-[#0D131A]">{t("home.yardTitle")}</h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div>
              <p className="text-[#495867] leading-relaxed">{t("home.yardText")}</p>
              <ul className="mt-4 space-y-2 text-sm text-[#495867]">
                <li>• {t("home.yardBullet1")}</li>
                <li>• {t("home.yardBullet2")}</li>
                <li>• {t("home.yardBullet3")}</li>
              </ul>
            </div>
            <div className="rounded-lg border border-[#d4dde6] bg-white p-6">
              <h3 className="font-semibold">{t("home.classGlobe")}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href={CLASS_GLOBE_LINKS.website}
                    className="text-[#495867] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("home.officialLink")}
                  </a>
                </li>
                <li>
                  <a
                    href={CLASS_GLOBE_LINKS.builders}
                    className="text-[#495867] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("home.buildersLink")}
                  </a>
                </li>
                <li>
                  <a
                    href={CLASS_GLOBE_LINKS.transat}
                    className="text-[#495867] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("home.transatLink")}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {latestPosts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[#0D131A]">{t("home.latestPosts")}</h2>
            <Link href="/blog" className="text-sm text-[#495867] hover:underline">
              {t("home.viewAll")}
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
