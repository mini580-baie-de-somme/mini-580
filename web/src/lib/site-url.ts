import "server-only";

/** Public site origin for shareable links (blog, preview tokens). Not INTERNAL_API_BASE. */
export function getPublicSiteBaseUrl(): string {
  return (
    process.env.SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3002"
  );
}

export function blogPathForSlug(slug: string): string {
  return `/blog/${slug}`;
}

export function publicBlogUrlForSlug(slug: string): string {
  return `${getPublicSiteBaseUrl()}${blogPathForSlug(slug)}`;
}
