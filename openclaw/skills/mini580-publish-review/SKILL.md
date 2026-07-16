---
name: mini580-publish-review
description: >-
  Agent Telegram outillé (Cursor customTools → AI_TOOLS HTTP) pour CRUD plateforme,
  médiathèque, previews ; plus parcours guidé /nouveau (FSM).
---

# Class Mini 5.80 — Agent Telegram + tools plateforme

## Deux modes

| Mode | Entrée | Comportement |
|------|--------|--------------|
| **Agent** (défaut) | Message libre / photo | Cursor Agent + `customTools` = catalogue `AI_TOOLS` |
| **Guidé** | `/nouveau` | FSM validation FR→EN→preview→photos (`publish-flow.ts`) |

## Runtime

- Webhook : `POST /api/telegram/webhook`
- Agent : `web/src/lib/telegram/agent.ts` (`Agent.create` / `resume` + tools)
- Exécuteur : `web/src/lib/ai-tools-runtime.ts` → `fetch(INTERNAL_API_BASE + path)` + `Bearer INGEST_API_KEY`
- Catalogue : `web/src/lib/ai-tools.ts`

## Tools exposés à l'agent

Posts (list/get/create/update/delete/publish/archive/preview), gallery, photos (list/upload/patch/reorder/replace/delete), media.put, tags, themes, milestones, translate.

Sync OTP exclu du bot Telegram.

## Commandes

`/aide` · `/nouveau` · `/annuler` · `/statut` · `/reset` · `/traduire` (FSM)

## Auth machine

`INGEST_API_KEY` + `CURSOR_API_KEY` + allowlist `TELEGRAM_ALLOWED_USER_IDS`.
