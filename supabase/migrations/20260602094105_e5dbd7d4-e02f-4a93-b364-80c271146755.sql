
-- Profile extensions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age int,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Self insert policy (in addition to trigger) so client upserts work
DO $$ BEGIN
  CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Player self-registration support
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS self_registered boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS players_user_id_idx ON public.players(user_id);

-- Player invite tokens (reusable per tournament)
CREATE TABLE IF NOT EXISTS public.player_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked boolean NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_invite_tokens TO authenticated;
GRANT ALL ON public.player_invite_tokens TO service_role;

ALTER TABLE public.player_invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_invite_admin_all" ON public.player_invite_tokens
  FOR ALL TO authenticated
  USING (is_tournament_admin(tournament_id))
  WITH CHECK (is_tournament_admin(tournament_id));

-- RPC: generate a player invite (admin only)
CREATE OR REPLACE FUNCTION public.admin_generate_player_invite(p_tournament uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_token text;
BEGIN
  IF NOT is_tournament_admin(p_tournament) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  INSERT INTO public.player_invite_tokens (tournament_id, created_by)
    VALUES (p_tournament, auth.uid())
    RETURNING token INTO v_token;
  RETURN jsonb_build_object('ok', true, 'token', v_token);
END; $$;

-- RPC: read invite info (public)
CREATE OR REPLACE FUNCTION public.get_player_invite_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row player_invite_tokens%ROWTYPE; v_t tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.player_invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO v_t FROM public.tournaments WHERE id = v_row.tournament_id;
  RETURN jsonb_build_object(
    'found', true,
    'tournament_id', v_row.tournament_id,
    'tournament_name', v_t.name,
    'expired', v_row.expires_at < now(),
    'revoked', v_row.revoked
  );
END; $$;

-- RPC: accept player invite — creates a player row tied to caller
CREATE OR REPLACE FUNCTION public.accept_player_invite(
  p_token text,
  p_name text,
  p_role text DEFAULT 'Batter',
  p_base_price numeric DEFAULT 100000,
  p_photo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row player_invite_tokens%ROWTYPE; v_uid uuid := auth.uid(); v_player_id uuid; v_max int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sign in first'); END IF;
  SELECT * INTO v_row FROM public.player_invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite'); END IF;
  IF v_row.revoked THEN RETURN jsonb_build_object('ok', false, 'error', 'Invite revoked'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Invite expired'); END IF;

  -- Already registered for this tournament? Return that record.
  SELECT id INTO v_player_id FROM public.players
    WHERE tournament_id = v_row.tournament_id AND user_id = v_uid LIMIT 1;
  IF v_player_id IS NOT NULL THEN
    UPDATE public.players SET name = p_name, role = p_role,
      base_price = COALESCE(p_base_price, base_price),
      photo_url = COALESCE(p_photo_url, photo_url)
      WHERE id = v_player_id;
    RETURN jsonb_build_object('ok', true, 'player_id', v_player_id, 'tournament_id', v_row.tournament_id);
  END IF;

  SELECT COALESCE(MAX(auction_order), 0) INTO v_max FROM public.players WHERE tournament_id = v_row.tournament_id;
  INSERT INTO public.players (tournament_id, name, role, base_price, photo_url, auction_order, user_id, self_registered, status)
    VALUES (v_row.tournament_id, p_name, p_role, COALESCE(p_base_price, 100000), p_photo_url, v_max + 1, v_uid, true, 'pending')
    RETURNING id INTO v_player_id;
  RETURN jsonb_build_object('ok', true, 'player_id', v_player_id, 'tournament_id', v_row.tournament_id);
END; $$;
