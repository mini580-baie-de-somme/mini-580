"use client";

import type { Editor } from "@tiptap/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  ARTICLE_MARKDOWN_HELP,
  htmlToMarkdown,
  markdownToHtml,
} from "@/lib/article-markdown";
import {
  cleanMediaGroupTokens,
  mediaGroupPlaceholder,
} from "@/lib/media-group-token";
import { externalLinkPlaceholder } from "@/lib/external-link-token";
import { shouldApplyParentMarkdownToVisualEditor } from "@/lib/visual-editor-markdown-sync";
import { useMediaGroupBodyEnrichment } from "@/hooks/useMediaGroupBodyEnrichment";
import { ExternalLinkBlock } from "@/lib/tiptap/external-link-block";
import { MediaGroupBlock } from "@/lib/tiptap/media-group-block";
import { ArticleBody } from "./ArticleBody";
import { ExternalLinkPicker } from "./ExternalLinkPicker";
import { MediaGroupPicker } from "./MediaGroupPicker";

type BodyEditorMode = "markdown" | "visual";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  lang: "fr" | "en";
  onEditGroup?: (groupId: string) => void;
};

function VisualToolbar({
  editor,
  lang,
  onInsertGroup,
  onInsertLink,
}: {
  editor: Editor | null;
  lang: "fr" | "en";
  onInsertGroup: () => void;
  onInsertLink: () => void;
}) {
  if (!editor) return null;

  const btn = (active: boolean) =>
    `rounded border px-2 py-1 text-xs ${
      active
        ? "border-[#495867] bg-[#495867] text-white"
        : "border-[#d4dde6] bg-white text-[#495867] hover:bg-[#f4f7fa]"
    }`;

  return (
    <div className="flex flex-wrap gap-1 border-b border-[#d4dde6] bg-[#f4f7fa] px-2 py-1.5">
      <button
        type="button"
        className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title={lang === "fr" ? "Gras" : "Bold"}
      >
        B
      </button>
      <button
        type="button"
        className={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title={lang === "fr" ? "Titre" : "Heading"}
      >
        H2
      </button>
      <button
        type="button"
        className={btn(editor.isActive("heading", { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>
      <button
        type="button"
        className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title={lang === "fr" ? "Liste à puces" : "Bullet list"}
      >
        •
      </button>
      <button
        type="button"
        className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title={lang === "fr" ? "Liste numérotée" : "Numbered list"}
      >
        1.
      </button>
      <span className="mx-1 w-px self-stretch bg-[#d4dde6]" aria-hidden />
      <button
        type="button"
        className="rounded border border-[#495867] bg-white px-2 py-1 text-xs text-[#495867] hover:bg-[#495867] hover:text-white"
        onClick={onInsertGroup}
        title={lang === "fr" ? "Insérer un groupe" : "Insert group"}
      >
        📷 {lang === "fr" ? "Groupe" : "Group"}
      </button>
      <button
        type="button"
        className="rounded border border-[#495867] bg-white px-2 py-1 text-xs text-[#495867] hover:bg-[#495867] hover:text-white"
        onClick={onInsertLink}
        title={lang === "fr" ? "Insérer un lien" : "Insert link"}
      >
        🔗 {lang === "fr" ? "Lien" : "Link"}
      </button>
    </div>
  );
}

function VisualEditorPane({
  markdown,
  onMarkdownChange,
  lang,
  onEditGroup,
  pickerOpen,
  onPickerOpenChange,
  linkPickerOpen,
  onLinkPickerOpenChange,
  pendingInsertRef,
  pendingLinkInsertRef,
}: {
  markdown: string;
  onMarkdownChange: (md: string) => void;
  lang: "fr" | "en";
  onEditGroup?: (groupId: string) => void;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  linkPickerOpen: boolean;
  onLinkPickerOpenChange: (open: boolean) => void;
  pendingInsertRef: MutableRefObject<((groupId: string) => void) | null>;
  pendingLinkInsertRef: MutableRefObject<((linkId: string) => void) | null>;
}) {
  const syncingRef = useRef(false);
  const lastExternalRef = useRef(markdown);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      MediaGroupBlock.configure({
        onEditGroup,
      }),
      ExternalLinkBlock,
    ],
    content: markdownToHtml(markdown),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none min-h-[20rem] px-3 py-2 text-sm leading-relaxed focus:outline-none prose-headings:text-[#0D131A] prose-p:text-[#0D131A]/90",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (syncingRef.current) return;
      const md = htmlToMarkdown(ed.getHTML());
      // Parent re-renders with this markdown; mark it as local so the sync
      // effect below does not call setContent() and reset the caret.
      lastExternalRef.current = md;
      onMarkdownChange(md);
    },
  });

  useEffect(() => {
    if (!editor) return;
    pendingInsertRef.current = (groupId: string) => {
      editor.chain().focus().insertMediaGroup(groupId).run();
    };
    pendingLinkInsertRef.current = (linkId: string) => {
      editor.chain().focus().insertExternalLink(linkId).run();
    };
    return () => {
      pendingInsertRef.current = null;
      pendingLinkInsertRef.current = null;
    };
  }, [editor, pendingInsertRef, pendingLinkInsertRef]);

  useEffect(() => {
    if (!editor) return;
    if (!shouldApplyParentMarkdownToVisualEditor(lastExternalRef.current, markdown)) {
      return;
    }
    lastExternalRef.current = markdown;
    syncingRef.current = true;
    editor.commands.setContent(markdownToHtml(markdown), { emitUpdate: false });
    syncingRef.current = false;
  }, [editor, markdown]);

  return (
    <>
      <div className="overflow-hidden rounded-md border border-[#d4dde6] bg-white">
        <VisualToolbar
          editor={editor}
          lang={lang}
          onInsertGroup={() => onPickerOpenChange(true)}
          onInsertLink={() => onLinkPickerOpenChange(true)}
        />
        <EditorContent editor={editor} />
      </div>
      <MediaGroupPicker
        open={pickerOpen}
        onClose={() => onPickerOpenChange(false)}
        onSelect={(groupId) => pendingInsertRef.current?.(groupId)}
      />
      <ExternalLinkPicker
        open={linkPickerOpen}
        onClose={() => onLinkPickerOpenChange(false)}
        onSelect={(linkId) => pendingLinkInsertRef.current?.(linkId)}
      />
    </>
  );
}

export function ArticleBodyEditor({
  value,
  onChange,
  placeholder,
  lang,
  onEditGroup,
}: Props) {
  const [mode, setMode] = useState<BodyEditorMode>("markdown");
  const [showPreview, setShowPreview] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const visualSnapshotRef = useRef(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingInsertRef = useRef<((groupId: string) => void) | null>(null);
  const pendingLinkInsertRef = useRef<((linkId: string) => void) | null>(null);

  const switchMode = useCallback(
    (next: BodyEditorMode) => {
      if (next === mode) return;
      if (next === "markdown") {
        onChange(visualSnapshotRef.current);
      } else {
        visualSnapshotRef.current = value;
      }
      setMode(next);
    },
    [mode, onChange, value]
  );

  const handleVisualChange = useCallback(
    (md: string) => {
      visualSnapshotRef.current = md;
      onChange(md);
    },
    [onChange]
  );

  const insertGroupInMarkdown = useCallback(
    (groupId: string) => {
      const token = `\n\n${mediaGroupPlaceholder(groupId)}\n\n`;
      const el = textareaRef.current;
      if (!el) {
        onChange(`${value.trim()}${token}`.trim());
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        const pos = start + token.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [onChange, value]
  );

  const insertLinkInMarkdown = useCallback(
    (linkId: string) => {
      const token = `\n\n${externalLinkPlaceholder(linkId)}\n\n`;
      const el = textareaRef.current;
      if (!el) {
        onChange(`${value.trim()}${token}`.trim());
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        const pos = start + token.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [onChange, value]
  );

  const handlePickerSelect = useCallback(
    (groupId: string) => {
      if (mode === "visual") {
        pendingInsertRef.current?.(groupId);
      } else {
        insertGroupInMarkdown(groupId);
      }
    },
    [insertGroupInMarkdown, mode]
  );

  const handleLinkPickerSelect = useCallback(
    (linkId: string) => {
      if (mode === "visual") {
        pendingLinkInsertRef.current?.(linkId);
      } else {
        insertLinkInMarkdown(linkId);
      }
    },
    [insertLinkInMarkdown, mode]
  );

  const handleBodyEnriched = useCallback(
    (next: string) => {
      onChange(next);
    },
    [onChange]
  );

  useMediaGroupBodyEnrichment(
    mode === "markdown" ? value : "",
    lang,
    handleBodyEnriched
  );

  const helpItems = ARTICLE_MARKDOWN_HELP[lang];
  const previewContent = cleanMediaGroupTokens(value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-[#d4dde6] bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => switchMode("markdown")}
            className={`rounded px-3 py-1.5 ${
              mode === "markdown"
                ? "bg-[#495867] text-white"
                : "text-[#495867] hover:bg-[#f4f7fa]"
            }`}
          >
            {lang === "fr" ? "Markdown" : "Markdown"}
          </button>
          <button
            type="button"
            onClick={() => switchMode("visual")}
            className={`rounded px-3 py-1.5 ${
              mode === "visual"
                ? "bg-[#495867] text-white"
                : "text-[#495867] hover:bg-[#f4f7fa]"
            }`}
          >
            {lang === "fr" ? "Visuel" : "Visual"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded border border-[#495867] bg-white px-2 py-1 text-xs text-[#495867] hover:bg-[#495867] hover:text-white"
          >
            📷 {lang === "fr" ? "Insérer un groupe" : "Insert group"}
          </button>
          <button
            type="button"
            onClick={() => setLinkPickerOpen(true)}
            className="rounded border border-[#495867] bg-white px-2 py-1 text-xs text-[#495867] hover:bg-[#495867] hover:text-white"
          >
            🔗 {lang === "fr" ? "Insérer un lien" : "Insert link"}
          </button>
          {mode === "markdown" && (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs text-[#495867] underline hover:no-underline"
            >
              {showPreview
                ? lang === "fr"
                  ? "Masquer l’aperçu"
                  : "Hide preview"
                : lang === "fr"
                  ? "Aperçu rendu"
                  : "Rendered preview"}
            </button>
          )}
        </div>
      </div>

      {mode === "markdown" ? (
        <>
          <details className="rounded-md border border-[#d4dde6] bg-[#f4f7fa] px-3 py-2 text-xs text-[#495867]">
            <summary className="cursor-pointer font-medium">
              {lang === "fr" ? "Balises Markdown supportées" : "Supported Markdown syntax"}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {helpItems.map((line) => (
                <li key={line}>
                  <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">
                    {line.split(" — ")[0]}
                  </code>
                  {line.includes(" — ") ? ` — ${line.split(" — ").slice(1).join(" — ")}` : null}
                </li>
              ))}
              <li>
                {lang === "fr"
                  ? "Groupes — bouton « Insérer un groupe » ; le nom et le nombre de médias s’ajoutent automatiquement dans la balise (seul l’id est enregistré)"
                  : "Media groups — “Insert group” button; name and count appear in the tag automatically (only the id is saved)"}
              </li>
            </ul>
          </details>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={16}
            className="w-full rounded-md border border-[#d4dde6] px-3 py-2 font-mono text-sm leading-relaxed"
          />
          {showPreview && previewContent.trim() && (
            <div className="rounded-md border border-dashed border-[#d4dde6] bg-white p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#495867]/70">
                {lang === "fr" ? "Aperçu public" : "Public preview"}
              </p>
              <ArticleBody content={previewContent} locale={lang} />
            </div>
          )}
          <MediaGroupPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={handlePickerSelect}
          />
          <ExternalLinkPicker
            open={linkPickerOpen}
            onClose={() => setLinkPickerOpen(false)}
            onSelect={handleLinkPickerSelect}
          />
        </>
      ) : (
        <VisualEditorPane
          markdown={value}
          onMarkdownChange={handleVisualChange}
          lang={lang}
          onEditGroup={onEditGroup}
          pickerOpen={pickerOpen}
          onPickerOpenChange={setPickerOpen}
          linkPickerOpen={linkPickerOpen}
          onLinkPickerOpenChange={setLinkPickerOpen}
          pendingInsertRef={pendingInsertRef}
          pendingLinkInsertRef={pendingLinkInsertRef}
        />
      )}
    </div>
  );
}
