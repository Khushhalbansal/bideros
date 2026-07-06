
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
