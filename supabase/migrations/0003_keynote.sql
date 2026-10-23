-- Raapustamo: keynote-piirto
-- Esiintyjä piirtää iPadilla koko ruudun kokoiselle alustalle (/keynote), ja piirros näkyy
-- keynote-näytöllä (/keynote/naytto) reaaliajassa. Piirrokset eivät kulje moderoinnin kautta,
-- joten kanavalle saavat lähettää vain kirjautuneet esiintyjät ja moderaattorit.

create table public.esiintyjat (
  kayttaja uuid primary key references auth.users on delete cascade,
  nimi text
);

create or replace function public.voi_piirtaa_lavalle() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.esiintyjat where kayttaja = auth.uid())
      or exists (select 1 from public.moderaattorit where kayttaja = auth.uid());
$$;

revoke all on function public.voi_piirtaa_lavalle() from public;
grant execute on function public.voi_piirtaa_lavalle() to authenticated;

-- Lavan nykyinen piirros. Editori tallentaa sen jokaisen muutoksen jälkeen, joten näyttö ja
-- editori palautuvat uudelleenlatauksen tai verkkokatkon jälkeen. Viivojen x ja y on
-- normalisoitu alustan leveyteen, ja suhde = leveys / korkeus.
create table public.lavat (
  tunnus text primary key check (tunnus ~ '^[a-z0-9-]{1,30}$'),
  viivat jsonb not null default '[]',
  suhde real not null default 1.7778 check (suhde between 0.25 and 8),
  versio integer not null default 0,
  nakyvissa boolean not null default true,
  paivitetty timestamptz not null default now(),
  paivittaja uuid references auth.users on delete set null default auth.uid()
);

alter table public.esiintyjat enable row level security;
alter table public.lavat enable row level security;

revoke all on public.esiintyjat, public.lavat from anon, authenticated;
grant select on public.esiintyjat to authenticated;
grant select on public.lavat to anon, authenticated;
-- Editori tallentaa upsertilla, joka päivittää myös avainsarakkeen, joten tunnus on mukana update-oikeudessa.
grant insert (tunnus, viivat, suhde, versio, nakyvissa, paivitetty), update (tunnus, viivat, suhde, versio, nakyvissa, paivitetty)
  on public.lavat to authenticated;

create policy "esiintyja nakee itsensa" on public.esiintyjat
  for select to authenticated using (kayttaja = auth.uid());

-- Lavalla näkyvä piirros on julkinen kuten screenin hyväksytyt piirroksetkin.
create policy "lavat ovat julkisia" on public.lavat
  for select using (true);

create policy "esiintyjat luovat lavan" on public.lavat
  for insert to authenticated with check (public.voi_piirtaa_lavalle());

create policy "esiintyjat piirtavat lavalle" on public.lavat
  for update to authenticated using (public.voi_piirtaa_lavalle()) with check (public.voi_piirtaa_lavalle());

-- Editori näyttää, onko keynote-näyttö elossa (syke tunnuksella keynote-<lava>).
create policy "esiintyjat nakevat naytot" on public.naytot
  for select to authenticated using (public.voi_piirtaa_lavalle());

-- --- Realtime Authorization ---
-- Viivat kulkevat yksityisellä broadcast-kanavalla `keynote:<lava>`. Kuka tahansa saa kuunnella
-- (näyttö ei kirjaudu), mutta vain esiintyjät ja moderaattorit saavat lähettää. Julkinen kanava
-- samalla nimellä on eri kanava, joten sen kautta ei voi syöttää viivoja näytölle.

create policy "keynote: kaikki kuuntelevat" on realtime.messages
  for select to anon, authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() like 'keynote:%');

create policy "keynote: esiintyjat lahettavat" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'keynote:%'
    and public.voi_piirtaa_lavalle()
  );
