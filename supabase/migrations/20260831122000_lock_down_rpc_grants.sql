-- rate limiting: só o service role executa
revoke execute on function public.rate_limit_hit(text, integer, integer) from anon, authenticated;
revoke execute on function public.rate_limits_gc() from anon, authenticated;

-- aceite de convite: só usuário logado (nunca anon)
revoke execute on function public.accept_invitation(text) from anon;
