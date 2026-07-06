## Goal

Rebuild BidArena's backend (schema + security + bidding engine + scheduled cleanup) and update the admin UI so team invites work via a copy-link flow, tournament settings are fully editable, and team rosters/spend are visible.

## Important deviations from the spec (please confirm)

1. **No Supabase Edge Functions.** This project runs on TanStack Start. The platform rule is: app-internal server logic must be `createServerFn` (not Edge Functions). I will implement `place-bid` and `close-lot` as TanStack server functions / server routes instead. Behavior, validation, locking, and rate-limiting will match the spec exactly. `close-lot` will be exposed at `/api/public/cron/close-lot` and called by `pg_cron` via `pg_net` every 5 seconds.
2. **No Upstash Redis** (would need a paid external service + new secret). Rate limit (3 calls / user / 10s) will be enforced inside the database via a small `bid_rate_limit` table checked atomically in the `place_bid` RPC. Same guarantee, no extra infra.
3. **Schema migration is destructive.** The current tables (`tournaments`, `teams`, `players`, `bids`, `auction_state`) already exist with different columns (e.g. `purse_amount` vs `purse_per_team`, `owner_user_id` vs `owner_id`, `spectator_slug`, enum types). I will **drop and recreate** them per your spec. **All existing tournament data will be lost.** Confirm this is OK.
4. `**admin_allowlist**` – currently anyone signing up gets the `tournament_admin` role automatically. I'll switch to: signup only grants admin if their email is in `admin_allowlist`. You'll need to seed your own email first or I can keep open signup — tell me which.
5. **20-day auto-delete of past tournaments** will be a `pg_cron` job that deletes tournaments where `status='completed'` and `created_at < now() - interval '20 days'` (cascades to teams/players/bids).

## Work breakdown

### Phase 1 — Database (one migration)

- Drop existing schema (tournaments, teams, players, bids, auction_state, related enums/functions).
- Create new tables exactly per spec: `tournaments`, `teams`, `players`, `bids`, `auction_state`, `audit_log`, `invite_tokens`, `admin_allowlist`, plus `bid_sequence` and `bid_rate_limit`.
- All RLS policies as specified (public read for live/upcoming/completed; admin-scoped writes; bids/auction_state/audit_log writes only via SECURITY DEFINER RPCs).
- Indexes as specified.
- `place_bid(tournament_id, player_id, team_id)` SECURITY DEFINER RPC: locks `auction_state` `FOR UPDATE`, validates everything in spec steps 3–9, enforces 3/10s rate limit, writes bid + updates state + audit log, returns `{success, new_bid_amount, timer_ends_at}`.
- `close_expired_lots()` SECURITY DEFINER function: spec steps 2–6.
- `pg_cron` jobs:
  - Every 5s: `SELECT close_expired_lots();` (pure SQL, no HTTP hop needed — faster and simpler than calling an endpoint).
  - Daily 03:00: delete completed tournaments older than 20 days.
- Trigger on `auth.users` insert: create profile + grant `tournament_admin` role only if email is in `admin_allowlist`.

### Phase 2 — Realtime

- `ALTER PUBLICATION supabase_realtime ADD TABLE auction_state, bids, players;` so spectator/team views update live.

### Phase 3 — Admin UI (`/admin/$id`)

- Remove temp password field; "Add team" form keeps only **Team name**, **Owner name**, **Owner email**.
- "Create login" button → **"Copy invite link"** button. Generates an `invite_tokens` row and copies `https://<site>/invite/<token>` to clipboard (also WhatsApp share button).
- Each team card shows: team logo/name, owner, remaining purse, and a list of players bought with their sold price.
- New **"Tournament settings"** panel: edit name, purse_per_team, min_bid_increment, bid_timer_seconds, max_players_per_team, starts_at, status.
- Player management: add/edit/delete players, set base_price, role, photo, auction_order.

### Phase 4 — Invite flow

- New route `/invite/$token`: shows team info, prompts owner to sign up (or log in if existing). On success, sets `teams.owner_id = auth.uid()` and marks token used. Redirects to `/team/$id`.

### Phase 5 — Owner / spectator / dashboard

- `/team/$id`: keep "Raise hand" bid button; call new `place_bid` RPC.
- `/dashboard` (logged-in landing): same layout as public `/` (Ongoing / Upcoming / Past with search), plus an "Admin" section if user owns tournaments.
- Password reset: add "Forgot password?" on `/auth` + new `/reset-password` route.

### Phase 6 — Verification

- Run linter, smoke-test bidding via `read_query`, confirm `pg_cron` jobs scheduled.

## Technical notes

- `place_bid` is a Postgres function (not Edge Function), called from the client via `supabase.rpc('place_bid', ...)`. Race conditions handled by `SELECT ... FOR UPDATE` on `auction_state`. Authorization handled inside the function via `auth.uid()`.
- Rate limit table: `(user_id, window_start)` with row count; cleaned opportunistically.
- Cron close-lot in pure SQL avoids an extra network hop and avoids needing to expose a public endpoint.

## Please confirm before I start

1. **OK to wipe all existing tournament data?** Yes
2. **Admin allowlist** — seed your email and require allowlist for new admins? Or keep open signup? If allowlist, what email?Allowlist — seed with your email
3. **OK with `place-bid` as a Postgres RPC** instead of an Edge Function (same guarantees, simpler)?Yes, preferred
4. **OK with DB-based rate limit** instead of Upstash Redis?Yes