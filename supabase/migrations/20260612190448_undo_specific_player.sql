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
