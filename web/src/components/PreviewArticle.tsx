"use client";

import Link from "next/link";
import { useState } from "react";
import type { HullId } from "@/lib/types";
import { resolveThumbKind } from "@/lib/media-file-client";
import { GalleryImage } from "./GalleryImage";
import { LangToggle, ArticleBody } from "./LangToggle";
import { HullBadgeList } from "./HullBadge";
import { MediaKindThumb } from "./MediaKindThumb";
import { MediaSlideshow, useMediaSlideshow } from "./MediaSlideshow";

type PreviewImage = {
  id?: string;
  kind?: string | null;
  mimeType?: string | null;
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
};

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
  images: PreviewImage[];
};

function imageSrc(img: PreviewImage): string {
  return (
    img.urlPetite ||
    img.urlPicto ||
    img.urlMoyenne ||
    img.urlOrigin ||
    img.url ||
    ""
  );
}

export function PreviewArticle({
  post,
  showEditorLink = true,
}: {
  post: PreviewPost;
  showEditorLink?: boolean;
}) {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const slideshow = useMediaSlideshow();
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Médias</h2>
            {post.images.length > 1 && (
              <button
                type="button"
                onClick={() => slideshow.startSlideshow(0)}
                className="rounded-md border border-[#495867] bg-[#495867] px-3 py-1.5 text-sm text-white hover:bg-[#3a4654]"
              >
                Lancer le diaporama
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {post.images.map((img, i) => {
              const displayKind = resolveThumbKind(
                img.kind,
                img.mimeType,
                img.urlOrigin || img.url
              );
              const src = imageSrc(img);
              const label =
                (lang === "fr" ? img.titleFr : img.titleEn) || "Sans titre";
              return (
                <button
                  key={img.id ?? i}
                  type="button"
                  onClick={() => slideshow.openViewer(i)}
                  className="w-full text-left transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#495867] focus-visible:ring-offset-2"
                >
                  {displayKind === "IMAGE" && src ? (
                    <GalleryImage image={img} locale={lang} />
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white shadow-sm">
                      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-[#eef3f7] text-[#495867]">
                        <MediaKindThumb
                          kind={displayKind}
                          mimeType={img.mimeType}
                          src={null}
                          size="md"
                          className="h-16 w-16 bg-transparent"
                        />
                        <span className="text-xs uppercase tracking-wide">
                          {displayKind === "DOCUMENT" ? "PDF" : "Vidéo"}
                        </span>
                      </div>
                      <div className="px-4 py-3 text-sm text-[#495867]">
                        <div className="font-medium text-[#0D131A]">{label}</div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <MediaSlideshow
        items={post.images}
        open={slideshow.open}
        initialIndex={slideshow.initialIndex}
        initialAutoPlay={slideshow.initialAutoPlay}
        onClose={slideshow.close}
        locale={lang}
      />

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
