
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
