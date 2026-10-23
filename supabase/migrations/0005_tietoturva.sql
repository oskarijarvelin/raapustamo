-- Raapustamo: tietoturvakatselmoinnin korjaukset (docs/tietoturvakatselmointi.md, löydökset 1 ja 2)
--
-- Aja ENNEN kuin uusi versio julkaistaan. Lataa sen jälkeen näytöt uudelleen uusilla osoitteilla
-- (npm run nayttoavain), koska vanha sykefunktio poistuu ja komennot kulkevat yksityisellä kanavalla.

-- --- 1. Näytön komennot yksityiselle kanavalle ---
-- Moderointi lähettää näytöille hätäpysäytyksen ja piilotukset broadcastina kanavalla `naytto`.
-- Julkisella kanavalla kuka tahansa voisi lähettää samat komennot (esim. kumota hätäpysäytyksen).
-- Yksityisellä kanavalla näytöt (anon) saavat kuunnella, mutta vain moderaattorit lähettää.

create policy "naytto: kaikki kuuntelevat" on realtime.messages
  for select to anon, authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() = 'naytto');

create policy "naytto: moderaattorit lahettavat" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'naytto'
    and public.on_moderaattori()
  );

-- --- 2. Näyttökohtainen avain sykkeeseen ---
-- Ilman avainta kuka tahansa voisi lähettää sykkeen minkä tahansa näytön nimissä (ja peittää oikean
-- katkon) tai luoda rajattomasti keksittyjä näyttöjä. Nyt näytöt rekisteröidään etukäteen, ja syke
-- hyväksytään vain oikealla avaimella. Tauluun tallennetaan vain avaimen SHA-256-tiiviste.
-- Avaimet ja rekisteröinnin SQL: npm run nayttoavain -- led-1 keynote-lava-1

alter table public.naytot add column avain_tiiviste text;

-- Vanhat rivit ilman avainta eivät enää päivity, joten ne poistetaan. Rekisteröi näytöt uudelleen.
delete from public.naytot where avain_tiiviste is null;

drop function public.naytto_syke(text, jsonb);

create or replace function public.naytto_syke(naytto text, avain text, syke_tiedot jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if pg_column_size(syke_tiedot) > 2000 then
    raise exception 'virheellinen syke';
  end if;
  update public.naytot
  set viimeksi_nahty = now(), tiedot = coalesce(syke_tiedot, '{}'::jsonb)
  where tunnus = naytto
    and avain_tiiviste = encode(pg_catalog.sha256(convert_to(coalesce(avain, ''), 'UTF8')), 'hex');
  if not found then
    raise exception 'tuntematon naytto tai vaara avain';
  end if;
end $$;

revoke all on function public.naytto_syke(text, text, jsonb) from public;
grant execute on function public.naytto_syke(text, text, jsonb) to anon, authenticated;

-- Tiiviste ei ole moderoinnin tai editorin käytössä, joten sitä ei näytetä selaimeen.
revoke select on public.naytot from authenticated;
grant select (tunnus, viimeksi_nahty, tiedot) on public.naytot to authenticated;
