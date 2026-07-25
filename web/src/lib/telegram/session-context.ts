import "server-only";

import { createHash } from "crypto";

/** Default context window when the runtime does not report usage (Composer-class models). */
export const DEFAULT_CONTEXT_MAX_TOKENS = 128_000;

export function getContextMaxTokens(): number {
  const raw = process.env.TELEGRAM_AGENT_CONTEXT_MAX_TOKENS?.trim();
  if (!raw) return DEFAULT_CONTEXT_MAX_TOKENS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 16_000) return DEFAULT_CONTEXT_MAX_TOKENS;
  return n;
}

export function getCompactHighRatio(): number {
  const raw = process.env.TELEGRAM_AGENT_COMPACT_HIGH_RATIO?.trim();
  if (!raw) return 0.7;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return 0.7;
  return n;
}

export function getCompactTargetRatio(): number {
  const raw = process.env.TELEGRAM_AGENT_COMPACT_TARGET_RATIO?.trim();
  if (!raw) return 0.2;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return 0.2;
  return n;
}

export function compactTriggerTokens(maxTokens = getContextMaxTokens()): number {
  return Math.floor(maxTokens * getCompactHighRatio());
}

export function shouldCompactSession(
  lastTurnInputTokens: number | null | undefined,
  maxTokens = getContextMaxTokens()
): boolean {
  if (lastTurnInputTokens == null || lastTurnInputTokens <= 0) return false;
  return lastTurnInputTokens >= compactTriggerTokens(maxTokens);
}

export function hashMemoryBrief(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

export function buildBootstrapUserMessage(input: {
  systemBrief: string;
  memoryBrief: string;
  activeContext: string;
  sessionSummary?: string | null;
  siteUrl?: string | null;
}): string {
  const siteLine = input.siteUrl?.trim()
    ? `SITE_URL=${input.siteUrl.trim()}`
    : "SITE_URL=(voir env déploiement)";

  const summaryBlock = input.sessionSummary?.trim()
    ? `\n\nSynthèse de la session Telegram précédente (continuité — ne pas répéter mot pour mot à l'utilisateur) :\n${input.sessionSummary.trim()}`
    : "";

  return `${input.systemBrief.trim()}

${input.memoryBrief.trim()}

${input.activeContext.trim()}

${siteLine}${summaryBlock}

---
Session initialisée. Les prochains messages utilisateur arriveront seuls (sans re-coller ce brief). Utilise agent_memory.* si une règle persistante manque ou change.`;
}

export function buildTurnUserMessage(input: {
  userMessage: string;
  mediaUrls?: string[];
  activeContext: string;
  memoryBrief?: string | null;
}): string {
  const mediaBlock =
    input.mediaUrls && input.mediaUrls.length
      ? `\n\nMédias Telegram (URLs publiques):\n${input.mediaUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
      : "";

  const memoryRefresh = input.memoryBrief?.trim()
    ? `\n\n${input.memoryBrief.trim()}\n`
    : "";

  return `${memoryRefresh}${input.activeContext.trim()}

---
Message utilisateur:
${input.userMessage}${mediaBlock}`;
}

export const SESSION_COMPACT_USER_PROMPT = `Tâche interne de compaction (ne pas répondre à l'utilisateur Telegram).

Résume la conversation Class Mini 580 jusqu'ici en français, compact, factuel, pour repartir avec ~20% du budget contexte au lieu de >70%.

Structure obligatoire :
1. Sujet / objectif en cours
2. postId / mediaId actifs et entités touchées (articles, jalons, tags…)
3. Décisions prises et actions déjà exécutées (tools, statuts publish/archive)
4. Points en attente ou questions ouvertes
5. Erreurs ou blocages rencontrés

Interdit : copier des dumps JSON complets, relister tous les tools, inventer des ids.
Longueur cible : 800–2000 mots max.`;
