#!/usr/bin/env node
// Raapustamon Resolume-silta: kertoo näytölle (/naytto?silta=…), milloin Raapustamo-klippi
// on screenillä. Ajetaan playout-koneella Resolumen rinnalla: `node silta/silta.mjs`.
// Ei riippuvuuksia – vaatii vain Node.js 20+.
import { createServer } from "node:http";
import { createSocket } from "node:dgram";
import { parseArgs } from "node:util";
import { etsiKlipit, lueOsc, onKytketty, onNakyvissa, osoiteTasmaa } from "./resolume.mjs";

const { values: asetukset } = parseArgs({
  options: {
    tila: { type: "string", default: "rest" }, // rest | osc | simuloi
    portti: { type: "string", default: "7400" },
    resolume: { type: "string", default: "http://127.0.0.1:8080" },
    klippi: { type: "string", default: "Raapustamo" },
    vali: { type: "string", default: "500" },
    "osc-portti": { type: "string", default: "7001" },
    "osc-osoite": { type: "string", default: "/composition/layers/*/clips/*/connected" },
    "simuloi-nakyvissa": { type: "string", default: "30" },
    "simuloi-piilossa": { type: "string", default: "60" },
    apua: { type: "boolean", short: "h", default: false },
  },
});

if (asetukset.apua) {
  console.log(`Raapustamon Resolume-silta

  node silta/silta.mjs [asetukset]

  --tila rest|osc|simuloi   Tunnistustapa (oletus rest)
  --portti 7400             Portti, josta näyttö kuuntelee (/naytto?silta=http://localhost:7400)
  --resolume URL            Resolumen REST-rajapinta (oletus http://127.0.0.1:8080)
  --klippi NIMI             Klipin nimi tai sen osa (oletus Raapustamo)
  --vali MS                 REST-kyselyn väli millisekunteina (oletus 500)
  --osc-portti 7001         Portti, johon Resolume lähettää OSC:tä (Preferences → OSC → Output)
  --osc-osoite OSOITE       Klipin connected-osoite, esim. /composition/layers/2/clips/4/connected
  --simuloi-nakyvissa S     Simulointi: sekuntia näkyvissä (oletus 30)
  --simuloi-piilossa S      Simulointi: sekuntia piilossa (oletus 60)`);
  process.exit(0);
}

const PORTTI = Number(asetukset.portti);
const loki = (...viesti) => console.log(new Date().toLocaleTimeString("fi-FI"), ...viesti);

// --- Tila ja tapahtumavirta näytöille ---

/** nakyvissa: klippi screenillä. resolume: yhteys Resolumeen. Ilman yhteyttä nakyvissa = true,
 * jotta näyttö kiertää piirroksia normaalisti eikä jää jumiin. */
let tila = { nakyvissa: true, resolume: false, lahde: asetukset.tila, klipit: [], muutettu: Date.now() };
const kuuntelijat = new Set();

function asetaTila(uusi) {
  const muuttui = uusi.nakyvissa !== tila.nakyvissa || uusi.resolume !== tila.resolume;
  tila = { ...tila, ...uusi, muutettu: muuttui ? Date.now() : tila.muutettu };
  if (!muuttui) return;
  loki(tila.resolume ? (tila.nakyvissa ? "▶ Raapustamo screenillä" : "■ Raapustamo piilossa") : "⚠ Ei yhteyttä Resolumeen – näyttö kiertää normaalisti");
  for (const vastaus of kuuntelijat) laheta(vastaus);
}

const laheta = (vastaus) => vastaus.write(`event: tila\ndata: ${JSON.stringify(tila)}\n\n`);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  // Julkiselta (https) sivulta localhostiin: Chromen Private/Local Network Access vaatii tämän.
  "Access-Control-Allow-Private-Network": "true",
};

