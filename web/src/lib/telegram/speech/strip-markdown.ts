/** Plain text for TTS — strip common Markdown/Telegram formatting. */
export function stripMarkdownForTts(text: string): string {
  return text
    .replace(/\[\[tts:text\]\]/gi, "")
    .replace(/\[\[\/tts:text\]\]/gi, "")
    .replace(/\[\[tts:[^\]]+\]\]/gi, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
