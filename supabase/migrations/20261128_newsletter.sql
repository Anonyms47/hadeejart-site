-- Carnet de Tissus : inscriptions (e-mail ou WhatsApp) depuis le pied de page.
-- Aucune lecture ni écriture directe pour le public : tout passe par la
-- fonction subscribe_newsletter() (validation + limite globale anti-abus).
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email','whatsapp')),
  contact text not null check (length(contact) <= 200),
  lang text,
  source text not null default 'footer',
  created_at timestamptz not null default now(),
  unique (kind, contact)
);
alter table public.newsletter_subscribers enable row level security;
drop policy if exists newsletter_admin on public.newsletter_subscribers;
create policy newsletter_admin on public.newsletter_subscribers
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.subscribe_newsletter(p_contact text, p_lang text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v text := btrim(coalesce(p_contact, ''));
  v_kind text;
  v_digits text;
begin
  if v = '' or length(v) > 200 then raise exception 'Contact invalide.'; end if;
  if position('@' in v) > 0 then
    v := lower(v);
    if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail invalide.'; end if;
    v_kind := 'email';
  else
    if v !~ '^[0-9+ ().-]{6,30}$' then raise exception 'Numéro invalide.'; end if;
    v_digits := regexp_replace(v, '\D', '', 'g');
    if length(v_digits) < 9 or length(v_digits) > 15 then raise exception 'Numéro invalide.'; end if;
    v := v_digits; v_kind := 'whatsapp';
  end if;
  -- limite globale : 60 inscriptions / 10 min (anti-abus sans suivre les visiteurs)
  if (select count(*) from public.newsletter_subscribers where created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'Trop de demandes, réessayez plus tard.';
  end if;
  insert into public.newsletter_subscribers(kind, contact, lang)
  values (v_kind, v, left(p_lang, 5))
  on conflict (kind, contact) do nothing;
  return jsonb_build_object('status', 'ok'); -- identique que le contact soit nouveau ou déjà inscrit
end $$;

grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;
