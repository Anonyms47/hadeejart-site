-- Numéro de commande : HA-JJMMAA-A1 (jour, mois, année sur 2 chiffres, puis
-- compteur du jour : A1, A2, A3… qui repart à A1 le lendemain, heure de Dakar).
-- Le compteur est incrémenté de façon atomique dans la même transaction que la
-- commande : une commande refusée ne « consomme » aucun numéro.
create table if not exists public.order_counters (
  day date primary key,
  n   integer not null default 0
);
alter table public.order_counters enable row level security;  -- aucune policy : seule place_order() (security definer) y accède

-- On modifie la fonction place_order EN PLACE (définition actuelle de la base),
-- uniquement pour la création du numéro ; le reste de la fonction est inchangé.
do $patch$
declare
  d text; d0 text;
begin
  select pg_get_functiondef('public.place_order(jsonb)'::regprocedure) into d;
  d0 := d;
  if position('order_counters' in d) > 0 then return; end if;  -- déjà appliqué

  d := replace(d,
    $a$v_force_fcfa boolean := false;$a$,
    $b$v_force_fcfa boolean := false;
  v_day date := (now() at time zone 'Africa/Dakar')::date; v_n int;$b$);

  d := replace(d,
    $a$v_ref := 'HA-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));$a$,
    $b$insert into public.order_counters(day, n) values (v_day, 1)
    on conflict (day) do update set n = public.order_counters.n + 1
    returning n into v_n;
  v_ref := 'HA-' || to_char(v_day, 'DDMMYY') || '-A' || v_n;$b$);

  if d = d0 or position('v_day' in d) = 0 or position('order_counters' in d) = 0 then
    raise exception 'place_order : motifs introuvables, migration annulée.';
  end if;
  execute d;
end
$patch$;
