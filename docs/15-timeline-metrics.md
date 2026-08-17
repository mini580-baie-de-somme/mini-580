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

**Standalone posts** — published posts with no milestone link, listed separately.

## Agent / API

- `posts.create` / `posts.update` — optional `workDays`
- `milestones.create` / `milestones.update` — optional `endDate`, `workloadForecast`
- Telegram `systemBrief` documents timeline semantics for the Cursor agent

## Tests

- `src/test/local/timeline-metrics.test.ts` — window filtering + metrics sums

## Pre-deploy checklist

- [ ] Migration `20260815100000_workdays_milestone_timeline_crop` applied
- [ ] Backfill optional: set `workDays` / milestone forecasts on key content
- [ ] Verify `/timeline` metrics + one milestone with end date + articles in window
