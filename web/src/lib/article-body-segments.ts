import { EXTERNAL_LINK_TOKEN_RE } from "@/lib/external-link-token";
import { MEDIA_GROUP_PLACEHOLDER_RE } from "@/lib/media-group-token";

export type BodySegment =
  | { type: "text"; content: string }
  | { type: "media-group"; groupId: string }
  | { type: "external-link"; linkId: string };

type TokenMatch =
  | { index: number; length: number; type: "media-group"; id: string }
  | { index: number; length: number; type: "external-link"; id: string };

function findBodyTokens(body: string): TokenMatch[] {
  const matches: TokenMatch[] = [];

  for (const match of body.matchAll(
    new RegExp(MEDIA_GROUP_PLACEHOLDER_RE.source, "gi")
  )) {
    matches.push({
      index: match.index ?? 0,
      length: match[0].length,
      type: "media-group",
      id: match[1],
    });
  }

  for (const match of body.matchAll(
    new RegExp(EXTERNAL_LINK_TOKEN_RE.source, "gi")
  )) {
    matches.push({
      index: match.index ?? 0,
      length: match[0].length,
      type: "external-link",
      id: match[1],
    });
  }

  matches.sort((a, b) => a.index - b.index);
  return matches;
}

/** Split article body into markdown text and inline placeholder segments (document order). */
export function parseArticleBodySegments(body: string): BodySegment[] {
  if (!body) return [];

  const tokens = findBodyTokens(body);
  if (tokens.length === 0) {
    return [{ type: "text", content: body }];
  }

  const segments: BodySegment[] = [];
  let lastIndex = 0;

  for (const token of tokens) {
    if (token.index > lastIndex) {
      segments.push({ type: "text", content: body.slice(lastIndex, token.index) });
    }
    if (token.type === "media-group") {
      segments.push({ type: "media-group", groupId: token.id });
    } else {
      segments.push({ type: "external-link", linkId: token.id });
    }
    lastIndex = token.index + token.length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", content: body.slice(lastIndex) });
  }

  return segments;
}
