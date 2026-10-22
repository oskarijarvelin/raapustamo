-- Raapustamo: perusrakenne
-- Aja Supabasen SQL-editorissa (tai `supabase db push`) tyhjään projektiin.

create type public.piirros_tila as enum ('jonossa', 'hyvaksytty', 'hylatty', 'piilotettu');

-- --- Taulut ---

create table public.piirrokset (
  id uuid primary key default gen_random_uuid(),
  nro bigint generated always as identity unique,
  luotu timestamptz not null default now(),
  viivat jsonb not null,
  lahde text not null default 'mobiili' check (char_length(lahde) between 1 and 32),
  kieli text not null default 'fi' check (kieli in ('fi', 'en')),
  tila public.piirros_tila not null default 'jonossa',
  ai_arvio jsonb,
  nostettu boolean not null default false,
  galleriaan boolean not null default true,
  moderoija uuid references auth.users on delete set null,
  moderoitu timestamptz,
  nayttokerrat integer not null default 0,
  viimeksi_naytetty timestamptz
);

create index piirrokset_tila_luotu on public.piirrokset (tila, luotu);

-- Lähetysloki rate limitiä varten. Erillään piirroksista, jotta laitetunniste ei
-- koskaan päädy julkisesti luettavaan tauluun. Vain palvelin (service role) käsittelee.
create table public.lahetykset (
  id bigint generated always as identity primary key,
  piirros_id uuid references public.piirrokset on delete cascade,
  laite_hash text not null,
  luotu timestamptz not null default now()
);

create index lahetykset_laite_luotu on public.lahetykset (laite_hash, luotu desc);

create table public.moderaattorit (
  kayttaja uuid primary key references auth.users on delete cascade,
  nimi text
);

create table public.asetukset (
  avain text primary key,
  arvo jsonb not null,
  paivitetty timestamptz not null default now()
);

insert into public.asetukset (avain, arvo) values ('naytto', '{"tauko": false}');

-- --- Apufunktiot ---

create or replace function public.on_moderaattori() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderaattorit where kayttaja = auth.uid());
$$;

-- Näyttö kirjaa näyttökerrat ilman kirjautumista, mutta vain hyväksytyille piirroksille.
create or replace function public.merkitse_naytetyksi(piirros uuid) returns void
language sql security definer set search_path = '' as $$
  update public.piirrokset
  set nayttokerrat = nayttokerrat + 1, viimeksi_naytetty = now()
  where id = piirros and tila = 'hyvaksytty';
$$;

revoke all on function public.merkitse_naytetyksi(uuid) from public;
grant execute on function public.merkitse_naytetyksi(uuid) to anon, authenticated;

-- Moderoija ja moderointiaika kirjataan automaattisesti tilan muuttuessa.
create or replace function public.kirjaa_moderointi() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tila is distinct from old.tila then
    new.moderoija := auth.uid();
    new.moderoitu := now();
  end if;
  return new;
end $$;

create trigger piirrokset_moderointi
  before update on public.piirrokset
  for each row execute function public.kirjaa_moderointi();

-- --- Oikeudet ---

alter table public.piirrokset enable row level security;
alter table public.lahetykset enable row level security;
alter table public.moderaattorit enable row level security;
alter table public.asetukset enable row level security;

revoke all on public.piirrokset, public.lahetykset, public.moderaattorit, public.asetukset from anon, authenticated;
grant select on public.piirrokset to anon, authenticated;
grant update (tila, nostettu, galleriaan, ai_arvio) on public.piirrokset to authenticated;
grant select on public.moderaattorit to authenticated;
grant select on public.asetukset to anon, authenticated;
grant update (arvo, paivitetty) on public.asetukset to authenticated;

-- Hyväksytyt piirrokset ovat julkisia (näyttö ja galleria).
create policy "hyvaksytyt ovat julkisia" on public.piirrokset
  for select using (tila = 'hyvaksytty');

create policy "moderaattorit nakevat kaikki" on public.piirrokset
  for select to authenticated using (public.on_moderaattori());

create policy "moderaattorit moderoivat" on public.piirrokset
  for update to authenticated using (public.on_moderaattori()) with check (public.on_moderaattori());

-- Uudet piirrokset lisätään vain palvelimen kautta (service role ohittaa RLS:n),
-- joten insert-politiikkaa ei ole. Lahetykset-taululla ei ole politiikkoja lainkaan.

create policy "moderaattori nakee itsensa" on public.moderaattorit
  for select to authenticated using (kayttaja = auth.uid());

create policy "asetukset ovat julkisia" on public.asetukset
  for select using (true);

create policy "moderaattorit muuttavat asetuksia" on public.asetukset
  for update to authenticated using (public.on_moderaattori()) with check (public.on_moderaattori());

-- --- Realtime ---

alter publication supabase_realtime add table public.piirrokset, public.asetukset;
