-- Seed free_mode_enabled setting to true by default
INSERT INTO public.app_settings (key, value)
VALUES ('free_mode_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Re-define the quota checking function to respect free_mode_enabled
CREATE OR REPLACE FUNCTION public.check_and_use_tournament_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota integer;
  v_tier text;
  v_free_mode jsonb;
BEGIN
  -- Check if free mode is enabled in app_settings
  SELECT value INTO v_free_mode 
  FROM public.app_settings 
  WHERE key = 'free_mode_enabled';

  -- If free mode is enabled, allow the insert without quota checks or modifications
  IF v_free_mode = 'true'::jsonb THEN
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
