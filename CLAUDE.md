# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Stack

Next.js 16.2 (App Router) + React 19 + Tailwind CSS 4 + Supabase (PostgreSQL + Auth + SSR).

## Architecture

### Route Structure

- `app/(public)/` — Unauthenticated pages (home, tournament list/detail, results)
- `app/admin/` — Protected pages; `app/admin/layout.tsx` handles the auth redirect
- `app/auth/login/` — Login page
- `app/api/` — API routes: `/admin/create-user`, `/tournaments/[id]`, `/divisions`, `/divisions/[id]`

### Supabase Client Pattern

Server components must use `createClientSafe()` from `lib/supabase/server.ts` — it returns `null` when env vars are absent, allowing public pages to degrade gracefully. Client components use `createClient()` from `lib/supabase/client.ts`.

`supabaseConfigured` (exported from `lib/supabase/server.ts`) is the boolean guard; check it before any Supabase call on the server if the page should be available without Supabase configured.

### Auth Flow

`proxy.ts` is the Next.js 16 replacement for `middleware.ts` — it refreshes Supabase session cookies on every request and short-circuits if Supabase isn't configured. It does **not** redirect; auth redirects live in layout files (`app/admin/layout.tsx`).

### RLS / Roles

All RLS policies use `get_my_role()` (a `SECURITY DEFINER` function in `supabase/migrations/002_fix_rls_recursion.sql`) to avoid recursive policy evaluation on `user_profiles`. Never query `user_profiles` directly inside an RLS policy.

Two roles: `system_admin` manages users and all tournaments; `tournament_admin` manages their own tournaments. All tournament data is publicly readable without auth.

### Tournament Data Model

```
tournament
  └─ division (1:N)
       └─ tournament_phase (1:N, phase_type: 'preliminary' | 'main')
            ├─ group (1:N, round-robin pools)
            │    └─ player  (assigned via player.group_id)
            └─ match (1:N, round + match_number identify position)
                  └─ match_set (set-level scores)
```

All bracket rounds are pre-created at draw time. Round 2+ matches start with null participant slots that get filled as winners advance in `app/admin/tournaments/[id]/scores/page.tsx`.

### Bracket & Scheduling Utilities

- `lib/utils/bracket.ts` — seeded single-elimination. `generateSeededBracket(ids)` returns `[p1|null, p2|null][]`; `null` means bye. `getBracketRounds(n)` and `nextPowerOfTwo(n)` are used to pre-create all rounds at once.
- `lib/utils/roundrobin.ts` — Circle method scheduling; `distributeIntoGroups(players, n)` uses snake seeding.
- `lib/utils/standings.ts` — ranks by wins → set difference → point difference.

### UI Conventions

Dark theme: `#0F172A` bg, `#3B82F6` primary, `#F97316` accent. Glass cards use the `glass` CSS utility (`rgba(255,255,255,0.05) + backdrop-blur`). Toast notifications via `sonner`. Mobile-first layout: `MobileBottomNav` on mobile, `AdminSidebar` on desktop.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # Only used in /api/admin/create-user
```

When Supabase is not configured, `app/layout.tsx` renders a `SetupBanner` with instructions instead of crashing.
