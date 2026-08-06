"use client";

type Lang = "fr" | "en";

export function LangToggle({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-[#d4dde6] bg-white p-0.5 text-sm">
      <button
        type="button"
        onClick={() => onChange("fr")}
        className={`rounded px-3 py-1.5 ${lang === "fr" ? "bg-[#495867] text-white" : "text-[#495867]"}`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => onChange("en")}
        className={`rounded px-3 py-1.5 ${lang === "en" ? "bg-[#495867] text-white" : "text-[#495867]"}`}
      >
        EN
      </button>
    </div>
  );
}

