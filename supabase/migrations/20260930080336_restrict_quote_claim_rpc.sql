-- Quote ownership is assigned only by trusted server routes after authentication.
-- This SECURITY DEFINER RPC accepts arbitrary user IDs/emails and must not be
-- callable directly by public or signed-in browser clients.
REVOKE EXECUTE ON FUNCTION public.claim_anonymous_quotes(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_quotes(uuid, text) TO service_role;
