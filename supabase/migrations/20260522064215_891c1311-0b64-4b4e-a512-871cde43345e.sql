
REVOKE EXECUTE ON FUNCTION public.close_expired_lots() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_expired_lots() TO postgres;
