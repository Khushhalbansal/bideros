-- MIGRATION: 20260521111450_42442572-21aa-4f6a-a547-7777fe3cb0b2.sql --


-- Roles enum & table
CREATE TYPE public.app_role AS ENUM ('super_admin', 'tournament_admin', 'team_owner');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default tournament_admin role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  -- default everyone to tournament_admin so they can create their own tournament
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tournament_admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tournaments
CREATE TYPE public.tournament_status AS ENUM ('setup', 'live', 'paused', 'ended');

CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purse_amount BIGINT NOT NULL DEFAULT 10000000, -- in rupees
  squad_size INT NOT NULL DEFAULT 11,
  bid_increment BIGINT NOT NULL DEFAULT 100000,
  status tournament_status NOT NULL DEFAULT 'setup',
  spectator_slug TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_email TEXT,
  purse_remaining BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX idx_teams_owner ON public.teams(owner_user_id);

-- Players
CREATE TYPE public.player_category AS ENUM ('iconic', 'normal');
CREATE TYPE public.player_status AS ENUM ('available', 'sold', 'unsold');

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT, -- batter, bowler, all-rounder, wk
  photo_url TEXT,
  base_price BIGINT NOT NULL DEFAULT 100000,
  category player_category NOT NULL DEFAULT 'normal',
  status player_status NOT NULL DEFAULT 'available',
  sold_to_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  sold_price BIGINT,
  stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_tournament ON public.players(tournament_id);
CREATE INDEX idx_players_status ON public.players(tournament_id, status);

-- Auction state (singleton per tournament)
CREATE TYPE public.auction_phase AS ENUM ('idle', 'live', 'sold_animation');

CREATE TABLE public.auction_state (
  tournament_id UUID PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  current_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  current_bid BIGINT,
  leading_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  phase auction_phase NOT NULL DEFAULT 'idle',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bids log
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  bidder_user_id UUID REFERENCES auth.users(id),
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bids_player ON public.bids(player_id, created_at DESC);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles readable by all auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Roles
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Tournaments: public read (for spectator), admin write
CREATE POLICY "Tournaments public read" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admin creates tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "Admin updates own tournament" ON public.tournaments FOR UPDATE TO authenticated USING (auth.uid() = admin_id);
CREATE POLICY "Admin deletes own tournament" ON public.tournaments FOR DELETE TO authenticated USING (auth.uid() = admin_id);

-- Teams: public read, admin write
CREATE POLICY "Teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admin manages teams" ON public.teams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()));

-- Players: public read, admin write
CREATE POLICY "Players public read" ON public.players FOR SELECT USING (true);
CREATE POLICY "Admin manages players" ON public.players FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()));

-- Auction state: public read, admin write
CREATE POLICY "Auction state public read" ON public.auction_state FOR SELECT USING (true);
CREATE POLICY "Admin manages auction state" ON public.auction_state FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()));

-- Bids: public read (history)
CREATE POLICY "Bids public read" ON public.bids FOR SELECT USING (true);
-- No direct INSERT — must go through place_bid RPC

