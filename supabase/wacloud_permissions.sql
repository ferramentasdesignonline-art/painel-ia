-- Rode isso no SQL Editor do Supabase do Wacloud para consertar as permissões
GRANT ALL ON public.wacloud_contatos TO anon, authenticated, service_role;
GRANT ALL ON public.wacloud_mensagens TO anon, authenticated, service_role;
GRANT ALL ON public.wacloud_instancias TO anon, authenticated, service_role;
