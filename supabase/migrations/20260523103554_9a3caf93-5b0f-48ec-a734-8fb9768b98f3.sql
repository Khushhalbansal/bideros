
CREATE TABLE IF NOT EXISTS public.admin_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  email text NOT NULL,
  used boolean DEFAULT false,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.admin_invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_invite_tokens_public_read" ON public.admin_invite_tokens
  FOR SELECT USING (true);

-- Validate a token (returns email if valid)
CREATE OR REPLACE FUNCTION public.validate_admin_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row admin_invite_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.admin_invite_tokens WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite token'); END IF;
  IF v_row.used THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite has already been used'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite has expired'); END IF;
  RETURN jsonb_build_object('ok', true, 'email', v_row.email);
END; $$;

-- Consume an admin invite token + ensure email is in allowlist
CREATE OR REPLACE FUNCTION public.consume_admin_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row admin_invite_tokens%ROWTYPE;
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO v_row FROM public.admin_invite_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite token'); END IF;
  IF v_row.used THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite has already been used'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite has expired'); END IF;
  IF lower(v_row.email) <> lower(v_email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invite was issued for a different email');
  END IF;

  -- Ensure email is in admin_allowlist
  INSERT INTO public.admin_allowlist (email) VALUES (lower(v_email))
    ON CONFLICT DO NOTHING;

  -- Grant tournament_admin role
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'tournament_admin')
    ON CONFLICT DO NOTHING;

  -- Mark token consumed
  UPDATE public.admin_invite_tokens SET used = true, used_by = v_uid, used_at = now() WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true);
END; $$;
