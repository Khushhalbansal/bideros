-- Anyone signed in can create a tournament they own
DROP POLICY IF EXISTS tournaments_insert ON public.tournaments;
CREATE POLICY tournaments_insert ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = admin_id);

-- Make sure every new signup gets a profile row (idempotent trigger)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();