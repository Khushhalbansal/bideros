
-- 1) Profiles: restrict SELECT to self (and admins via security definer helper if needed)
DROP POLICY IF EXISTS "Profiles readable by all auth" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2) Teams: remove broad SELECT that exposes owner_email/owner_name, replace with safe public view
DROP POLICY IF EXISTS teams_select ON public.teams;

-- Only admins can SELECT directly from the base table (full columns including owner_email/owner_name)
CREATE POLICY teams_admin_select
  ON public.teams FOR SELECT
  TO authenticated
  USING (is_tournament_admin(tournament_id));

-- Team owners can read their own team row directly (they already know their own email)
CREATE POLICY teams_owner_self_select
  ON public.teams FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Public-safe view exposing only non-sensitive columns
CREATE OR REPLACE VIEW public.teams_public
WITH (security_invoker = on) AS
SELECT id, tournament_id, name, owner_id, logo_url, color, remaining_purse, created_at
FROM public.teams
WHERE is_tournament_public(tournament_id);

GRANT SELECT ON public.teams_public TO anon, authenticated;
