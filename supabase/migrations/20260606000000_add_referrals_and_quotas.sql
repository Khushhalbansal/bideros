-- Add new columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auctions_quota integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);

-- Create a function to generate a random 6-character referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result text := '';
  i integer := 0;
  is_unique boolean := false;
BEGIN
  WHILE NOT is_unique LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || chars[1+random()*(array_length(chars, 1)-1)];
    END LOOP;
    
    -- Check if it exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = result) THEN
      is_unique := true;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger to auto-generate referral code for new profiles
CREATE OR REPLACE FUNCTION public.set_referral_code_on_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_referral_code_on_insert();

-- Backfill existing profiles with referral codes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE id = r.id;
  END LOOP;
END;
$$;

-- Trigger to safely consume an auction quota when creating a tournament
CREATE OR REPLACE FUNCTION public.check_and_use_tournament_quota()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_quota integer;
  v_tier text;
BEGIN
  -- Optional: Let super admins bypass quota (if your system supports it)
  IF public.has_role(auth.uid(), 'super_admin') THEN
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

DROP TRIGGER IF EXISTS trg_check_tournament_quota ON public.tournaments;
CREATE TRIGGER trg_check_tournament_quota
  BEFORE INSERT ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_use_tournament_quota();

-- RPC for linking a referral code (when someone signs up using a link)
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_referrer_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  
  -- Find the referrer
  SELECT id INTO v_referrer_id FROM public.profiles WHERE referral_code = p_code;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot refer yourself');
  END IF;

  -- Check if already referred
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already been referred by someone');
  END IF;

  -- Apply the referrer
  UPDATE public.profiles SET referred_by = v_referrer_id WHERE id = v_uid;
  
  RETURN jsonb_build_object('ok', true);
END;
$$;
