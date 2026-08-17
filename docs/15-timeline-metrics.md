# Timeline metrics & milestone periods

## Data model

### Post (`workDays`)
- Optional integer ≥ 0
- Person-days **produced** for this article
- Feeds public timeline header metric (sum of all published posts) and per-milestone produced sum

### Milestone
- `milestoneDate` — period **start** (required)
- `endDate` — period **end** (optional). `null` = **punctual deadline** jalon
- `workloadForecast` — optional planned person-days for the period

Validation: `endDate >= milestoneDate` when set.

## Timeline UI (`/timeline`)

**Header metrics**
1. Days elapsed since `PROJECT_START_DATE` (`lib/project-metrics.ts`, default `2025-01-15` = « Lancement du projet », override `NEXT_PUBLIC_PROJECT_START_DATE`). **Calendar days** at day granularity (local timezone, inclusive same-day → 0).
2. Sum of `workDays` on all **published** posts

**Milestone blocks**
- Continuous bar from start → end (or dot if punctual)
- **Current milestone** highlighted when today ∈ [start, end] (inclusive) or on punctual start day — badge « En cours »
- Dashed separator between non-contiguous milestone periods
- Linked posts shown as **steps** when `publishedAt` ∈ [start, end] (inclusive, day granularity)
- Badge: forecast days + produced days (sum of step `workDays`)

**Standalone posts** — published posts whose `publishedAt` falls outside every milestone window.

## Article ↔ jalon linking

**No explicit link.** The `PostMilestone` junction table was removed. An article appears in a jalon on `/timeline` when its `publishedAt` falls within `[milestoneDate, endDate]` (inclusive, day granularity). Punctual jalons (`endDate` null) match the start day only.

- Editor: set **publishedAt** — no jalon picker on articles
- API / Telegram: `milestones` in post responses are **inferred** from `publishedAt`, read-only
- Telegram `jalon:` sets `publishedAt` to the jalon start when no date is set

## Agent / API

- `posts.create` / `posts.update` — optional `workDays`, optional `publishedAt` (timeline placement)
- `milestones.create` / `milestones.update` — optional `endDate`, `workloadForecast`
- Telegram `systemBrief` documents timeline semantics for the Cursor agent

## Tests

- `src/test/local/timeline-metrics.test.ts` — window filtering + metrics sums
- `src/test/local/milestone-windows.test.ts` — date inference helpers

## Pre-deploy checklist

- [ ] Migration `20260817103000_drop_post_milestone` applied
- [ ] Backfill optional: set `workDays` / milestone forecasts on key content
- [ ] Verify `/timeline` metrics + one milestone with end date + articles in window