const palvelin = createServer((pyynto, vastaus) => {
  const polku = new URL(pyynto.url, "http://silta").pathname;
  if (pyynto.method === "OPTIONS") {
    vastaus.writeHead(204, CORS).end();
  } else if (polku === "/tapahtumat") {
    vastaus.writeHead(200, { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    vastaus.write("retry: 2000\n\n");
    laheta(vastaus);
    kuuntelijat.add(vastaus);
    loki(`Näyttö yhdisti (${kuuntelijat.size} yhteyttä)`);
    pyynto.on("close", () => {
      kuuntelijat.delete(vastaus);
      loki(`Näyttö katkaisi (${kuuntelijat.size} yhteyttä)`);
    });
  } else if (polku === "/tila") {
    vastaus.writeHead(200, { ...CORS, "Content-Type": "application/json" }).end(JSON.stringify({ ...tila, nayttoja: kuuntelijat.size }, null, 2));
  } else if (polku === "/") {
    vastaus.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html><meta charset="utf-8">
<meta http-equiv="refresh" content="2"><title>Raapustamo-silta</title>
<body style="background:#000;color:#fff;font:20px system-ui;padding:40px">
<h1>Raapustamo-silta</h1>
<p style="font-size:48px">${tila.resolume ? (tila.nakyvissa ? "▶ Screenillä" : "■ Piilossa") : "⚠ Ei yhteyttä Resolumeen"}</p>
<p>Tila: ${tila.lahde} · näyttöjä yhdistetty: ${kuuntelijat.size}</p>
<p>Klipit: ${tila.klipit.map((k) => `${k.nimi ?? k.osoite} (${k.kytketty ? "kytketty" : "irti"})`).join(", ") || "–"}</p>`);
  } else {
    vastaus.writeHead(404, CORS).end();
  }
});

// Pitää tapahtumavirran auki välityspalvelimien ja selainten aikakatkaisuja vastaan.
setInterval(() => {
  for (const vastaus of kuuntelijat) vastaus.write(": ping\n\n");
}, 15_000);

palvelin.listen(PORTTI, "127.0.0.1", () => {
  loki(`Silta käynnissä: http://localhost:${PORTTI} (tila: ${asetukset.tila})`);
  loki(`Näytön osoitteeseen: /naytto?silta=http://localhost:${PORTTI}`);
});

// --- Tunnistus: REST ---

let puuttuvaIlmoitettu = false;

async function kyseleResolumea() {
  try {
    const vastaus = await fetch(`${asetukset.resolume}/api/v1/composition`, { signal: AbortSignal.timeout(1500) });
    if (!vastaus.ok) throw new Error(`HTTP ${vastaus.status}`);
    const klipit = etsiKlipit(await vastaus.json(), asetukset.klippi);
    if (!klipit.length && !puuttuvaIlmoitettu) loki(`⚠ Klippiä "${asetukset.klippi}" ei löydy aktiivisesta deckistä`);
    puuttuvaIlmoitettu = !klipit.length;
    asetaTila({ resolume: true, nakyvissa: onNakyvissa(klipit), klipit });
  } catch (virhe) {
    if (tila.resolume) loki("Resolumen kysely epäonnistui:", virhe.message);
    asetaTila({ resolume: false, nakyvissa: true, klipit: [] });
  }
}

// --- Tunnistus: OSC ---

function kuunteleOsc() {
  const kytketyt = new Map();
  const soketti = createSocket("udp4");
  soketti.on("message", (paketti) => {
    let viestit;
    try {
      viestit = lueOsc(paketti);
    } catch {
      return;
    }
    let muuttui = false;
    for (const { osoite, argumentit } of viestit) {
      if (!osoiteTasmaa(asetukset["osc-osoite"], osoite)) continue;
      kytketyt.set(osoite, onKytketty(argumentit[0]));
      muuttui = true;
    }
    if (!muuttui) return;
    const klipit = [...kytketyt].map(([osoite, kytketty]) => ({ osoite, kytketty }));
    asetaTila({ resolume: true, nakyvissa: klipit.some((k) => k.kytketty), klipit });
  });
  soketti.on("error", (virhe) => loki("OSC-virhe:", virhe.message));
  soketti.bind(Number(asetukset["osc-portti"]), () => loki(`Kuunnellaan OSC:tä portissa ${asetukset["osc-portti"]}: ${asetukset["osc-osoite"]}`));
}

// --- Tunnistus: simulointi ilman Resolumea ---

function simuloi() {
  const nakyvissa = Number(asetukset["simuloi-nakyvissa"]) * 1000;
  const piilossa = Number(asetukset["simuloi-piilossa"]) * 1000;
  const vaihda = (nakyy) => {
    asetaTila({ resolume: true, nakyvissa: nakyy, klipit: [{ nimi: "Simuloitu", kytketty: nakyy }] });
    setTimeout(() => vaihda(!nakyy), nakyy ? nakyvissa : piilossa);
  };
  vaihda(false);
}

if (asetukset.tila === "rest") {
  loki(`Kysellään Resolumea: ${asetukset.resolume} · klippi "${asetukset.klippi}"`);
  kyseleResolumea();
  setInterval(kyseleResolumea, Number(asetukset.vali));
} else if (asetukset.tila === "osc") {
  kuunteleOsc();
} else if (asetukset.tila === "simuloi") {
  simuloi();
} else {
  console.error(`Tuntematon tila: ${asetukset.tila} (rest | osc | simuloi)`);
  process.exit(1);
}
