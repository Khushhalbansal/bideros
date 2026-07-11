-- Protect sensitive profile fields from client-side manipulation
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the caller is NOT the service role AND NOT a super admin, force protected fields back to their OLD values
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.auctions_quota := OLD.auctions_quota;
    NEW.points := OLD.points;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.subscription_end_date := OLD.subscription_end_date;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the BEFORE UPDATE trigger on public.profiles
DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();