-- Atomic bid function with row lock
CREATE OR REPLACE FUNCTION public.place_bid(
  p_tournament UUID,
  p_team UUID,
  p_amount BIGINT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state auction_state%ROWTYPE;
  v_team teams%ROWTYPE;
  v_player players%ROWTYPE;
  v_min_next BIGINT;
  v_tournament tournaments%ROWTYPE;
BEGIN
  -- Lock auction state row
  SELECT * INTO v_state FROM auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF NOT FOUND OR v_state.phase <> 'live' OR v_state.current_player_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No live auction');
  END IF;

  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament;
  SELECT * INTO v_team FROM teams WHERE id = p_team AND tournament_id = p_tournament;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Team not in tournament');
  END IF;

  -- Auth: caller must be the team owner
  IF v_team.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your team');
  END IF;

  -- Don't allow self-overbid (already leading)
  IF v_state.leading_team_id = p_team THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are already leading');
  END IF;

  SELECT * INTO v_player FROM players WHERE id = v_state.current_player_id;

  -- Min next bid
  IF v_state.current_bid IS NULL THEN
    v_min_next := v_player.base_price;
  ELSE
    v_min_next := v_state.current_bid + v_tournament.bid_increment;
  END IF;

  IF p_amount < v_min_next THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bid too low', 'min', v_min_next);
  END IF;

  IF p_amount > v_team.purse_remaining THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient purse');
  END IF;

  -- Update state
  UPDATE auction_state
    SET current_bid = p_amount, leading_team_id = p_team, updated_at = now()
    WHERE tournament_id = p_tournament;

  INSERT INTO bids (tournament_id, player_id, team_id, bidder_user_id, amount)
    VALUES (p_tournament, v_state.current_player_id, p_team, auth.uid(), p_amount);

  RETURN jsonb_build_object('ok', true, 'amount', p_amount);
END; $$;

-- Sell current player (admin only)
CREATE OR REPLACE FUNCTION public.sell_current_player(p_tournament UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state auction_state%ROWTYPE;
  v_tournament tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament;
  IF v_tournament.admin_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not admin');
  END IF;

  SELECT * INTO v_state FROM auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.current_player_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active player');
  END IF;

  IF v_state.leading_team_id IS NULL THEN
    -- mark unsold
    UPDATE players SET status = 'unsold' WHERE id = v_state.current_player_id;
  ELSE
    UPDATE players SET status = 'sold', sold_to_team_id = v_state.leading_team_id, sold_price = v_state.current_bid
      WHERE id = v_state.current_player_id;
    UPDATE teams SET purse_remaining = purse_remaining - v_state.current_bid WHERE id = v_state.leading_team_id;
  END IF;

  UPDATE auction_state SET phase = 'sold_animation', updated_at = now() WHERE tournament_id = p_tournament;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER TABLE public.auction_state REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;


-- MIGRATION: 20260521111517_50f4de9a-706d-43dc-9f6d-bc79df268c3b.sql --


REVOKE EXECUTE ON FUNCTION public.place_bid(UUID, UUID, BIGINT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sell_current_player(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bid(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_current_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;


-- MIGRATION: 20260522063815_29d1ee0f-b52b-4b76-9954-826b8a3800d2.sql --


-- ============================================================
-- 1. Drop existing
-- ============================================================
DROP FUNCTION IF EXISTS public.place_bid(uuid, uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.sell_current_player(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TABLE IF EXISTS public.bids CASCADE;
DROP TABLE IF EXISTS public.auction_state CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.tournaments CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.invite_tokens CASCADE;
DROP TABLE IF EXISTS public.admin_allowlist CASCADE;
DROP TABLE IF EXISTS public.bid_rate_limit CASCADE;

DROP TYPE IF EXISTS public.auction_phase CASCADE;
DROP TYPE IF EXISTS public.player_status CASCADE;
DROP TYPE IF EXISTS public.player_category CASCADE;
DROP TYPE IF EXISTS public.tournament_status CASCADE;

DROP SEQUENCE IF EXISTS public.bid_sequence;

-- ============================================================
-- 2. Sequence
-- ============================================================
CREATE SEQUENCE public.bid_sequence START 1;

-- ============================================================
-- 3. Tables
-- ============================================================
CREATE TABLE public.admin_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','upcoming','live','completed')),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purse_per_team numeric NOT NULL DEFAULT 10000000,
  min_bid_increment numeric NOT NULL DEFAULT 100000,
  bid_timer_seconds integer NOT NULL DEFAULT 15,
  max_players_per_team integer NOT NULL DEFAULT 15,
  created_at timestamptz DEFAULT now(),
  starts_at timestamptz,
  is_demo boolean DEFAULT false
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  owner_name text,
  owner_email text,
  logo_url text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  remaining_purse numeric NOT NULL,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  role text CHECK (role IN ('Batter','Bowler','All-rounder','Wicket-keeper')),
  base_price numeric NOT NULL DEFAULT 100000,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','sold','unsold')),
  sold_to_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  sold_price numeric,
  auction_order integer,
  stats jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  sequence_number bigint NOT NULL DEFAULT nextval('public.bid_sequence'),
  created_at timestamptz DEFAULT now(),
  is_winning boolean DEFAULT false
);

CREATE TABLE public.auction_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL UNIQUE REFERENCES public.tournaments(id) ON DELETE CASCADE,
  current_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  current_highest_bid numeric DEFAULT 0,
  current_highest_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  timer_ends_at timestamptz,
  lot_number integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email text,
  used boolean DEFAULT false,
  used_by uuid REFERENCES auth.users(id),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.bid_rate_limit (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX idx_bids_tournament_player ON public.bids(tournament_id, player_id, created_at DESC);
CREATE INDEX idx_players_tournament_status ON public.players(tournament_id, status, auction_order);
CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX idx_audit_log_tournament ON public.audit_log(tournament_id, created_at DESC);
CREATE INDEX idx_invite_tokens_token ON public.invite_tokens(token);

-- ============================================================
-- 5. Enable RLS
-- ============================================================
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_rate_limit ENABLE ROW LEVEL SECURITY;

-- Helper: is admin of a tournament
CREATE OR REPLACE FUNCTION public.is_tournament_admin(_tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tournaments WHERE id = _tid AND admin_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_tournament_public(_tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tournaments WHERE id = _tid AND (is_demo = true OR status IN ('upcoming','live','completed')))
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team AND owner_id = auth.uid())
$$;

-- ============================================================
-- 6. RLS policies
-- ============================================================
-- tournaments
CREATE POLICY "tournaments_select" ON public.tournaments FOR SELECT TO public
  USING (auth.uid() = admin_id OR is_demo = true OR status IN ('upcoming','live','completed'));
CREATE POLICY "tournaments_insert" ON public.tournaments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = admin_id AND EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = (auth.jwt() ->> 'email')));
CREATE POLICY "tournaments_update" ON public.tournaments FOR UPDATE TO authenticated
  USING (auth.uid() = admin_id);
CREATE POLICY "tournaments_delete" ON public.tournaments FOR DELETE TO authenticated
  USING (auth.uid() = admin_id);

-- teams
CREATE POLICY "teams_select" ON public.teams FOR SELECT TO public
  USING (public.is_tournament_public(tournament_id) OR auth.uid() = owner_id OR public.is_tournament_admin(tournament_id));
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL TO authenticated
  USING (public.is_tournament_admin(tournament_id))
  WITH CHECK (public.is_tournament_admin(tournament_id));
CREATE POLICY "teams_owner_claim" ON public.teams FOR UPDATE TO authenticated
  USING (owner_id IS NULL OR auth.uid() = owner_id);

-- players
CREATE POLICY "players_select" ON public.players FOR SELECT TO public
  USING (public.is_tournament_public(tournament_id) OR public.is_tournament_admin(tournament_id)
         OR EXISTS (SELECT 1 FROM public.teams WHERE tournament_id = players.tournament_id AND owner_id = auth.uid()));
CREATE POLICY "players_admin_write" ON public.players FOR ALL TO authenticated
  USING (public.is_tournament_admin(tournament_id))
  WITH CHECK (public.is_tournament_admin(tournament_id));

-- bids: public read, no client writes
CREATE POLICY "bids_select" ON public.bids FOR SELECT TO public
  USING (public.is_tournament_public(tournament_id) OR public.is_tournament_admin(tournament_id));

-- auction_state: public read, no client writes
CREATE POLICY "auction_state_select" ON public.auction_state FOR SELECT TO public USING (true);

-- audit_log
CREATE POLICY "audit_log_admin_read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_tournament_admin(tournament_id));

-- invite_tokens
CREATE POLICY "invite_tokens_admin" ON public.invite_tokens FOR ALL TO authenticated
  USING (public.is_tournament_admin(tournament_id))
  WITH CHECK (public.is_tournament_admin(tournament_id));
CREATE POLICY "invite_tokens_public_read" ON public.invite_tokens FOR SELECT TO public USING (true);

-- admin_allowlist: only admins themselves can read their entry
CREATE POLICY "admin_allowlist_self" ON public.admin_allowlist FOR SELECT TO authenticated
  USING (email = (auth.jwt() ->> 'email'));

-- bid_rate_limit: locked to functions only (no policies)

-- profiles already exists from previous schema; keep as-is
-- user_roles already exists; keep

-- ============================================================
-- 7. Seed admin_allowlist with existing users
-- ============================================================
INSERT INTO public.admin_allowlist (email)
SELECT DISTINCT email FROM auth.users WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 8. New-user handler: profile + role if allowlisted
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = NEW.email) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tournament_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 9. place_bid RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_bid(p_tournament uuid, p_player uuid, p_team uuid, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_state auction_state%ROWTYPE;
  v_team teams%ROWTYPE;
  v_player players%ROWTYPE;
  v_tournament tournaments%ROWTYPE;
  v_min_next numeric;
  v_recent integer;
  v_window timestamptz := date_trunc('second', now()) - (extract(second from now())::int % 10) * interval '1 second';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  -- Rate limit: 3 per 10 seconds
  SELECT COALESCE(SUM(count),0) INTO v_recent FROM public.bid_rate_limit
    WHERE user_id = v_uid AND window_start > now() - interval '10 seconds';
  IF v_recent >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Slow down — too many bids');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND OR v_team.owner_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your team');
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament;
  IF v_tournament.status <> 'live' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Auction is not live');
  END IF;

  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.current_player_id IS NULL OR v_state.current_player_id <> p_player THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player not on the block');
  END IF;

  IF v_state.timer_ends_at IS NOT NULL AND v_state.timer_ends_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Timer expired');
  END IF;

  SELECT * INTO v_player FROM public.players WHERE id = p_player;
  IF v_player.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player not active');
  END IF;

  IF v_state.current_highest_team_id = p_team THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are already leading');
  END IF;

  IF COALESCE(v_state.current_highest_bid,0) = 0 THEN
    v_min_next := v_player.base_price;
  ELSE
    v_min_next := v_state.current_highest_bid + v_tournament.min_bid_increment;
  END IF;

  IF p_amount < v_min_next THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bid too low', 'min', v_min_next);
  END IF;
  IF p_amount > v_team.remaining_purse THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient purse');
  END IF;

  -- Record bid
  UPDATE public.bids SET is_winning = false WHERE player_id = p_player;
  INSERT INTO public.bids (tournament_id, player_id, team_id, amount, is_winning)
    VALUES (p_tournament, p_player, p_team, p_amount, true);

  UPDATE public.auction_state SET
    current_highest_bid = p_amount,
    current_highest_team_id = p_team,
    timer_ends_at = now() + (v_tournament.bid_timer_seconds || ' seconds')::interval,
    updated_at = now()
    WHERE tournament_id = p_tournament;

  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'bid', v_uid, jsonb_build_object('team', p_team, 'player', p_player, 'amount', p_amount));

  -- Update rate limit
  INSERT INTO public.bid_rate_limit (user_id, window_start, count) VALUES (v_uid, v_window, 1)
    ON CONFLICT (user_id, window_start) DO UPDATE SET count = bid_rate_limit.count + 1;
  DELETE FROM public.bid_rate_limit WHERE window_start < now() - interval '1 minute';

  RETURN jsonb_build_object('ok', true, 'new_bid_amount', p_amount, 'timer_ends_at', (now() + (v_tournament.bid_timer_seconds || ' seconds')::interval));
END; $$;

-- ============================================================
-- 10. Admin auction control RPCs (replace direct table writes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_lot(p_tournament uuid, p_player uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament;
  IF v_t.admin_id <> auth.uid() THEN RETURN jsonb_build_object('ok', false, 'error', 'Not admin'); END IF;
  UPDATE public.players SET status = 'active' WHERE id = p_player AND tournament_id = p_tournament;
  UPDATE public.auction_state SET
    current_player_id = p_player,
    current_highest_bid = 0,
    current_highest_team_id = NULL,
    timer_ends_at = now() + (v_t.bid_timer_seconds || ' seconds')::interval,
    lot_number = lot_number + 1,
    updated_at = now()
    WHERE tournament_id = p_tournament;
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'lot_started', auth.uid(), jsonb_build_object('player', p_player));
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.close_expired_lots()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state RECORD;
  v_next uuid;
  v_count integer := 0;
BEGIN
  FOR v_state IN
    SELECT a.* FROM public.auction_state a
    JOIN public.tournaments t ON t.id = a.tournament_id
    WHERE a.timer_ends_at IS NOT NULL
      AND a.timer_ends_at < now()
      AND a.current_player_id IS NOT NULL
      AND t.status = 'live'
    FOR UPDATE
  LOOP
    IF v_state.current_highest_team_id IS NOT NULL THEN
      UPDATE public.players SET status = 'sold',
        sold_to_team_id = v_state.current_highest_team_id,
        sold_price = v_state.current_highest_bid
        WHERE id = v_state.current_player_id;
      UPDATE public.teams SET remaining_purse = remaining_purse - v_state.current_highest_bid
        WHERE id = v_state.current_highest_team_id;
      INSERT INTO public.audit_log (tournament_id, action, payload)
        VALUES (v_state.tournament_id, 'sold', jsonb_build_object('player', v_state.current_player_id, 'team', v_state.current_highest_team_id, 'price', v_state.current_highest_bid));
    ELSE
      UPDATE public.players SET status = 'unsold' WHERE id = v_state.current_player_id;
      INSERT INTO public.audit_log (tournament_id, action, payload)
        VALUES (v_state.tournament_id, 'unsold', jsonb_build_object('player', v_state.current_player_id));
    END IF;

    SELECT id INTO v_next FROM public.players
      WHERE tournament_id = v_state.tournament_id AND status = 'pending'
      ORDER BY auction_order NULLS LAST, created_at LIMIT 1;

    UPDATE public.auction_state SET
      current_player_id = NULL,
      current_highest_bid = 0,
      current_highest_team_id = NULL,
      timer_ends_at = NULL,
      updated_at = now()
      WHERE tournament_id = v_state.tournament_id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- ============================================================
-- 11. Invite acceptance RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv invite_tokens%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  SELECT * INTO v_inv FROM public.invite_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid token'); END IF;
  IF v_inv.used THEN RETURN jsonb_build_object('ok', false, 'error', 'Already used'); END IF;
  IF v_inv.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Expired'); END IF;

  UPDATE public.teams SET owner_id = auth.uid(),
    owner_email = COALESCE(owner_email, (auth.jwt() ->> 'email'))
    WHERE id = v_inv.team_id;
  UPDATE public.invite_tokens SET used = true, used_by = auth.uid() WHERE id = v_inv.id;
  RETURN jsonb_build_object('ok', true, 'team_id', v_inv.team_id);
END; $$;

-- ============================================================
-- 12. Realtime
-- ============================================================
ALTER TABLE public.auction_state REPLICA IDENTITY FULL;
ALTER TABLE public.bids REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bids; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.players; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.teams; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- 13. pg_cron jobs
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('close-expired-lots');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('purge-old-tournaments');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('close-expired-lots', '5 seconds', $$SELECT public.close_expired_lots();$$);

SELECT cron.schedule('purge-old-tournaments', '0 3 * * *', $$
  DELETE FROM public.tournaments WHERE status = 'completed' AND created_at < now() - interval '20 days';
$$);


-- MIGRATION: 20260522064215_891c1311-0b64-4b4e-a512-871cde43345e.sql --


REVOKE EXECUTE ON FUNCTION public.close_expired_lots() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_expired_lots() TO postgres;


-- MIGRATION: 20260523103554_9a3caf93-5b0f-48ec-a734-8fb9768b98f3.sql --


CREATE TABLE IF NOT EXISTS public.admin_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  email text NOT NULL,
  used boolean DEFAULT false,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.admin_invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_invite_tokens_public_read" ON public.admin_invite_tokens
  FOR SELECT USING (true);

-- Validate a token (returns email if valid)
CREATE OR REPLACE FUNCTION public.validate_admin_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row admin_invite_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.admin_invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite token'); END IF;
  IF v_row.used THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite has already been used'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite has expired'); END IF;
  RETURN jsonb_build_object('ok', true, 'email', v_row.email);
END; $$;

-- Consume an admin invite token + ensure email is in allowlist
CREATE OR REPLACE FUNCTION public.consume_admin_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row admin_invite_tokens%ROWTYPE;
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO v_row FROM public.admin_invite_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite token'); END IF;
  IF v_row.used THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite has already been used'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite has expired'); END IF;
  IF lower(v_row.email) <> lower(v_email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invite was issued for a different email');
  END IF;

  -- Ensure email is in admin_allowlist
  INSERT INTO public.admin_allowlist (email) VALUES (lower(v_email))
    ON CONFLICT DO NOTHING;

  -- Grant tournament_admin role
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'tournament_admin')
    ON CONFLICT DO NOTHING;

  -- Mark token consumed
  UPDATE public.admin_invite_tokens SET used = true, used_by = v_uid, used_at = now() WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true);
END; $$;


-- MIGRATION: 20260525062047_8b0a9c38-54b8-4273-bb43-2a692184fbaf.sql --

-- Anyone signed in can create a tournament they own
DROP POLICY IF EXISTS tournaments_insert ON public.tournaments;
CREATE POLICY tournaments_insert ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = admin_id);

