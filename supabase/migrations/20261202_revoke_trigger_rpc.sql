-- log_order_changes() est une fonction de TRIGGER : elle n'a pas à être appelable
-- comme fonction publique (/rest/v1/rpc/log_order_changes). Le déclencheur continue
-- de fonctionner (le droit EXECUTE n'est vérifié qu'à la création du trigger).
revoke execute on function public.log_order_changes() from public, anon, authenticated;
