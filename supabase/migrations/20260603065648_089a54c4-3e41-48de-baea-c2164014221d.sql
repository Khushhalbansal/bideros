
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
