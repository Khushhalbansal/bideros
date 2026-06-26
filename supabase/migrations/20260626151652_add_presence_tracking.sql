-- Add presence tracking columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_online_seconds BIGINT DEFAULT 0;

-- RPC to update presence
CREATE OR REPLACE FUNCTION public.update_presence()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last_seen timestamptz;
  v_now timestamptz := now();
  v_diff_seconds integer;
  v_added_seconds integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT last_seen_at INTO v_last_seen FROM public.profiles WHERE id = auth.uid();
  
  IF v_last_seen IS NOT NULL THEN
    v_diff_seconds := extract(epoch from (v_now - v_last_seen));
    -- If diff is reasonable (e.g. less than 5 minutes), count it.
    -- If diff is too large, the user probably left the tab open and computer went to sleep or they closed it and came back later.
    -- We'll cap the added time to 120 seconds per ping to be safe.
    IF v_diff_seconds > 0 AND v_diff_seconds <= 120 THEN
      v_added_seconds := v_diff_seconds;
    ELSIF v_diff_seconds > 120 THEN
      -- Cap it at 60s for the first ping after a long absence
      v_added_seconds := 60;
    END IF;
  ELSE
    -- First time being tracked
    v_added_seconds := 60;
  END IF;

  UPDATE public.profiles
  SET 
    last_seen_at = v_now,
    total_online_seconds = COALESCE(total_online_seconds, 0) + v_added_seconds
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'added', v_added_seconds);
END; $$;

-- Update sa_list_users to include new presence fields
DROP FUNCTION IF EXISTS public.sa_list_users();
CREATE OR REPLACE FUNCTION public.sa_list_users()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamptz, roles text[], auctions_quota integer, last_seen_at timestamptz, total_online_seconds bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.created_at,
      ARRAY(SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id),
      p.auctions_quota,
      p.last_seen_at,
      p.total_online_seconds
    FROM public.profiles p ORDER BY p.created_at DESC;
END; $$;
