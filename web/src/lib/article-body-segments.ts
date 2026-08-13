import { MEDIA_GROUP_PLACEHOLDER_RE } from "@/lib/media-group-token";

export type BodySegment =
  | { type: "text"; content: string }
  | { type: "media-group"; groupId: string };

/** Split article body into markdown text and media-group placeholder segments (document order). */
export function parseArticleBodySegments(body: string): BodySegment[] {
  if (!body) return [];

  const segments: BodySegment[] = [];
  const re = new RegExp(MEDIA_GROUP_PLACEHOLDER_RE.source, "gi");
  let lastIndex = 0;

  for (const match of body.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", content: body.slice(lastIndex, index) });
    }
    segments.push({ type: "media-group", groupId: match[1] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", content: body.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", content: body });
  }

  return segments;
}
