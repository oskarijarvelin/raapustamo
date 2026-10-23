// Tarkistaa keynote-kanavien oikeudet oikeaa Supabasea vastaan (migraatiot 0003 ja 0004):
//  1. kirjautumaton näyttö saa liittyä yksityiselle kanavalle kuuntelemaan
//  2. kirjautumaton ei saa lähettää viivoja yksityiselle kanavalle
//  3. samanniminen julkinen kanava ei vuoda viestejä yksityiselle kanavalle
//  4. kirjautumaton ei saa liittyä videon yhteydenmuodostuksen kanavalle (lähiverkon osoitteet)
//  5. kirjautumattoman (julkisella tai yksityisellä kanavalla) lähettämä hätäpysäytyksen komento ei tavoita
//     näyttöä yksityisellä `naytto`-kanavalla (migraatio 0005)
//
// npm run keynote-tarkistus            (lukee .env.localin)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const avain = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !avain) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY puuttuvat (.env.local).");
  process.exit(1);
}

const KANAVA = "keynote:tarkistus";
const asiakas = () => createClient(url, avain, { auth: { persistSession: false } });
const odota = (ms) => new Promise((r) => setTimeout(r, ms));

function liity(supabase, yksityinen, nimi = KANAVA, tapahtuma = "keynote") {
  const kanava = supabase.channel(nimi, { config: { private: yksityinen, broadcast: { self: false, ack: yksityinen } } });
  const saadut = [];
  kanava.on("broadcast", { event: tapahtuma }, ({ payload }) => saadut.push(payload));
  return new Promise((ratkaise) => {
    kanava.subscribe((tila, virhe) => {
      if (tila === "SUBSCRIBED" || tila === "CHANNEL_ERROR" || tila === "TIMED_OUT") ratkaise({ kanava, tila, virhe, saadut });
    });
  });
}

const kuuntelija = await liity(asiakas(), true);
const yksityinen = await liity(asiakas(), true);
const julkinen = await liity(asiakas(), false);
const video = await liity(asiakas(), true, "keynote-video:tarkistus");
const naytto = await liity(asiakas(), true, "naytto", "tauko");
const nayttoYksityinen = await liity(asiakas(), true, "naytto", "tauko");
const nayttoJulkinen = await liity(asiakas(), false, "naytto", "tauko");

const viesti = { tyyppi: "valmis", versio: 999999, viiva: { id: "tunkeutuja", vari: "#FFFFFF", koko: 0.5, sivellin: "tussi", paine: false, pisteet: [] } };
const yksityinenLahetys = yksityinen.tila === "SUBSCRIBED" ? await yksityinen.kanava.send({ type: "broadcast", event: "keynote", payload: viesti }) : "ei liitytty";
if (julkinen.tila === "SUBSCRIBED") await julkinen.kanava.send({ type: "broadcast", event: "keynote", payload: viesti });
// Testikomento on tarkoituksella "ei taukoa", eli se ei muuttaisi mitään, vaikka se pääsisikin läpi.
const tauko = { tauko: false };
if (nayttoYksityinen.tila === "SUBSCRIBED") await nayttoYksityinen.kanava.send({ type: "broadcast", event: "tauko", payload: tauko });
if (nayttoJulkinen.tila === "SUBSCRIBED") await nayttoJulkinen.kanava.send({ type: "broadcast", event: "tauko", payload: tauko });
await odota(3000);

const tulokset = [
  ["Kirjautumaton näyttö voi kuunnella yksityistä kanavaa", kuuntelija.tila === "SUBSCRIBED", kuuntelija.virhe?.message ?? kuuntelija.tila],
  ["Kirjautumattoman viestit eivät päädy näytölle", kuuntelija.saadut.length === 0, `vastaanotettu ${kuuntelija.saadut.length}, yksityinen lähetys: ${yksityinenLahetys}`],
  ["Kirjautumaton ei pääse videokanavalle", video.tila !== "SUBSCRIBED", video.virhe?.message ?? video.tila],
  ["Näyttö voi kuunnella yksityistä naytto-kanavaa", naytto.tila === "SUBSCRIBED", naytto.virhe?.message ?? naytto.tila],
  ["Kirjautumattoman komennot eivät tavoita näyttöä", naytto.saadut.length === 0, `vastaanotettu ${naytto.saadut.length}`],
];

let ok = true;
for (const [nimi, onnistui, lisatieto] of tulokset) {
  ok &&= onnistui;
  console.log(`${onnistui ? "✓" : "✗"} ${nimi} (${lisatieto})`);
}
process.exit(ok ? 0 : 1);
