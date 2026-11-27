-- =====================================================================
-- Hadeej'Art — mise à niveau commerce (à appliquer dans l'éditeur SQL
-- Supabase du projet nwujdxrelsjicvsnbgzc). NON DESTRUCTIVE : uniquement
-- des ajouts de colonnes/tables et le remplacement de place_order().
-- Le site public et l'admin restent compatibles tant que ce script n'est
-- pas appliqué (les nouvelles fonctions sont simplement inactives).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Renommage de deux produits (par identifiant, pas par nom, afin
--    d'éviter la permutation erronée : Mimi's -> Bintoo's, Bintoo's ->
--    Tening Set). Garde-fous : nom ET prix doivent correspondre.
--    Les commandes existantes gardent leur libellé (order_items.
--    product_name est une copie figée).
-- ---------------------------------------------------------------------
update public.products p set
  name_fr = v.new_name, name_en = v.new_name, name_wo = v.new_name,
  updated_at = now()
from (values
  ('d9438ac1', 'Mimi''s Set',   7000, 'Bintoo''s Set'),
  ('450f33bd', 'Bintoo''s Set', 8000, 'Tening Set')
) as v(id_prefix, old_name, old_price, new_name)
where p.id::text like v.id_prefix || '%'
  and p.name_fr = v.old_name
  and p.price_fcfa = v.old_price;

-- ---------------------------------------------------------------------
-- 2) Fiches produit : champs optionnels (masqués côté site si vides)
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists description_fr text,
  add column if not exists description_en text,
  add column if not exists description_wo text,
  add column if not exists contents_fr text,   -- contenu de l'ensemble
  add column if not exists contents_en text,
  add column if not exists contents_wo text,
  add column if not exists care_fr text,       -- entretien
  add column if not exists care_en text,
  add column if not exists care_wo text,
  add column if not exists lead_time_fr text,  -- délai (saisi par la boutique)
  add column if not exists lead_time_en text,
  add column if not exists lead_time_wo text,
  add column if not exists cut_fr text,        -- coupe
  add column if not exists measures_text text, -- mesures (texte libre)
  add column if not exists fulfillment text    -- 'in_stock' | 'made_to_order'
    check (fulfillment is null or fulfillment in ('in_stock','made_to_order')),
  add column if not exists sold_out boolean not null default false,
  add column if not exists unavailable_sizes text[] not null default '{}';

-- ---------------------------------------------------------------------
-- 3) Réglages : textes commerciaux et guide des tailles configurables
-- ---------------------------------------------------------------------
alter table public.settings
  add column if not exists delivery_info_fr text,
  add column if not exists delivery_info_en text,
  add column if not exists delivery_info_wo text,
  add column if not exists exchange_info_fr text,
  add column if not exists exchange_info_en text,
  add column if not exists exchange_info_wo text,
  add column if not exists size_guide_fr text,
  add column if not exists size_guide_en text,
  add column if not exists size_guide_wo text,
  add column if not exists hero_title_fr text,
  add column if not exists hero_subtitle_fr text,
  add column if not exists delivery_zones jsonb not null default '[]'::jsonb;
  -- delivery_zones : [{"name":"Dakar","fee_fcfa":2000,"delay":"24-48 h"}]

-- ---------------------------------------------------------------------
-- 4) Commandes : paiement distinct du statut, idempotence, historique
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_status text not null default 'expected'
    check (payment_status in ('expected','received','refunded')),
  add column if not exists paid_at timestamptz,
  add column if not exists internal_note text,
  add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_uidx
  on public.orders (idempotency_key) where idempotency_key is not null;

create table if not exists public.order_status_history (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('status','payment')),
  from_value text,
  to_value text not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