-- Make sure every new signup gets a profile row (idempotent trigger)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MIGRATION: 20260525062818_f02fb6d6-a561-4a0b-b135-76d8daf3023c.sql --


-- pause_lot: freeze timer
CREATE OR REPLACE FUNCTION public.pause_lot(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_state auction_state%ROWTYPE; v_remaining int;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok',false,'error','Not admin'); END IF;
  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.timer_ends_at IS NULL THEN RETURN jsonb_build_object('ok',false,'error','No active lot'); END IF;
  v_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_state.timer_ends_at - now()))::int);
  UPDATE public.auction_state SET timer_ends_at = NULL, updated_at = now()
    WHERE tournament_id = p_tournament;
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'lot_paused', auth.uid(), jsonb_build_object('remaining_seconds', v_remaining));
  RETURN jsonb_build_object('ok',true,'remaining_seconds', v_remaining);
END; $$;

-- resume_lot
CREATE OR REPLACE FUNCTION public.resume_lot(p_tournament uuid, p_seconds int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t tournaments%ROWTYPE; v_secs int;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok',false,'error','Not admin'); END IF;
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament;
  v_secs := COALESCE(p_seconds, v_t.bid_timer_seconds);
  UPDATE public.auction_state SET timer_ends_at = now() + (v_secs || ' seconds')::interval, updated_at = now()
    WHERE tournament_id = p_tournament AND current_player_id IS NOT NULL;
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'lot_resumed', auth.uid(), jsonb_build_object('seconds', v_secs));
  RETURN jsonb_build_object('ok',true);
END; $$;

-- skip_lot
CREATE OR REPLACE FUNCTION public.skip_lot(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_state auction_state%ROWTYPE;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok',false,'error','Not admin'); END IF;
  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.current_player_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','No active lot'); END IF;
  UPDATE public.players SET status = 'pending' WHERE id = v_state.current_player_id;
  UPDATE public.auction_state SET current_player_id = NULL, current_highest_bid = 0,
    current_highest_team_id = NULL, timer_ends_at = NULL, updated_at = now()
    WHERE tournament_id = p_tournament;
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'lot_skipped', auth.uid(), jsonb_build_object('player', v_state.current_player_id));
  RETURN jsonb_build_object('ok',true);
END; $$;

-- mark_unsold
CREATE OR REPLACE FUNCTION public.mark_unsold(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_state auction_state%ROWTYPE;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok',false,'error','Not admin'); END IF;
  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.current_player_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','No active lot'); END IF;
  UPDATE public.players SET status = 'unsold' WHERE id = v_state.current_player_id;
  UPDATE public.auction_state SET current_player_id = NULL, current_highest_bid = 0,
    current_highest_team_id = NULL, timer_ends_at = NULL, updated_at = now()
    WHERE tournament_id = p_tournament;
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'marked_unsold', auth.uid(), jsonb_build_object('player', v_state.current_player_id));
  RETURN jsonb_build_object('ok',true);
END; $$;

-- undo_last_sale
CREATE OR REPLACE FUNCTION public.undo_last_sale(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player players%ROWTYPE;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok',false,'error','Not admin'); END IF;
  SELECT p.* INTO v_player FROM public.players p
    JOIN public.audit_log a ON (a.payload->>'player')::uuid = p.id
    WHERE p.tournament_id = p_tournament AND p.status = 'sold' AND a.action = 'sold'
    ORDER BY a.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','No recent sale to undo'); END IF;
  UPDATE public.teams SET remaining_purse = remaining_purse + v_player.sold_price
    WHERE id = v_player.sold_to_team_id;
  UPDATE public.players SET status = 'pending', sold_to_team_id = NULL, sold_price = NULL
    WHERE id = v_player.id;
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'sale_undone', auth.uid(), jsonb_build_object('player', v_player.id));
  RETURN jsonb_build_object('ok',true,'player', v_player.id);
END; $$;

