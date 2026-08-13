"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

import {
  MEDIA_GROUP_UPDATED_EVENT,
  mediaGroupIdHint,
  resolveMediaGroupDisplayName,
} from "@/lib/media-group-display";
import {
  MEDIA_GROUP_HTML_ATTR,
  MEDIA_GROUP_HTML_INNER,
} from "@/lib/media-group-html";

export type MediaGroupBlockMeta = {
  titleFr: string;
  titleEn: string;
  slug: string;
  memberCount: number;
  layout: "GRID" | "ROW" | "SINGLE";
};

export type MediaGroupBlockOptions = {
  onEditGroup?: (groupId: string) => void;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mediaGroupBlock: {
      insertMediaGroup: (groupId: string) => ReturnType;
    };
  }
}

function layoutLabel(
  layout: MediaGroupBlockMeta["layout"],
  locale: "fr" | "en"
): string {
  const labels = {
    GRID: { fr: "Grille", en: "Grid" },
    ROW: { fr: "Ligne", en: "Row" },
    SINGLE: { fr: "Simple", en: "Single" },
  };
  return labels[layout][locale];
}

function MediaGroupBlockView({ node, deleteNode, selected, extension }: NodeViewProps) {
  const { locale, t } = useLocale();
  const groupId = node.attrs.groupId as string;
  const onEditGroup = (extension.options as MediaGroupBlockOptions).onEditGroup;
  const [meta, setMeta] = useState<MediaGroupBlockMeta | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const res = await fetch(`/api/media-groups/${groupId}`);
      if (res.status === 404) {
        setMissing(true);
        setMeta(null);
        return;
      }
      if (!res.ok) {
        setMissing(true);
        return;
      }
      const data = (await res.json()) as MediaGroupBlockMeta;
      setMeta(data);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ groupId?: string }>).detail;
      if (detail?.groupId === groupId) void loadMeta();
    };
    window.addEventListener(MEDIA_GROUP_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(MEDIA_GROUP_UPDATED_EVENT, onUpdated);
  }, [groupId, loadMeta]);

  const displayName =
    meta && resolveMediaGroupDisplayName(meta, locale, groupId);
  const idHint = mediaGroupIdHint(groupId);

  const countLabel =
    meta &&
    (locale === "fr"
      ? `${meta.memberCount} média${meta.memberCount !== 1 ? "s" : ""}`
      : `${meta.memberCount} media item${meta.memberCount !== 1 ? "s" : ""}`);

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
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onEditGroup?.(groupId)}
          title={t("mediaGroup.edit")}
        >
          <span aria-hidden>📷</span>
          {loading ? (
            <span className="truncate opacity-70">{t("mediaGroup.loadingChip")}</span>
          ) : missing ? (
            <span className="truncate">{t("mediaGroup.missingChip")}</span>
          ) : (
            <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-1">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-[11px] opacity-80 sm:text-xs">
                {countLabel ? `${countLabel}` : null}
                {meta ? ` · ${layoutLabel(meta.layout, locale)}` : null}
                <span className="font-mono"> · #{idHint}</span>
              </span>
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => deleteNode()}
          className="shrink-0 rounded border border-current/30 px-2 py-0.5 text-xs opacity-80 hover:opacity-100"
          title={t("mediaGroup.removeFromBody")}
        >
          ×
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const MediaGroupBlock = Node.create<MediaGroupBlockOptions>({
  name: "mediaGroupBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      onEditGroup: undefined,
    };
  },

  addAttributes() {
    return {
      groupId: {
        default: null,
        parseHTML: (element) => element.getAttribute(MEDIA_GROUP_HTML_ATTR),
        renderHTML: (attributes) => ({
          [MEDIA_GROUP_HTML_ATTR]: attributes.groupId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[${MEDIA_GROUP_HTML_ATTR}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "media-group-block" }),
      MEDIA_GROUP_HTML_INNER,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaGroupBlockView);
  },

  addCommands() {
    return {
      insertMediaGroup:
        (groupId: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { groupId },
          }),
    };
  },
});
