-- Numéros de commande réutilisables : HA-JJMMAA-A1, A2, A3…
-- Quand une commande est supprimée, son numéro redevient libre : la commande
-- suivante prend le PLUS PETIT numéro libre du jour (et non plus un compteur
-- qui ne recule jamais). Un verrou transactionnel sérialise l'attribution pour
-- que deux commandes simultanées ne prennent jamais le même numéro ; l'index
-- unique orders_order_ref_key reste le garde-fou final.
do $patch$
declare
  d text; d0 text;
begin
  select pg_get_functiondef('public.place_order(jsonb)'::regprocedure) into d;
  d0 := d;
  if position('pg_advisory_xact_lock' in d) > 0 then return; end if;  -- déjà appliqué

  d := replace(d,
    $a$insert into public.order_counters(day, n) values (v_day, 1)
    on conflict (day) do update set n = public.order_counters.n + 1
    returning n into v_n;$a$,
    $b$perform pg_advisory_xact_lock(7461001);
  select min(g) into v_n
    from generate_series(1, (select count(*) + 1 from public.orders where order_ref like 'HA-' || to_char(v_day, 'DDMMYY') || '-A%')) g
   where not exists (select 1 from public.orders where order_ref = 'HA-' || to_char(v_day, 'DDMMYY') || '-A' || g);$b$);

  if d = d0 or position('pg_advisory_xact_lock' in d) = 0 then
    raise exception 'place_order : motif introuvable, migration annulée.';
  end if;
  execute d;
end
$patch$;

-- Le compteur de la migration précédente n'est plus utilisé.
drop table if exists public.order_counters;