alter table public.order_status_history enable row level security;
drop policy if exists order_status_history_admin on public.order_status_history;
create policy order_status_history_admin on public.order_status_history
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.log_order_changes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history(order_id, kind, from_value, to_value)
    values (new.id, 'status', null, new.status);
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.order_status_history(order_id, kind, from_value, to_value, changed_by)
    values (new.id, 'status', old.status, new.status, auth.uid());
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.order_status_history(order_id, kind, from_value, to_value, changed_by)
    values (new.id, 'payment', old.payment_status, new.payment_status, auth.uid());
    if new.payment_status = 'received' and new.paid_at is null then new.paid_at := now(); end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_log_changes_ins on public.orders;
create trigger orders_log_changes_ins after insert on public.orders
  for each row execute function public.log_order_changes();
drop trigger if exists orders_log_changes_upd on public.orders;
create trigger orders_log_changes_upd before update on public.orders
  for each row execute function public.log_order_changes();

-- ---------------------------------------------------------------------
-- 5) place_order v2 : le serveur revérifie TOUT (prix, disponibilité,
--    taille, option de variante, devise) et est idempotent.
--    - Aucune conversion de devise inventée : si un article n'a pas de
--      prix dans la devise choisie, toute la commande est en FCFA.
--    - Une même clé d'idempotence renvoie la commande déjà créée.
-- ---------------------------------------------------------------------
create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cust jsonb := coalesce(payload->'customer','{}'::jsonb);
  loc  jsonb := coalesce(payload->'location','{}'::jsonb);
  items jsonb := payload->'items';
  v_name text := btrim(coalesce(cust->>'name',''));
  v_phone text := btrim(coalesce(cust->>'phone',''));
  v_email text := btrim(coalesce(cust->>'email',''));
  v_pay text := coalesce(payload->>'payment_method','');
  v_cur text := coalesce(payload->>'currency','FCFA');
  v_idem text := nullif(btrim(coalesce(payload->>'idempotency_key','')),'');
  v_ref text; v_order_id uuid; v_total numeric := 0;
  it jsonb; prod public.products%rowtype; v_qty int; v_price numeric; v_size text;
  v_opt text; v_choice jsonb; v_pn text; v_existing public.orders%rowtype;
  v_force_fcfa boolean := false;
