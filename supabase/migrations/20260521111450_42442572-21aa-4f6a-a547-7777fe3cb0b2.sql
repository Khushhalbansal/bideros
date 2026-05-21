
-- Roles enum & table
CREATE TYPE public.app_role AS ENUM ('super_admin', 'tournament_admin', 'team_owner');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default tournament_admin role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  -- default everyone to tournament_admin so they can create their own tournament
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tournament_admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tournaments
CREATE TYPE public.tournament_status AS ENUM ('setup', 'live', 'paused', 'ended');

CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purse_amount BIGINT NOT NULL DEFAULT 10000000, -- in rupees
  squad_size INT NOT NULL DEFAULT 11,
  bid_increment BIGINT NOT NULL DEFAULT 100000,
  status tournament_status NOT NULL DEFAULT 'setup',
  spectator_slug TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_email TEXT,
  purse_remaining BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX idx_teams_owner ON public.teams(owner_user_id);

-- Players
CREATE TYPE public.player_category AS ENUM ('iconic', 'normal');
CREATE TYPE public.player_status AS ENUM ('available', 'sold', 'unsold');

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT, -- batter, bowler, all-rounder, wk
  photo_url TEXT,
  base_price BIGINT NOT NULL DEFAULT 100000,
  category player_category NOT NULL DEFAULT 'normal',
  status player_status NOT NULL DEFAULT 'available',
  sold_to_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  sold_price BIGINT,
  stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_tournament ON public.players(tournament_id);
CREATE INDEX idx_players_status ON public.players(tournament_id, status);

-- Auction state (singleton per tournament)
CREATE TYPE public.auction_phase AS ENUM ('idle', 'live', 'sold_animation');

CREATE TABLE public.auction_state (
  tournament_id UUID PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  current_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  current_bid BIGINT,
  leading_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  phase auction_phase NOT NULL DEFAULT 'idle',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bids log
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  bidder_user_id UUID REFERENCES auth.users(id),
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bids_player ON public.bids(player_id, created_at DESC);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles readable by all auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Roles
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Tournaments: public read (for spectator), admin write
CREATE POLICY "Tournaments public read" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admin creates tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "Admin updates own tournament" ON public.tournaments FOR UPDATE TO authenticated USING (auth.uid() = admin_id);
CREATE POLICY "Admin deletes own tournament" ON public.tournaments FOR DELETE TO authenticated USING (auth.uid() = admin_id);

-- Teams: public read, admin write
CREATE POLICY "Teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admin manages teams" ON public.teams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()));

-- Players: public read, admin write
CREATE POLICY "Players public read" ON public.players FOR SELECT USING (true);
CREATE POLICY "Admin manages players" ON public.players FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()));

-- Auction state: public read, admin write
CREATE POLICY "Auction state public read" ON public.auction_state FOR SELECT USING (true);
CREATE POLICY "Admin manages auction state" ON public.auction_state FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.admin_id = auth.uid()));

-- Bids: public read (history)
CREATE POLICY "Bids public read" ON public.bids FOR SELECT USING (true);
-- No direct INSERT — must go through place_bid RPC

-- Atomic bid function with row lock
CREATE OR REPLACE FUNCTION public.place_bid(
  p_tournament UUID,
  p_team UUID,
  p_amount BIGINT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state auction_state%ROWTYPE;
  v_team teams%ROWTYPE;
  v_player players%ROWTYPE;
  v_min_next BIGINT;
  v_tournament tournaments%ROWTYPE;
BEGIN
  -- Lock auction state row
  SELECT * INTO v_state FROM auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF NOT FOUND OR v_state.phase <> 'live' OR v_state.current_player_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No live auction');
  END IF;

  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament;
  SELECT * INTO v_team FROM teams WHERE id = p_team AND tournament_id = p_tournament;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Team not in tournament');
  END IF;

  -- Auth: caller must be the team owner
  IF v_team.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your team');
  END IF;

  -- Don't allow self-overbid (already leading)
  IF v_state.leading_team_id = p_team THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are already leading');
  END IF;

  SELECT * INTO v_player FROM players WHERE id = v_state.current_player_id;

  -- Min next bid
  IF v_state.current_bid IS NULL THEN
    v_min_next := v_player.base_price;
  ELSE
    v_min_next := v_state.current_bid + v_tournament.bid_increment;
  END IF;

  IF p_amount < v_min_next THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bid too low', 'min', v_min_next);
  END IF;

  IF p_amount > v_team.purse_remaining THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient purse');
  END IF;

  -- Update state
  UPDATE auction_state
    SET current_bid = p_amount, leading_team_id = p_team, updated_at = now()
    WHERE tournament_id = p_tournament;

  INSERT INTO bids (tournament_id, player_id, team_id, bidder_user_id, amount)
    VALUES (p_tournament, v_state.current_player_id, p_team, auth.uid(), p_amount);

  RETURN jsonb_build_object('ok', true, 'amount', p_amount);
END; $$;

-- Sell current player (admin only)
CREATE OR REPLACE FUNCTION public.sell_current_player(p_tournament UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state auction_state%ROWTYPE;
  v_tournament tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament;
  IF v_tournament.admin_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not admin');
  END IF;

  SELECT * INTO v_state FROM auction_state WHERE tournament_id = p_tournament FOR UPDATE;
  IF v_state.current_player_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active player');
  END IF;

  IF v_state.leading_team_id IS NULL THEN
    -- mark unsold
    UPDATE players SET status = 'unsold' WHERE id = v_state.current_player_id;
  ELSE
    UPDATE players SET status = 'sold', sold_to_team_id = v_state.leading_team_id, sold_price = v_state.current_bid
      WHERE id = v_state.current_player_id;
    UPDATE teams SET purse_remaining = purse_remaining - v_state.current_bid WHERE id = v_state.leading_team_id;
  END IF;

  UPDATE auction_state SET phase = 'sold_animation', updated_at = now() WHERE tournament_id = p_tournament;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER TABLE public.auction_state REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
