
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