begin
  if v_idem is not null then
    if length(v_idem) > 80 then raise exception 'Clé de commande invalide.'; end if;
    select * into v_existing from public.orders where idempotency_key = v_idem;
    if found then
      return jsonb_build_object('order_ref', v_existing.order_ref, 'total_amount', v_existing.total_amount,
                                'currency', v_existing.currency, 'duplicate', true);
    end if;
  end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Le panier est vide.'; end if;
  if jsonb_array_length(items) > 30 then raise exception 'Trop d’articles dans une seule commande'; end if;
  if v_name = '' then raise exception 'Nom client requis.'; end if;
  if length(v_name) > 120 then raise exception 'Nom trop long (120 caractères maximum).'; end if;
  if v_phone = '' then raise exception 'Téléphone client requis.'; end if;
  if v_phone !~ '^[0-9+ ().-]{6,30}$' then raise exception 'Format de téléphone invalide.'; end if;
  if length(v_email) > 200 then raise exception 'E-mail trop long.'; end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Format d’e-mail invalide.'; end if;
  if v_pay not in ('wave','orange_money','sendwave','taptap_send') then raise exception 'Moyen de paiement non autorisé.'; end if;
  if v_cur not in ('FCFA','EUR','USD') then v_cur := 'FCFA'; end if;

  if (select count(*) from public.orders where customer_phone = v_phone and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Trop de commandes envoyées récemment avec ce numéro.'; end if;

  -- 1re passe : la devise demandée est-elle disponible pour TOUS les articles ?
  if v_cur <> 'FCFA' then
    for it in select * from jsonb_array_elements(items) loop
      select * into prod from public.products where id = nullif(it->>'product_id','')::uuid and status = 'published';
      if not found then continue; end if;
      v_price := case v_cur when 'EUR' then prod.price_eur else prod.price_usd end;
      v_opt := nullif(it->>'option_kimono','');
      if v_opt is not null and prod.variant_options is not null then
        select c into v_choice from jsonb_array_elements(prod.variant_options->'choices') c where c->>'value' = v_opt limit 1;
        if v_choice is not null then
          v_price := case v_cur when 'EUR' then (v_choice->>'price_eur')::numeric else (v_choice->>'price_usd')::numeric end;
        end if;
      end if;
      if v_price is null then v_force_fcfa := true; end if;
    end loop;
    if v_force_fcfa then v_cur := 'FCFA'; end if;
  end if;

  v_ref := 'HA-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.orders (order_ref, customer_name, customer_phone, customer_email, country, city, district,
      location_lat, location_lng, location_address, location_note, maps_link, payment_method, currency, idempotency_key)
  values (v_ref, v_name, v_phone, nullif(v_email,''),
      left(cust->>'country',100), left(cust->>'city',100), left(cust->>'district',100),
      nullif(loc->>'lat','')::double precision, nullif(loc->>'lng','')::double precision,
      left(loc->>'address',500), left(loc->>'note',500), left(loc->>'maps_link',500), v_pay, v_cur, v_idem)
  returning id into v_order_id;

  for it in select * from jsonb_array_elements(items) loop
    begin v_qty := (it->>'qty')::int; exception when others then raise exception 'Quantité invalide'; end;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'Quantité invalide'; end if;
    select * into prod from public.products where id = nullif(it->>'product_id','')::uuid and status = 'published';
    if not found then raise exception 'Produit invalide ou indisponible.'; end if;
    if prod.sold_out then raise exception 'Produit indisponible : %', prod.name_fr; end if;

    v_size := nullif(btrim(coalesce(it->>'size','')),'');
    if coalesce(array_length(prod.sizes,1),0) > 0 then
      if v_size is null then raise exception 'Taille requise pour %', prod.name_fr; end if;
      if not (v_size = any(prod.sizes)) then raise exception 'Taille % non disponible pour ce produit', v_size; end if;
      if v_size = any(prod.unavailable_sizes) then raise exception 'Taille % indisponible pour %', v_size, prod.name_fr; end if;
    end if;
    if v_size is not null and length(v_size) > 20 then raise exception 'Taille non valide'; end if;

    v_price := case v_cur when 'EUR' then prod.price_eur when 'USD' then prod.price_usd else prod.price_fcfa end;
    v_opt := nullif(it->>'option_kimono','');
    if prod.variant_options is not null then
      if v_opt is null then raise exception 'Option requise pour %', prod.name_fr; end if;
      select c into v_choice from jsonb_array_elements(prod.variant_options->'choices') c where c->>'value' = v_opt limit 1;
      if v_choice is null then raise exception 'Option invalide pour %', prod.name_fr; end if;
      v_price := coalesce(case v_cur when 'EUR' then (v_choice->>'price_eur')::numeric
                                     when 'USD' then (v_choice->>'price_usd')::numeric
                                     else (v_choice->>'price_fcfa')::numeric end, v_price);
    elsif v_opt is not null then
      v_opt := null; -- option inexistante pour ce produit : ignorée
    end if;
    if v_price is null then raise exception 'Prix indisponible pour %', prod.name_fr; end if;

    v_pn := prod.name_fr;
    insert into public.order_items (order_id, product_id, product_name, size, color, fabric, option_kimono, note, qty, unit_price, line_total)
    values (v_order_id, prod.id, v_pn, v_size, left(it->>'color',60), left(it->>'fabric',120), v_opt, left(it->>'note',500),
            v_qty, v_price, v_price * v_qty);
    v_total := v_total + v_price * v_qty;
  end loop;

  update public.orders set total_amount = v_total where id = v_order_id;
  return jsonb_build_object('order_ref', v_ref, 'total_amount', v_total, 'currency', v_cur);
exception when unique_violation then
  -- double envoi simultané avec la même clé : renvoyer la commande gagnante
  select * into v_existing from public.orders where idempotency_key = v_idem;
  if found then
    return jsonb_build_object('order_ref', v_existing.order_ref, 'total_amount', v_existing.total_amount,
                              'currency', v_existing.currency, 'duplicate', true);
  end if;
  raise;
end $$;
