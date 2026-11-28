-- Limite globale anti-abus : au plus 100 commandes enregistrées par tranche de 10 minutes
-- (la limite par numéro de téléphone existait déjà). Très au-dessus d'un usage normal,
-- elle empêche surtout d'inonder la boutique de fausses commandes avec des numéros variés.
do $patch$
declare d text; d0 text;
begin
  select pg_get_functiondef('public.place_order(jsonb)'::regprocedure) into d;
  d0 := d;
  if position('Trop de commandes en ce moment' in d) > 0 then return; end if;  -- déjà appliqué
  d := replace(d,
    $a$raise exception 'Trop de commandes envoyées récemment avec ce numéro.'; end if;$a$,
    $b$raise exception 'Trop de commandes envoyées récemment avec ce numéro.'; end if;
  if (select count(*) from public.orders where created_at > now() - interval '10 minutes') >= 100 then
    raise exception 'Trop de commandes en ce moment : réessayez dans quelques minutes ou écrivez-nous sur WhatsApp.'; end if;$b$);
  if d = d0 or position('Trop de commandes en ce moment' in d) = 0 then
    raise exception 'place_order : motif introuvable, migration annulée.';
  end if;
  execute d;
end
$patch$;
