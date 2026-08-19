"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { resolveExternalLinkUrl } from "@/lib/external-link-token";
import {
  EXTERNAL_LINK_HTML_ATTR,
  EXTERNAL_LINK_HTML_INNER,
} from "@/lib/external-link-html";

export type ExternalLinkBlockMeta = {
  labelFr: string;
  labelEn: string;
  url: string | null;
  urlFr: string | null;
  urlEn: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    externalLinkBlock: {
      insertExternalLink: (linkId: string) => ReturnType;
    };
  }
}

function ExternalLinkBlockView({ node, deleteNode, selected }: NodeViewProps) {
  const { locale, t } = useLocale();
  const linkId = node.attrs.linkId as string;
  const [meta, setMeta] = useState<ExternalLinkBlockMeta | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const res = await fetch(`/api/external-links/${linkId}`);
      if (res.status === 404) {
        setMissing(true);
        setMeta(null);
        return;
      }
      if (!res.ok) {
        setMissing(true);
        return;
      }
      const data = (await res.json()) as ExternalLinkBlockMeta;
      setMeta(data);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [linkId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const label =
    meta && ((locale === "fr" ? meta.labelFr : meta.labelEn) || meta.labelFr || meta.labelEn);
  const href = meta ? resolveExternalLinkUrl(meta, locale) : "";

  const shellClass = missing
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : selected
      ? "border-[#495867] bg-[#eef3f7] ring-2 ring-[#495867]/30"
      : "border-[#495867] bg-[#eef3f7] text-[#495867] hover:bg-[#495867] hover:text-white";

  return (
    <NodeViewWrapper className="my-3">
      <div
        contentEditable={false}
        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${shellClass}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          <span aria-hidden>🔗</span>
          {loading ? (
            <span className="truncate opacity-70">{t("externalLink.loadingChip")}</span>
          ) : missing ? (
            <span className="truncate">{t("externalLink.missingChip")}</span>
          ) : (
            <span className="truncate font-medium">{label}</span>
          )}
          {!loading && !missing && href ? (
            <span className="truncate text-[11px] opacity-80 sm:text-xs">{href}</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => deleteNode()}
          className="shrink-0 rounded border border-current/30 px-2 py-0.5 text-xs opacity-80 hover:opacity-100"
          title={t("externalLink.removeFromBody")}
        >
          ×
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const ExternalLinkBlock = Node.create({
  name: "externalLinkBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      linkId: {
        default: null,
        parseHTML: (element) => element.getAttribute(EXTERNAL_LINK_HTML_ATTR),
        renderHTML: (attributes) => ({
          [EXTERNAL_LINK_HTML_ATTR]: attributes.linkId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[${EXTERNAL_LINK_HTML_ATTR}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "external-link-block" }),
      EXTERNAL_LINK_HTML_INNER,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExternalLinkBlockView);
  },

  addCommands() {
    return {
      insertExternalLink:
        (linkId: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { linkId },
          }),
    };
  },
});
