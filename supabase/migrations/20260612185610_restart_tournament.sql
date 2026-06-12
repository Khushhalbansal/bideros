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