-- end_auction
CREATE OR REPLACE FUNCTION public.end_auction(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok',false,'error','Not admin'); END IF;
  UPDATE public.tournaments SET status = 'completed' WHERE id = p_tournament;
  UPDATE public.auction_state SET current_player_id = NULL, current_highest_bid = 0,
    current_highest_team_id = NULL, timer_ends_at = NULL, updated_at = now()
    WHERE tournament_id = p_tournament;
  INSERT INTO public.audit_log (tournament_id, action, actor_id)
    VALUES (p_tournament, 'auction_ended', auth.uid());
  RETURN jsonb_build_object('ok',true);
END; $$;

-- Cleanup: delete completed tournaments older than 20 days
CREATE OR REPLACE FUNCTION public.cleanup_old_tournaments()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH d AS (
    DELETE FROM public.tournaments
    WHERE status = 'completed' AND created_at < now() - interval '20 days'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM d;
  RETURN v_count;
END; $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-old-tournaments');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('cleanup-old-tournaments', '0 3 * * *', $$SELECT public.cleanup_old_tournaments();$$);


-- MIGRATION: 20260526073235_f89b536f-5119-488c-8f25-63495f350b3e.sql --


INSERT INTO public.auction_state (tournament_id)
SELECT id FROM public.tournaments t
WHERE NOT EXISTS (SELECT 1 FROM public.auction_state a WHERE a.tournament_id = t.id);

CREATE OR REPLACE FUNCTION public.start_lot(p_tournament uuid, p_player uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_t tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament;
  IF v_t.admin_id <> auth.uid() THEN RETURN jsonb_build_object('ok', false, 'error', 'Not admin'); END IF;

  IF v_t.status <> 'live' THEN
    UPDATE public.tournaments SET status = 'live' WHERE id = p_tournament;
  END IF;

  UPDATE public.players SET status = 'active' WHERE id = p_player AND tournament_id = p_tournament;

  INSERT INTO public.auction_state (tournament_id, current_player_id, current_highest_bid, current_highest_team_id, timer_ends_at, lot_number, updated_at)
  VALUES (p_tournament, p_player, 0, NULL, now() + (v_t.bid_timer_seconds || ' seconds')::interval, 1, now())
  ON CONFLICT (tournament_id) DO UPDATE SET
    current_player_id = EXCLUDED.current_player_id,
    current_highest_bid = 0,
    current_highest_team_id = NULL,
    timer_ends_at = EXCLUDED.timer_ends_at,
    lot_number = public.auction_state.lot_number + 1,
    updated_at = now();

  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'lot_started', auth.uid(), jsonb_build_object('player', p_player));
  RETURN jsonb_build_object('ok', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.ensure_auction_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.auction_state (tournament_id) VALUES (NEW.id)
  ON CONFLICT (tournament_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tournaments_ensure_auction_state ON public.tournaments;
CREATE TRIGGER tournaments_ensure_auction_state
AFTER INSERT ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.ensure_auction_state();


-- MIGRATION: 20260526073548_289f69eb-05db-4378-b4a0-7e6f2c29bc05.sql --


-- 1. Invite tokens: drop public read, add SECURITY DEFINER lookup
DROP POLICY IF EXISTS invite_tokens_public_read ON public.invite_tokens;
DROP POLICY IF EXISTS admin_invite_tokens_public_read ON public.admin_invite_tokens;

CREATE OR REPLACE FUNCTION public.get_invite_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv invite_tokens%ROWTYPE;
  v_team teams%ROWTYPE;
  v_tour tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO v_team FROM public.teams WHERE id = v_inv.team_id;
  SELECT * INTO v_tour FROM public.tournaments WHERE id = v_inv.tournament_id;
  RETURN jsonb_build_object(
    'found', true,
    'team_id', v_inv.team_id,
    'tournament_id', v_inv.tournament_id,
    'team_name', v_team.name,
    'tournament_name', v_tour.name,
    'used', v_inv.used,
    'expired', v_inv.expires_at < now(),
    'email', v_inv.email
  );
END; $$;

-- 2. Hide owner_email / owner_name from anon + authenticated; serve via admin RPC
REVOKE SELECT (owner_email, owner_name) ON public.teams FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_teams(p_tournament uuid)
RETURNS TABLE (
  id uuid, name text, owner_id uuid, owner_email text, owner_name text,
  remaining_purse numeric, logo_url text, color text, tournament_id uuid, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT t.id, t.name, t.owner_id, t.owner_email, t.owner_name,
           t.remaining_purse, t.logo_url, t.color, t.tournament_id, t.created_at
    FROM public.teams t WHERE t.tournament_id = p_tournament
    ORDER BY t.created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_generate_invite(p_team uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_team teams%ROWTYPE; v_token text;
BEGIN
  SELECT * INTO v_team FROM public.teams WHERE id = p_team;
  IF NOT FOUND OR NOT is_tournament_admin(v_team.tournament_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.invite_tokens (tournament_id, team_id, email)
    VALUES (v_team.tournament_id, p_team, v_team.owner_email)
    RETURNING token INTO v_token;
  RETURN jsonb_build_object('token', v_token, 'email', v_team.owner_email);
END; $$;

-- 3. auction_state: restrict to visible tournaments / admins / team owners
DROP POLICY IF EXISTS auction_state_select ON public.auction_state;
CREATE POLICY auction_state_select ON public.auction_state
FOR SELECT TO public
USING (
  is_tournament_public(tournament_id)
  OR is_tournament_admin(tournament_id)
  OR EXISTS (SELECT 1 FROM public.teams t WHERE t.tournament_id = auction_state.tournament_id AND t.owner_id = auth.uid())
);

-- 4. Remove broad team-owner-claim policy; accept_invite RPC handles ownership
DROP POLICY IF EXISTS teams_owner_claim ON public.teams;


-- MIGRATION: 20260526081614_2488bd2b-1da3-4bde-be3a-0986b51c0c93.sql --


-- 1) Profiles: restrict SELECT to self (and admins via security definer helper if needed)
DROP POLICY IF EXISTS "Profiles readable by all auth" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2) Teams: remove broad SELECT that exposes owner_email/owner_name, replace with safe public view
DROP POLICY IF EXISTS teams_select ON public.teams;

-- Only admins can SELECT directly from the base table (full columns including owner_email/owner_name)
CREATE POLICY teams_admin_select
  ON public.teams FOR SELECT
  TO authenticated
  USING (is_tournament_admin(tournament_id));

-- Team owners can read their own team row directly (they already know their own email)
CREATE POLICY teams_owner_self_select
  ON public.teams FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Public-safe view exposing only non-sensitive columns
CREATE OR REPLACE VIEW public.teams_public
WITH (security_invoker = on) AS
SELECT id, tournament_id, name, owner_id, logo_url, color, remaining_purse, created_at
FROM public.teams
WHERE is_tournament_public(tournament_id);

GRANT SELECT ON public.teams_public TO anon, authenticated;


-- MIGRATION: 20260527161548_9ae63d9a-052c-44a6-b54f-ac049262d701.sql --


-- 1. Player photo
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Tournament banners + blocked flag
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS cover_photo_url text;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

-- 3. Auction state hammer columns
ALTER TABLE public.auction_state ADD COLUMN IF NOT EXISTS strike_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.auction_state ADD COLUMN IF NOT EXISTS strike_resets_at timestamptz;
ALTER TABLE public.auction_state ADD COLUMN IF NOT EXISTS last_sold_player_id uuid;
ALTER TABLE public.auction_state ADD COLUMN IF NOT EXISTS last_sold_team_id uuid;
ALTER TABLE public.auction_state ADD COLUMN IF NOT EXISTS last_sold_price numeric;
ALTER TABLE public.auction_state ADD COLUMN IF NOT EXISTS last_sold_at timestamptz;

-- 4. Super admin audit log
CREATE TABLE IF NOT EXISTS public.super_admin_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  target text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admin_log TO authenticated;
GRANT ALL ON public.super_admin_log TO service_role;
ALTER TABLE public.super_admin_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_log_read ON public.super_admin_log;
CREATE POLICY super_admin_log_read ON public.super_admin_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 5. Seed super admin allowlist + auto-grant on signup
INSERT INTO public.admin_allowlist (email) VALUES ('khushhal12196@gmail.com')
  ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.super_admin_allowlist (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admin_allowlist TO authenticated;
GRANT ALL ON public.super_admin_allowlist TO service_role;
ALTER TABLE public.super_admin_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_allowlist_read ON public.super_admin_allowlist;
CREATE POLICY super_admin_allowlist_read ON public.super_admin_allowlist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.super_admin_allowlist (email) VALUES ('khushhal12196@gmail.com')
  ON CONFLICT DO NOTHING;

-- Grant role to existing user if already signed up
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role FROM auth.users u
WHERE lower(u.email) = 'khushhal12196@gmail.com'
ON CONFLICT DO NOTHING;

-- Update handle_new_user to grant super_admin on signup if in allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.super_admin_allowlist WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
      ON CONFLICT DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tournament_admin')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- 6. Super admin RPCs
CREATE OR REPLACE FUNCTION public.sa_list_tournaments()
RETURNS TABLE(id uuid, name text, status text, admin_id uuid, admin_email text, blocked boolean, created_at timestamptz, team_count bigint, player_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT t.id, t.name, t.status, t.admin_id, p.email, t.blocked, t.created_at,
      (SELECT count(*) FROM public.teams WHERE tournament_id = t.id),
      (SELECT count(*) FROM public.players WHERE tournament_id = t.id)
    FROM public.tournaments t LEFT JOIN public.profiles p ON p.id = t.admin_id
    ORDER BY t.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.sa_list_users()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamptz, roles text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.created_at,
      ARRAY(SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id)
    FROM public.profiles p ORDER BY p.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.sa_set_blocked(p_tournament uuid, p_blocked boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  UPDATE public.tournaments SET blocked = p_blocked WHERE id = p_tournament;
  INSERT INTO public.super_admin_log(actor_id, action, target, payload)
    VALUES (auth.uid(), CASE WHEN p_blocked THEN 'block_tournament' ELSE 'unblock_tournament' END, p_tournament::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.sa_delete_tournament(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  INSERT INTO public.super_admin_log(actor_id, action, target) VALUES (auth.uid(), 'delete_tournament', p_tournament::text);
  DELETE FROM public.tournaments WHERE id = p_tournament;
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.sa_force_end(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  UPDATE public.tournaments SET status = 'completed' WHERE id = p_tournament;
  UPDATE public.auction_state SET current_player_id = NULL, current_highest_bid = 0,
    current_highest_team_id = NULL, timer_ends_at = NULL, strike_count = 0, strike_resets_at = NULL, updated_at = now()
    WHERE tournament_id = p_tournament;
  INSERT INTO public.super_admin_log(actor_id, action, target) VALUES (auth.uid(), 'force_end', p_tournament::text);
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.sa_add_super_admin(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  INSERT INTO public.super_admin_allowlist(email) VALUES (lower(p_email)) ON CONFLICT DO NOTHING;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.super_admin_log(actor_id, action, target) VALUES (auth.uid(), 'add_super_admin', lower(p_email));
  RETURN jsonb_build_object('ok',true,'pending', v_uid IS NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.sa_remove_super_admin(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  IF lower(p_email) = 'khushhal12196@gmail.com' THEN RETURN jsonb_build_object('ok',false,'error','Cannot remove root super admin'); END IF;
  DELETE FROM public.super_admin_allowlist WHERE lower(email) = lower(p_email);
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'super_admin';
  END IF;
  INSERT INTO public.super_admin_log(actor_id, action, target) VALUES (auth.uid(), 'remove_super_admin', lower(p_email));
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.sa_list_super_admins()
RETURNS TABLE(email text, user_id uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT a.email, u.id, a.created_at FROM public.super_admin_allowlist a
    LEFT JOIN auth.users u ON lower(u.email) = a.email
    ORDER BY a.created_at;
END; $$;

-- 7. Update place_bid to reset strikes
CREATE OR REPLACE FUNCTION public.place_bid(p_tournament uuid, p_player uuid, p_team uuid, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_state auction_state%ROWTYPE;
  v_team teams%ROWTYPE;
  v_player players%ROWTYPE;
  v_tournament tournaments%ROWTYPE;
  v_min_next numeric;
  v_recent integer;
  v_window timestamptz := date_trunc('second', now()) - (extract(second from now())::int % 10) * interval '1 second';
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated'); END IF;
  SELECT COALESCE(SUM(count),0) INTO v_recent FROM public.bid_rate_limit
    WHERE user_id = v_uid AND window_start > now() - interval '10 seconds';
  IF v_recent >= 3 THEN RETURN jsonb_build_object('ok', false, 'error', 'Slow down — too many bids'); END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND OR v_team.owner_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your team');
  END IF;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament;
  IF v_tournament.status <> 'live' THEN RETURN jsonb_build_object('ok', false, 'error', 'Auction is not live'); END IF;
  IF v_tournament.blocked THEN RETURN jsonb_build_object('ok', false, 'error', 'Tournament is blocked'); END IF;
  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.current_player_id IS NULL OR v_state.current_player_id <> p_player THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player not on the block');
  END IF;
  SELECT * INTO v_player FROM public.players WHERE id = p_player;
  IF v_player.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'Player not active'); END IF;
  IF v_state.current_highest_team_id = p_team THEN RETURN jsonb_build_object('ok', false, 'error', 'You are already leading'); END IF;

  IF COALESCE(v_state.current_highest_bid,0) = 0 THEN
    v_min_next := v_player.base_price;
  ELSE
    v_min_next := v_state.current_highest_bid + v_tournament.min_bid_increment;
  END IF;
  IF p_amount < v_min_next THEN RETURN jsonb_build_object('ok', false, 'error', 'Bid too low', 'min', v_min_next); END IF;
  IF p_amount > v_team.remaining_purse THEN RETURN jsonb_build_object('ok', false, 'error', 'Insufficient purse'); END IF;

  UPDATE public.bids SET is_winning = false WHERE player_id = p_player;
  INSERT INTO public.bids (tournament_id, player_id, team_id, amount, is_winning)
    VALUES (p_tournament, p_player, p_team, p_amount, true);

  UPDATE public.auction_state SET
    current_highest_bid = p_amount,
    current_highest_team_id = p_team,
    timer_ends_at = now() + (v_tournament.bid_timer_seconds || ' seconds')::interval,
    strike_count = 0,
    strike_resets_at = now() + interval '3 seconds',
    updated_at = now()
    WHERE tournament_id = p_tournament;

  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'bid', v_uid, jsonb_build_object('team', p_team, 'player', p_player, 'amount', p_amount));
  INSERT INTO public.bid_rate_limit (user_id, window_start, count) VALUES (v_uid, v_window, 1)
    ON CONFLICT (user_id, window_start) DO UPDATE SET count = bid_rate_limit.count + 1;
  DELETE FROM public.bid_rate_limit WHERE window_start < now() - interval '1 minute';
  RETURN jsonb_build_object('ok', true, 'new_bid_amount', p_amount);
END; $$;

-- 8. start_lot: initialise strike clock
CREATE OR REPLACE FUNCTION public.start_lot(p_tournament uuid, p_player uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament;
  IF v_t.admin_id <> auth.uid() THEN RETURN jsonb_build_object('ok', false, 'error', 'Not admin'); END IF;
  IF v_t.blocked THEN RETURN jsonb_build_object('ok',false,'error','Tournament is blocked'); END IF;
  IF v_t.status <> 'live' THEN UPDATE public.tournaments SET status = 'live' WHERE id = p_tournament; END IF;
  UPDATE public.players SET status = 'active' WHERE id = p_player AND tournament_id = p_tournament;

  INSERT INTO public.auction_state (tournament_id, current_player_id, current_highest_bid, current_highest_team_id, timer_ends_at, lot_number, strike_count, strike_resets_at, updated_at)
  VALUES (p_tournament, p_player, 0, NULL, now() + (v_t.bid_timer_seconds || ' seconds')::interval, 1, 0, now() + interval '3 seconds', now())
  ON CONFLICT (tournament_id) DO UPDATE SET
    current_player_id = EXCLUDED.current_player_id,
    current_highest_bid = 0,
    current_highest_team_id = NULL,
    timer_ends_at = EXCLUDED.timer_ends_at,
    strike_count = 0,
    strike_resets_at = EXCLUDED.strike_resets_at,
    lot_number = public.auction_state.lot_number + 1,
    updated_at = now();

  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'lot_started', auth.uid(), jsonb_build_object('player', p_player));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- 9. tick_auction: server-authoritative hammer
CREATE OR REPLACE FUNCTION public.tick_auction(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s auction_state%ROWTYPE; v_player_name text; v_team_name text;
BEGIN
  SELECT * INTO v_s FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF NOT FOUND OR v_s.current_player_id IS NULL OR v_s.strike_resets_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;
  IF v_s.strike_resets_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'strikes', v_s.strike_count);
  END IF;

  -- Advance one strike
  IF v_s.strike_count < 2 THEN
    UPDATE public.auction_state SET strike_count = strike_count + 1,
      strike_resets_at = now() + interval '3 seconds', updated_at = now()
      WHERE tournament_id = p_tournament;
    RETURN jsonb_build_object('ok', true, 'strikes', v_s.strike_count + 1);
  END IF;

  -- 3rd strike — finalize
  IF v_s.current_highest_team_id IS NOT NULL THEN
    UPDATE public.players SET status = 'sold',
      sold_to_team_id = v_s.current_highest_team_id,
      sold_price = v_s.current_highest_bid
      WHERE id = v_s.current_player_id;
    UPDATE public.teams SET remaining_purse = remaining_purse - v_s.current_highest_bid
      WHERE id = v_s.current_highest_team_id;
    SELECT name INTO v_player_name FROM public.players WHERE id = v_s.current_player_id;
    SELECT name INTO v_team_name FROM public.teams WHERE id = v_s.current_highest_team_id;
    INSERT INTO public.audit_log (tournament_id, action, payload)
      VALUES (p_tournament, 'sold', jsonb_build_object('player', v_s.current_player_id, 'team', v_s.current_highest_team_id, 'price', v_s.current_highest_bid));
    UPDATE public.auction_state SET
      current_player_id = NULL, current_highest_bid = 0, current_highest_team_id = NULL,
      timer_ends_at = NULL, strike_count = 3, strike_resets_at = NULL,
      last_sold_player_id = v_s.current_player_id, last_sold_team_id = v_s.current_highest_team_id,
      last_sold_price = v_s.current_highest_bid, last_sold_at = now(), updated_at = now()
      WHERE tournament_id = p_tournament;
    RETURN jsonb_build_object('ok', true, 'sold', true, 'player', v_player_name, 'team', v_team_name, 'price', v_s.current_highest_bid);
  ELSE
    UPDATE public.players SET status = 'unsold' WHERE id = v_s.current_player_id;
    INSERT INTO public.audit_log (tournament_id, action, payload)
      VALUES (p_tournament, 'unsold', jsonb_build_object('player', v_s.current_player_id));
    UPDATE public.auction_state SET
      current_player_id = NULL, current_highest_bid = 0, current_highest_team_id = NULL,
      timer_ends_at = NULL, strike_count = 0, strike_resets_at = NULL, updated_at = now()
      WHERE tournament_id = p_tournament;
    RETURN jsonb_build_object('ok', true, 'unsold', true);
  END IF;
END; $$;

-- 10. teams_public view: refresh to include color (already there) - skip
-- 11. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('player-photos', 'player-photos', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('tournament-assets', 'tournament-assets', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "player-photos public read" ON storage.objects;
CREATE POLICY "player-photos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'player-photos');
DROP POLICY IF EXISTS "player-photos admin write" ON storage.objects;
CREATE POLICY "player-photos admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-photos' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "player-photos admin update" ON storage.objects;
CREATE POLICY "player-photos admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-photos' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "player-photos admin delete" ON storage.objects;
CREATE POLICY "player-photos admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'player-photos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tournament-assets public read" ON storage.objects;
CREATE POLICY "tournament-assets public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'tournament-assets');
DROP POLICY IF EXISTS "tournament-assets admin write" ON storage.objects;
CREATE POLICY "tournament-assets admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tournament-assets' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tournament-assets admin update" ON storage.objects;
CREATE POLICY "tournament-assets admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tournament-assets' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tournament-assets admin delete" ON storage.objects;
CREATE POLICY "tournament-assets admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tournament-assets' AND auth.uid() IS NOT NULL);


-- MIGRATION: 20260602094105_e5dbd7d4-e02f-4a93-b364-80c271146755.sql --


-- Profile extensions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age int,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Self insert policy (in addition to trigger) so client upserts work
DO $$ BEGIN
  CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Player self-registration support
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS self_registered boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS players_user_id_idx ON public.players(user_id);

-- Player invite tokens (reusable per tournament)
CREATE TABLE IF NOT EXISTS public.player_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked boolean NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_invite_tokens TO authenticated;
GRANT ALL ON public.player_invite_tokens TO service_role;

ALTER TABLE public.player_invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_invite_admin_all" ON public.player_invite_tokens
  FOR ALL TO authenticated
  USING (is_tournament_admin(tournament_id))
  WITH CHECK (is_tournament_admin(tournament_id));

-- RPC: generate a player invite (admin only)
CREATE OR REPLACE FUNCTION public.admin_generate_player_invite(p_tournament uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_token text;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  INSERT INTO public.player_invite_tokens (tournament_id, created_by)
    VALUES (p_tournament, auth.uid())
    RETURNING token INTO v_token;
  RETURN jsonb_build_object('ok', true, 'token', v_token);
END; $$;

-- RPC: read invite info (public)
CREATE OR REPLACE FUNCTION public.get_player_invite_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row player_invite_tokens%ROWTYPE; v_t tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.player_invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO v_t FROM public.tournaments WHERE id = v_row.tournament_id;
  RETURN jsonb_build_object(
    'found', true,
    'tournament_id', v_row.tournament_id,
    'tournament_name', v_t.name,
    'expired', v_row.expires_at < now(),
    'revoked', v_row.revoked
  );
END; $$;

-- RPC: accept player invite — creates a player row tied to caller
CREATE OR REPLACE FUNCTION public.accept_player_invite(
  p_token text,
  p_name text,
  p_role text DEFAULT 'Batter',
  p_base_price numeric DEFAULT 100000,
  p_photo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row player_invite_tokens%ROWTYPE; v_uid uuid := auth.uid(); v_player_id uuid; v_max int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  SELECT * INTO v_row FROM public.player_invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite'); END IF;
  IF v_row.revoked THEN RETURN jsonb_build_object('ok', false, 'error', 'Invite revoked'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Invite expired'); END IF;

  -- Already registered for this tournament? Return that record.
  SELECT id INTO v_player_id FROM public.players
    WHERE tournament_id = v_row.tournament_id AND user_id = v_uid LIMIT 1;
  IF v_player_id IS NOT NULL THEN
    UPDATE public.players SET name = p_name, role = p_role,
      base_price = COALESCE(p_base_price, base_price),
      photo_url = COALESCE(p_photo_url, photo_url)
      WHERE id = v_player_id;
    RETURN jsonb_build_object('ok', true, 'player_id', v_player_id, 'tournament_id', v_row.tournament_id);
  END IF;

  SELECT COALESCE(MAX(auction_order), 0) INTO v_max FROM public.players WHERE tournament_id = v_row.tournament_id;
  INSERT INTO public.players (tournament_id, name, role, base_price, photo_url, auction_order, user_id, self_registered, status)
    VALUES (v_row.tournament_id, p_name, p_role, COALESCE(p_base_price, 100000), p_photo_url, v_max + 1, v_uid, true, 'pending')
    RETURNING id INTO v_player_id;
  RETURN jsonb_build_object('ok', true, 'player_id', v_player_id, 'tournament_id', v_row.tournament_id);
END; $$;


-- MIGRATION: 20260603065648_089a54c4-3e41-48de-baea-c2164014221d.sql --


-- 1) Fix tick_auction: respect pause (timer_ends_at IS NULL) + unsold goes back to pending
CREATE OR REPLACE FUNCTION public.tick_auction(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s auction_state%ROWTYPE; v_player_name text; v_team_name text;
BEGIN
  SELECT * INTO v_s FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF NOT FOUND OR v_s.current_player_id IS NULL OR v_s.strike_resets_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;
  -- PAUSED: timer_ends_at is null when admin paused the lot
  IF v_s.timer_ends_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'paused', true);
  END IF;
  IF v_s.strike_resets_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'strikes', v_s.strike_count);
  END IF;

  IF v_s.strike_count < 2 THEN
    UPDATE public.auction_state SET strike_count = strike_count + 1,
      strike_resets_at = now() + interval '3 seconds', updated_at = now()
      WHERE tournament_id = p_tournament;
    RETURN jsonb_build_object('ok', true, 'strikes', v_s.strike_count + 1);
  END IF;

  IF v_s.current_highest_team_id IS NOT NULL THEN
    UPDATE public.players SET status = 'sold',
      sold_to_team_id = v_s.current_highest_team_id,
      sold_price = v_s.current_highest_bid
      WHERE id = v_s.current_player_id;
    UPDATE public.teams SET remaining_purse = remaining_purse - v_s.current_highest_bid
      WHERE id = v_s.current_highest_team_id;
    SELECT name INTO v_player_name FROM public.players WHERE id = v_s.current_player_id;
    SELECT name INTO v_team_name FROM public.teams WHERE id = v_s.current_highest_team_id;
    INSERT INTO public.audit_log (tournament_id, action, payload)
      VALUES (p_tournament, 'sold', jsonb_build_object('player', v_s.current_player_id, 'team', v_s.current_highest_team_id, 'price', v_s.current_highest_bid));
    UPDATE public.auction_state SET
      current_player_id = NULL, current_highest_bid = 0, current_highest_team_id = NULL,
      timer_ends_at = NULL, strike_count = 3, strike_resets_at = NULL,
      last_sold_player_id = v_s.current_player_id, last_sold_team_id = v_s.current_highest_team_id,
      last_sold_price = v_s.current_highest_bid, last_sold_at = now(), updated_at = now()
      WHERE tournament_id = p_tournament;
    RETURN jsonb_build_object('ok', true, 'sold', true, 'player', v_player_name, 'team', v_team_name, 'price', v_s.current_highest_bid);
  ELSE
    -- UNSOLD: send back to pending so admin can re-auction later
    UPDATE public.players SET status = 'pending' WHERE id = v_s.current_player_id;
    INSERT INTO public.audit_log (tournament_id, action, payload)
      VALUES (p_tournament, 'unsold', jsonb_build_object('player', v_s.current_player_id));
    UPDATE public.auction_state SET
      current_player_id = NULL, current_highest_bid = 0, current_highest_team_id = NULL,
      timer_ends_at = NULL, strike_count = 0, strike_resets_at = NULL, updated_at = now()
      WHERE tournament_id = p_tournament;
    RETURN jsonb_build_object('ok', true, 'unsold', true);
  END IF;
END; $$;

-- 2) Same for mark_unsold: send back to pending
CREATE OR REPLACE FUNCTION public.mark_unsold(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_state auction_state%ROWTYPE;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok',false,'error','Not admin'); END IF;
  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.current_player_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','No active lot'); END IF;
  UPDATE public.players SET status = 'pending' WHERE id = v_state.current_player_id;
  UPDATE public.auction_state SET current_player_id = NULL, current_highest_bid = 0,
    current_highest_team_id = NULL, timer_ends_at = NULL, strike_count = 0, strike_resets_at = NULL, updated_at = now()
    WHERE tournament_id = p_tournament;
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'marked_unsold', auth.uid(), jsonb_build_object('player', v_state.current_player_id));
  RETURN jsonb_build_object('ok',true);
END; $$;

-- 3) Player categories
CREATE TABLE public.player_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  name text NOT NULL,
  base_price numeric NOT NULL DEFAULT 100000,
  min_bid_increment numeric NOT NULL DEFAULT 100000,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_categories TO anon, authenticated;
GRANT ALL ON public.player_categories TO service_role;
ALTER TABLE public.player_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.player_categories FOR SELECT USING (is_tournament_public(tournament_id) OR is_tournament_admin(tournament_id));
CREATE POLICY "categories_admin_write" ON public.player_categories FOR ALL TO authenticated
  USING (is_tournament_admin(tournament_id)) WITH CHECK (is_tournament_admin(tournament_id));

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.player_categories(id) ON DELETE SET NULL;

-- 4) place_bid: use category's increment if player has a category
CREATE OR REPLACE FUNCTION public.place_bid(p_tournament uuid, p_player uuid, p_team uuid, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_state auction_state%ROWTYPE;
  v_team teams%ROWTYPE;
  v_player players%ROWTYPE;
  v_tournament tournaments%ROWTYPE;
  v_cat player_categories%ROWTYPE;
  v_min_next numeric;
  v_increment numeric;
  v_recent integer;
  v_window timestamptz := date_trunc('second', now()) - (extract(second from now())::int % 10) * interval '1 second';
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated'); END IF;
  SELECT COALESCE(SUM(count),0) INTO v_recent FROM public.bid_rate_limit
    WHERE user_id = v_uid AND window_start > now() - interval '10 seconds';
  IF v_recent >= 3 THEN RETURN jsonb_build_object('ok', false, 'error', 'Slow down — too many bids'); END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND OR v_team.owner_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your team');
  END IF;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament;
  IF v_tournament.status <> 'live' THEN RETURN jsonb_build_object('ok', false, 'error', 'Auction is not live'); END IF;
  IF v_tournament.blocked THEN RETURN jsonb_build_object('ok', false, 'error', 'Tournament is blocked'); END IF;
  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.current_player_id IS NULL OR v_state.current_player_id <> p_player THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player not on the block');
  END IF;
  IF v_state.timer_ends_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bidding is paused');
  END IF;
  SELECT * INTO v_player FROM public.players WHERE id = p_player;
  IF v_player.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'Player not active'); END IF;
  IF v_state.current_highest_team_id = p_team THEN RETURN jsonb_build_object('ok', false, 'error', 'You are already leading'); END IF;

  v_increment := v_tournament.min_bid_increment;
  IF v_player.category_id IS NOT NULL THEN
    SELECT * INTO v_cat FROM public.player_categories WHERE id = v_player.category_id;
    IF FOUND THEN v_increment := v_cat.min_bid_increment; END IF;
  END IF;

  IF COALESCE(v_state.current_highest_bid,0) = 0 THEN
    v_min_next := v_player.base_price;
  ELSE
    v_min_next := v_state.current_highest_bid + v_increment;
  END IF;
  IF p_amount < v_min_next THEN RETURN jsonb_build_object('ok', false, 'error', 'Bid too low', 'min', v_min_next); END IF;
  IF p_amount > v_team.remaining_purse THEN RETURN jsonb_build_object('ok', false, 'error', 'Insufficient purse'); END IF;

  UPDATE public.bids SET is_winning = false WHERE player_id = p_player;
  INSERT INTO public.bids (tournament_id, player_id, team_id, amount, is_winning)
    VALUES (p_tournament, p_player, p_team, p_amount, true);

  UPDATE public.auction_state SET
    current_highest_bid = p_amount,
    current_highest_team_id = p_team,
    timer_ends_at = now() + (v_tournament.bid_timer_seconds || ' seconds')::interval,
    strike_count = 0,
    strike_resets_at = now() + interval '3 seconds',
    updated_at = now()
    WHERE tournament_id = p_tournament;

  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'bid', v_uid, jsonb_build_object('team', p_team, 'player', p_player, 'amount', p_amount));
  INSERT INTO public.bid_rate_limit (user_id, window_start, count) VALUES (v_uid, v_window, 1)
    ON CONFLICT (user_id, window_start) DO UPDATE SET count = bid_rate_limit.count + 1;
  DELETE FROM public.bid_rate_limit WHERE window_start < now() - interval '1 minute';
  RETURN jsonb_build_object('ok', true, 'new_bid_amount', p_amount);
END; $$;

-- 5) RPC: team owner self-registers via the player-invite link
CREATE OR REPLACE FUNCTION public.accept_team_owner_invite(
  p_token text, p_team_name text, p_owner_name text,
  p_owner_email text DEFAULT NULL, p_logo_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL, p_avatar_url text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row player_invite_tokens%ROWTYPE;
  v_t tournaments%ROWTYPE;
  v_uid uuid := auth.uid();
  v_team_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  SELECT * INTO v_row FROM public.player_invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite'); END IF;
  IF v_row.revoked THEN RETURN jsonb_build_object('ok', false, 'error', 'Invite revoked'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Invite expired'); END IF;
  SELECT * INTO v_t FROM public.tournaments WHERE id = v_row.tournament_id;

  -- already an owner here?
  SELECT id INTO v_team_id FROM public.teams
    WHERE tournament_id = v_row.tournament_id AND owner_id = v_uid LIMIT 1;
  IF v_team_id IS NOT NULL THEN
    UPDATE public.teams SET name = p_team_name, owner_name = p_owner_name,
      owner_email = COALESCE(p_owner_email, owner_email),
      logo_url = COALESCE(p_logo_url, logo_url)
      WHERE id = v_team_id;
  ELSE
    INSERT INTO public.teams (tournament_id, name, owner_id, owner_name, owner_email, logo_url, remaining_purse)
      VALUES (v_row.tournament_id, p_team_name, v_uid, p_owner_name,
              COALESCE(p_owner_email, (auth.jwt() ->> 'email')), p_logo_url, v_t.purse_per_team)
      RETURNING id INTO v_team_id;
  END IF;

  -- store owner avatar / banner preferences on profile (banner_url not on teams; keep on profile.stats)
  IF p_avatar_url IS NOT NULL THEN
    UPDATE public.profiles SET avatar_url = p_avatar_url WHERE id = v_uid;
  END IF;
  IF p_banner_url IS NOT NULL THEN
    UPDATE public.profiles
      SET stats = COALESCE(stats, '{}'::jsonb) || jsonb_build_object('banner_url', p_banner_url)
      WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('ok', true, 'team_id', v_team_id, 'tournament_id', v_row.tournament_id);
END; $$;

-- 6) Public-safe lobby read: who has joined this tournament (players + team owners)
CREATE OR REPLACE FUNCTION public.get_tournament_lobby(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_players jsonb; v_teams jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'photo_url', photo_url, 'self_registered', self_registered) ORDER BY created_at), '[]'::jsonb)
    INTO v_players FROM public.players WHERE tournament_id = p_tournament;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'owner_name', owner_name, 'logo_url', logo_url, 'owner_linked', owner_id IS NOT NULL) ORDER BY created_at), '[]'::jsonb)
    INTO v_teams FROM public.teams WHERE tournament_id = p_tournament;
  RETURN jsonb_build_object('players', v_players, 'teams', v_teams);
END; $$;


-- MIGRATION: 20260604071833_1181cf38-cfa8-4311-9aaa-d1accb32a8a3.sql --


-- 1. Extend admin checks to include super_admin
CREATE OR REPLACE FUNCTION public.is_tournament_admin(_tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = _tid AND admin_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin')
$$;

-- 2. Cascade category base_price to players in that category
CREATE OR REPLACE FUNCTION public.apply_category_to_player()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat player_categories%ROWTYPE;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT * INTO v_cat FROM public.player_categories WHERE id = NEW.category_id;
    IF FOUND THEN NEW.base_price := v_cat.base_price; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_player_apply_category ON public.players;
CREATE TRIGGER trg_player_apply_category
  BEFORE INSERT OR UPDATE OF category_id ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.apply_category_to_player();

-- When a category's base_price changes, update every player in it
CREATE OR REPLACE FUNCTION public.cascade_category_base_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.base_price IS DISTINCT FROM OLD.base_price THEN
    UPDATE public.players
      SET base_price = NEW.base_price
      WHERE category_id = NEW.id AND status IN ('pending','unsold');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_category_cascade ON public.player_categories;
CREATE TRIGGER trg_category_cascade
  AFTER UPDATE ON public.player_categories
  FOR EACH ROW EXECUTE FUNCTION public.cascade_category_base_price();

-- 3. Bulk category assignment RPC
CREATE OR REPLACE FUNCTION public.admin_bulk_assign_category(
  p_tournament uuid,
  p_player_ids uuid[],
  p_category_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated int;
BEGIN
  IF NOT public.is_tournament_admin(p_tournament) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.player_categories WHERE id = p_category_id AND tournament_id = p_tournament
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid category');
  END IF;
  UPDATE public.players
    SET category_id = p_category_id
    WHERE id = ANY(p_player_ids)
      AND tournament_id = p_tournament
      AND status IN ('pending','unsold');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_updated);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_bulk_assign_category(uuid, uuid[], uuid) TO authenticated;


-- MIGRATION: 20260606000000_add_referrals_and_quotas.sql --

-- Add new columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auctions_quota integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);

-- Create a function to generate a random 6-character referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result text := '';
  i integer := 0;
  is_unique boolean := false;
BEGIN
  WHILE NOT is_unique LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || chars[1+random()*(array_length(chars, 1)-1)];
    END LOOP;
    
    -- Check if it exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = result) THEN
      is_unique := true;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger to auto-generate referral code for new profiles
CREATE OR REPLACE FUNCTION public.set_referral_code_on_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_referral_code_on_insert();

-- Backfill existing profiles with referral codes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE id = r.id;
  END LOOP;
END;
$$;

-- Trigger to safely consume an auction quota when creating a tournament
CREATE OR REPLACE FUNCTION public.check_and_use_tournament_quota()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_quota integer;
  v_tier text;
BEGIN
  -- Optional: Let super admins bypass quota (if your system supports it)
  IF public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  SELECT auctions_quota, subscription_tier INTO v_quota, v_tier 
  FROM public.profiles WHERE id = NEW.admin_id;

  -- Premium users don't use quota
  IF v_tier = 'premium' THEN
    RETURN NEW;
  END IF;

  -- Free users must have quota > 0
  IF v_quota > 0 THEN
    UPDATE public.profiles SET auctions_quota = auctions_quota - 1 WHERE id = NEW.admin_id;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You have used all your free tournaments. Please upgrade to Pro.';
END;
$$;

DROP TRIGGER IF EXISTS trg_check_tournament_quota ON public.tournaments;
CREATE TRIGGER trg_check_tournament_quota
  BEFORE INSERT ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_use_tournament_quota();

-- RPC for linking a referral code (when someone signs up using a link)
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_referrer_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  
  -- Find the referrer
  SELECT id INTO v_referrer_id FROM public.profiles WHERE referral_code = p_code;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot refer yourself');
  END IF;

  -- Check if already referred
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already been referred by someone');
  END IF;

  -- Apply the referrer
  UPDATE public.profiles SET referred_by = v_referrer_id WHERE id = v_uid;
  
  RETURN jsonb_build_object('ok', true);
END;
$$;


-- MIGRATION: 20260608000000_super_admin_expansion.sql --

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings FOR SELECT TO public USING (true);

INSERT INTO public.app_settings (key, value) VALUES (
  'pricing_config',
  '{
    "promo_text": "Newborn Special — 50% OFF!",
    "headline_highlight": "Champion",
    "single_price": "50",
    "single_price_strike": "80",
    "single_features": [
      "1 Active Tournament Credit",
      "Standard client & owner views",
      "No expiry on credit"
    ],
    "monthly_price": "99",
    "monthly_price_strike": "199",
    "monthly_features": [
      "UNLIMITED tournaments",
      "UNLIMITED teams & players",
      "Stadium-grade projector view",
      "Custom logos & colors",
      "Priority live websocket syncing"
    ],
    "yearly_price": "999",
    "yearly_price_strike": "1999",
    "yearly_features": [
      "Everything in Monthly Pro",
      "Lock in the Newborn Special price for a full year",
      "Priority support"
    ]
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sa_update_setting(p_key text, p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  INSERT INTO public.app_settings (key, value) VALUES (p_key, p_value) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.super_admin_log(actor_id, action, target, payload) VALUES (auth.uid(), 'update_setting', p_key, p_value);
  RETURN jsonb_build_object('ok',true);
END; $$;

DROP FUNCTION IF EXISTS public.sa_list_users();
CREATE OR REPLACE FUNCTION public.sa_list_users()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamptz, roles text[], auctions_quota integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.created_at,
      ARRAY(SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id),
      p.auctions_quota
    FROM public.profiles p ORDER BY p.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.sa_update_user_quota(p_user_id uuid, p_change integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_quota integer;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  UPDATE public.profiles SET auctions_quota = COALESCE(auctions_quota, 0) + p_change WHERE id = p_user_id RETURNING auctions_quota INTO v_new_quota;
  INSERT INTO public.super_admin_log(actor_id, action, target, payload) VALUES (auth.uid(), 'update_quota', p_user_id::text, jsonb_build_object('change', p_change, 'new_quota', v_new_quota));
  RETURN jsonb_build_object('ok',true, 'new_quota', v_new_quota);
END; $$;


-- MIGRATION: 20260608000001_feedback_system.sql --

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page_url text,
  feedback_type text NOT NULL CHECK (feedback_type IN ('issue', 'suggestion', 'review', 'upgrade')),
  content text,
  screenshot_url text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  status text DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Policies for user_feedback
-- Users can insert their own feedback (or anonymous feedback if authenticated without user_id, but here we'll allow insert for authenticated users)
CREATE POLICY "Users can insert feedback" 
  ON public.user_feedback FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Super admins can view all feedback" 
  ON public.user_feedback FOR SELECT 
  TO authenticated 
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update feedback status"
  ON public.user_feedback FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Storage bucket for feedback screenshots
INSERT INTO storage.buckets (id, name, public) 
VALUES ('feedback_images', 'feedback_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload feedback images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'feedback_images');

CREATE POLICY "Anyone can view feedback images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'feedback_images');

-- RPC to list feedback for Super Admin
CREATE OR REPLACE FUNCTION public.sa_list_feedback()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  user_email text,
  page_url text,
  feedback_type text,
  content text,
  screenshot_url text,
  rating integer,
  status text,
  created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT f.id, f.user_id, p.email AS user_email, f.page_url, f.feedback_type, f.content, f.screenshot_url, f.rating, f.status, f.created_at
    FROM public.user_feedback f
    LEFT JOIN public.profiles p ON f.user_id = p.id
    ORDER BY f.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.sa_update_feedback_status(p_feedback_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  UPDATE public.user_feedback SET status = p_status WHERE id = p_feedback_id;
  RETURN jsonb_build_object('ok',true);
END; $$;


-- MIGRATION: 20260612185610_restart_tournament.sql --

-- Add Restart Tournament and Undo Last Sale functionality

CREATE OR REPLACE FUNCTION public.restart_tournament(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tour tournaments%ROWTYPE;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok', false, 'error', 'Not admin'); END IF;
  
  SELECT * INTO v_tour FROM public.tournaments WHERE id = p_tournament;
  
  -- Reset all players
  UPDATE public.players SET status = 'pending', sold_to_team_id = NULL, sold_price = NULL WHERE tournament_id = p_tournament;
  
  -- Reset all teams' purse
  UPDATE public.teams SET remaining_purse = v_tour.purse_per_team WHERE tournament_id = p_tournament;
  
  -- Delete all bids
  DELETE FROM public.bids WHERE tournament_id = p_tournament;
  
  -- Reset auction state
  UPDATE public.auction_state SET
    current_player_id = NULL,
    current_highest_bid = 0,
    current_highest_team_id = NULL,
    timer_ends_at = NULL,
    strike_count = 0,
    strike_resets_at = NULL,
    last_sold_player_id = NULL,
    last_sold_team_id = NULL,
    last_sold_price = NULL,
    last_sold_at = NULL,
    updated_at = now()
  WHERE tournament_id = p_tournament;
  
  -- Log
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'tournament_restarted', v_uid, '{}'::jsonb);
    
  RETURN jsonb_build_object('ok', true);
END; $$;


CREATE OR REPLACE FUNCTION public.undo_last_sale(p_tournament uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_state auction_state%ROWTYPE;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok', false, 'error', 'Not admin'); END IF;
  
  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  
  IF v_state.last_sold_player_id IS NULL OR v_state.last_sold_team_id IS NULL OR v_state.last_sold_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No recent sale to undo');
  END IF;
  
  -- Refund team
  UPDATE public.teams SET remaining_purse = remaining_purse + v_state.last_sold_price WHERE id = v_state.last_sold_team_id;
  
  -- Reset player
  UPDATE public.players SET status = 'pending', sold_to_team_id = NULL, sold_price = NULL WHERE id = v_state.last_sold_player_id;
  
  -- Delete bids for this player
  DELETE FROM public.bids WHERE tournament_id = p_tournament AND player_id = v_state.last_sold_player_id;
  
  -- Clear last sold state
  UPDATE public.auction_state SET
    last_sold_player_id = NULL,
    last_sold_team_id = NULL,
    last_sold_price = NULL,
    last_sold_at = NULL,
    updated_at = now()
  WHERE tournament_id = p_tournament;
  
  -- Log
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'undo_last_sale', v_uid, jsonb_build_object('player_id', v_state.last_sold_player_id, 'team_id', v_state.last_sold_team_id, 'refund_amount', v_state.last_sold_price));
    
  RETURN jsonb_build_object('ok', true);
END; $$;


-- MIGRATION: 20260612190448_undo_specific_player.sql --

-- Add Undo Sale for Specific Player functionality

CREATE OR REPLACE FUNCTION public.undo_sale_for_player(p_tournament uuid, p_player uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player players%ROWTYPE;
  v_state auction_state%ROWTYPE;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN RETURN jsonb_build_object('ok', false, 'error', 'Not admin'); END IF;
  
  -- Get the player
  SELECT * INTO v_player FROM public.players WHERE id = p_player AND tournament_id = p_tournament FOR UPDATE;
  
  IF v_player.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player not found');
  END IF;
  
  IF v_player.status != 'sold' OR v_player.sold_to_team_id IS NULL OR v_player.sold_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player is not sold');
  END IF;
  
  -- Refund team
  UPDATE public.teams SET remaining_purse = remaining_purse + v_player.sold_price WHERE id = v_player.sold_to_team_id;
  
  -- Reset player
  UPDATE public.players SET status = 'pending', sold_to_team_id = NULL, sold_price = NULL WHERE id = p_player;
  
  -- Delete bids for this player
  DELETE FROM public.bids WHERE tournament_id = p_tournament AND player_id = p_player;
  
  -- Clear last sold state if this player was the last one sold
  SELECT * INTO v_state FROM public.auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.last_sold_player_id = p_player THEN
    UPDATE public.auction_state SET
      last_sold_player_id = NULL,
      last_sold_team_id = NULL,
      last_sold_price = NULL,
      last_sold_at = NULL,
      updated_at = now()
    WHERE tournament_id = p_tournament;
  END IF;
  
  -- Log
  INSERT INTO public.audit_log (tournament_id, action, actor_id, payload)
    VALUES (p_tournament, 'undo_sale_for_player', v_uid, jsonb_build_object('player_id', p_player, 'team_id', v_player.sold_to_team_id, 'refund_amount', v_player.sold_price));
    
  RETURN jsonb_build_object('ok', true);
END; $$;


