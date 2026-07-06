
REVOKE EXECUTE ON FUNCTION public.place_bid(UUID, UUID, BIGINT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sell_current_player(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bid(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_current_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
