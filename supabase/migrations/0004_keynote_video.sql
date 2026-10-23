-- Raapustamo: keynote-video
-- Kaappauskone (/keynote/lahetin) lähettää esitysmateriaalin keynote-editorin taustaksi WebRTC:llä.
-- Yhteydenmuodostus (SDP ja ICE-ehdokkaat) kulkee yksityisellä kanavalla `keynote-video:<lava>`.
-- Viesteissä on lähiverkon osoitteita, joten toisin kuin viivakanavaa (`keynote:<lava>`), tätä
-- saavat kuunnella vain esiintyjät ja moderaattorit. Itse video ei kulje Supabasen kautta.

create policy "keynote-video: esiintyjat kuuntelevat" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'keynote-video:%'
    and public.voi_piirtaa_lavalle()
  );

create policy "keynote-video: esiintyjat lahettavat" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'keynote-video:%'
    and public.voi_piirtaa_lavalle()
  );
