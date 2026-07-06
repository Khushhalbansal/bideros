
-- 1. Invite tokens: drop public read, add SECURITY DEFINER lookup
DROP POLICY IF EXISTS invite_tokens_public_read ON public.invite_tokens;
DROP POLICY IF EXISTS admin_invite_tokens_public_read ON public.admin_invite_tokens;

CREATE OR REPLACE FUNCTION public.get_invite_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv invite_tokens%ROWTYPE;
  v_team teams%ROWTYPE;
  v_tour tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO v_team FROM public.teams WHERE id = v_inv.team_id;
  SELECT * INTO v_tour FROM public.tournaments WHERE id = v_inv.tournament_id;
  RETURN jsonb_build_object(
    'found', true,
    'team_id', v_inv.team_id,
    'tournament_id', v_inv.tournament_id,
    'team_name', v_team.name,
    'tournament_name', v_tour.name,
    'used', v_inv.used,
    'expired', v_inv.expires_at < now(),
    'email', v_inv.email
  );
END; $$;

-- 2. Hide owner_email / owner_name from anon + authenticated; serve via admin RPC
REVOKE SELECT (owner_email, owner_name) ON public.teams FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_teams(p_tournament uuid)
RETURNS TABLE (
  id uuid, name text, owner_id uuid, owner_email text, owner_name text,
  remaining_purse numeric, logo_url text, color text, tournament_id uuid, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT t.id, t.name, t.owner_id, t.owner_email, t.owner_name,
           t.remaining_purse, t.logo_url, t.color, t.tournament_id, t.created_at
    FROM public.teams t WHERE t.tournament_id = p_tournament
    ORDER BY t.created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_generate_invite(p_team uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_team teams%ROWTYPE; v_token text;
BEGIN
  SELECT * INTO v_team FROM public.teams WHERE id = p_team;
  IF NOT FOUND OR NOT is_tournament_admin(v_team.tournament_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.invite_tokens (tournament_id, team_id, email)
    VALUES (v_team.tournament_id, p_team, v_team.owner_email)
    RETURNING token INTO v_token;
  RETURN jsonb_build_object('token', v_token, 'email', v_team.owner_email);
END; $$;

-- 3. auction_state: restrict to visible tournaments / admins / team owners
DROP POLICY IF EXISTS auction_state_select ON public.auction_state;
CREATE POLICY auction_state_select ON public.auction_state
FOR SELECT TO public
USING (
  is_tournament_public(tournament_id)
  OR is_tournament_admin(tournament_id)
  OR EXISTS (SELECT 1 FROM public.teams t WHERE t.tournament_id = auction_state.tournament_id AND t.owner_id = auth.uid())
);

-- 4. Remove broad team-owner-claim policy; accept_invite RPC handles ownership
DROP POLICY IF EXISTS teams_owner_claim ON public.teams;
