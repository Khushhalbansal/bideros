
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
