
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
