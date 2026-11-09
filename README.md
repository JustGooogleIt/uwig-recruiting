# UWIG Recruiting Tracker — prototype

Interactive prototype of the UWIG recruiting platform. All people, emails, announcements, deadlines and activity are fictional. Firm names are real, including about 270 hedge funds and venture/growth firms from the exec firm list (`src/domain/firmList.ts`).

- `dist/uwig-recruiting.html` — the built single-page artifact (React 18 from cdnjs, everything else inline).
- `npm install && node build.mjs` — rebuilds it. `npx tsc -p .` type-checks.

## Structure (built to move to Next.js + Supabase)

| Path | Role | Production equivalent |
|---|---|---|
| `src/domain/types.ts` | Typed records, one interface per table | Generated Supabase types |
| `src/domain/derive.ts` | Derived views: stage, follow-ups, goals, analytics | SQL views / RPCs under RLS |
| `src/domain/mutations.ts` | Every write, with permission checks | Server actions / RPCs |
| `src/domain/permissions.ts` | Role rules | RLS policies in `docs/schema.sql` |
| `src/domain/imports.ts` | Import matching, duplicates, CSV parsing | Same code on the server; extraction becomes a server route |
| `src/domain/seed.ts` | Fictional demo club | Seed script for a staging project |
| `src/app/store.tsx` | State + `Repository` (localStorage, memory fallback) | Supabase client + server actions |
| `src/ui`, `src/pages` | React UI | App Router pages and components |
| `src/shims` | Maps imports to the CDN React global | Delete |

## What is simulated

- **Sign-in and roles**: the persona switcher is a demo control. Production uses Supabase Auth; exec controls roles; RLS enforces access.
- **Screenshot extraction**: returns fixed sample rows. Production uploads to a private bucket, extracts server-side, deletes originals after confirmation, expires abandoned uploads after 24 hours.
- **Permissions**: checked in the browser here; enforced in Postgres in production.

## Exec features added in round two

- **Announcements**: exec post opportunities and news (often from firms that reach out to the club); members save the contact, add the firm to targets or track an application from the post. No emails or notifications are sent.
- **Administration**: bulk-add firms from a pasted list (existing names are skipped), expandable mentor groups with move/add/remove, and an exec-only analyst activity ranking. Members never see a leaderboard.
- **Load demo data**: top-bar button that reloads the full fictional demo club in this browser.
- Job listings were removed; members find open roles on firm careers pages.

## Deploy

Vercel builds this repo with `npm run build` and serves `public/index.html` (see `vercel.json`). The demo stores data only in each visitor's browser; nothing is shared between people using the link.
