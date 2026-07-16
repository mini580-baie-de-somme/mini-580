"use client";

import Link from "next/link";
import { useState } from "react";
import type { HullId } from "@/lib/types";
import { GalleryImage } from "./GalleryImage";
import { LangToggle, ArticleBody } from "./LangToggle";
import { HullBadgeList } from "./HullBadge";

type PreviewPost = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  bodyFr: string;
  bodyEn: string;
  status: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  hulls: { hull: HullId }[];
  images: {
    urlOrigin?: string;
    url?: string;
    urlMoyenne?: string | null;
    urlGrande?: string | null;
    urlPetite?: string | null;
    urlPicto?: string | null;
    titleFr?: string;
    titleEn?: string;
    descriptionFr?: string;
    descriptionEn?: string;
    captionFr?: string;
    captionEn?: string;
    focusX?: number;
    focusY?: number;
    zoom?: number;
    rotation?: number;
    cropX?: number;
    cropY?: number;
    cropW?: number;
    cropH?: number;
  }[];
};

export function PreviewArticle({
  post,
  showEditorLink = true,
}: {
  post: PreviewPost;
  showEditorLink?: boolean;
}) {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const title = lang === "fr" ? post.titleFr : post.titleEn;
  const excerpt = lang === "fr" ? post.excerptFr : post.excerptEn;
  const body = lang === "fr" ? post.bodyFr : post.bodyEn;

  return (
    <article>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          {post.status === "DRAFT" && (
            <span className="mb-2 inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
              Aperçu brouillon
            </span>
          )}
          <h1 className="text-3xl font-bold text-[#0D131A]">{title}</h1>
          {excerpt && <p className="mt-2 text-lg text-[#495867]">{excerpt}</p>}
          <div className="mt-3">
            <HullBadgeList hulls={post.hulls} />
          </div>
        </div>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      {post.coverImageUrl && (
        <div className="mb-8 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImageUrl} alt="" className="w-full object-cover" />
        </div>
      )}

      <ArticleBody content={body} />

      {post.images.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">Galerie</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {post.images.map((img, i) => (
              <GalleryImage key={i} image={img} locale={lang} />
            ))}
          </div>
        </section>
      )}

      {showEditorLink && (
        <div className="mt-8">
          <Link href={`/editeur/${post.id}`} className="text-sm text-[#495867] hover:underline">
            ← Retour à l&apos;éditeur
          </Link>
        </div>
      )}
    </article>
  );
}
