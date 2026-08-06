"use client";

import type { Editor } from "@tiptap/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ARTICLE_MARKDOWN_HELP,
  htmlToMarkdown,
  markdownToHtml,
} from "@/lib/article-markdown";
import { ArticleBody } from "./ArticleBody";

type BodyEditorMode = "markdown" | "visual";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  lang: "fr" | "en";
};

function VisualToolbar({
  editor,
  lang,
}: {
  editor: Editor | null;
  lang: "fr" | "en";
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
    </div>
  );
}

function VisualEditorPane({
  markdown,
  onMarkdownChange,
  lang,
}: {
  markdown: string;
  onMarkdownChange: (md: string) => void;
  lang: "fr" | "en";
}) {
  const syncingRef = useRef(false);
  const lastExternalRef = useRef(markdown);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
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
      onMarkdownChange(htmlToMarkdown(ed.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (markdown === lastExternalRef.current) return;
    lastExternalRef.current = markdown;
    syncingRef.current = true;
    editor.commands.setContent(markdownToHtml(markdown), { emitUpdate: false });
    syncingRef.current = false;
  }, [editor, markdown]);

  return (
    <div className="overflow-hidden rounded-md border border-[#d4dde6] bg-white">
      <VisualToolbar editor={editor} lang={lang} />
      <EditorContent editor={editor} />
    </div>
  );
}

export function ArticleBodyEditor({ value, onChange, placeholder, lang }: Props) {
  const [mode, setMode] = useState<BodyEditorMode>("markdown");
  const [showPreview, setShowPreview] = useState(false);
  const visualSnapshotRef = useRef(value);

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

  const helpItems = ARTICLE_MARKDOWN_HELP[lang];

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
            </ul>
          </details>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={16}
            className="w-full rounded-md border border-[#d4dde6] px-3 py-2 font-mono text-sm leading-relaxed"
          />
          {showPreview && value.trim() && (
            <div className="rounded-md border border-dashed border-[#d4dde6] bg-white p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#495867]/70">
                {lang === "fr" ? "Aperçu public" : "Public preview"}
              </p>
              <ArticleBody content={value} />
            </div>
          )}
        </>
      ) : (
        <VisualEditorPane
          markdown={value}
          onMarkdownChange={handleVisualChange}
          lang={lang}
        />
      )}
    </div>
  );
}
