// Kestotesti: pyörittää näyttöä Chromessa tunteja ja mittaa välein muistin, DOM-solmut, kuvataajuuden
// sekä renderöinti- ja GPU-prosessin muistin ja suoritinkäytön Chrome DevTools Protocolilla.
// Ei riippuvuuksia (Node 22+). Tulokset: kestotesti-tulokset/<aika>/ (CSV, kuvakaappaukset, yhteenveto).
//
//   npm run build && npm start             (tuotantobuild, toisessa terminaalissa)
//   npm run kestotesti                      (12 h, /naytto?demo=40&skaala=1, näkymätön Chrome)
//   npm run kestotesti -- --tunnit 0.25 --vali 15
//   npm run kestotesti -- --nakyva --url "http://localhost:3000/naytto?demo=40"
//
// Näkymätön Chrome renderöi ilman näytönohjainta, joten sen kuvataajuus ei vastaa playout-konetta.
// Muistivuodot näkyvät silti. Kuvataajuus mitataan --nakyva-tilassa playout-konetta vastaavalla koneella.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { analysoi } from "./kestotesti-analyysi.mjs";

// --- Asetukset ---

const asetukset = {
  url: "http://localhost:3000/naytto?demo=40&skaala=1",
  tunnit: 12,
  vali: 60,
  leveys: 4032,
  korkeus: 1152,
  nakyva: false,
  chrome: null,
  kansio: "kestotesti-tulokset",
};
const argumentit = process.argv.slice(2);
for (let i = 0; i < argumentit.length; i++) {
  const nimi = argumentit[i].replace(/^--/, "");
  if (nimi === "nakyva") asetukset.nakyva = true;
  else if (nimi in asetukset) asetukset[nimi] = typeof asetukset[nimi] === "number" ? Number(argumentit[++i]) : argumentit[++i];
  else {
    console.error(`Tuntematon valitsin: ${argumentit[i]}`);
    process.exit(1);
  }
}

function etsiChrome() {
  if (asetukset.chrome) return asetukset.chrome;
  const ehdokkaat = {
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
    win32: [
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  }[platform()] ?? [];
  const polku = ehdokkaat.find((p) => existsSync(p));
  if (!polku) {
    console.error("Chromea ei löytynyt. Anna polku: --chrome <polku>");
    process.exit(1);
  }
  return polku;
}

// --- Chrome DevTools Protocol ---

class Cdp {
  #ws;
  #id = 0;
  #odottavat = new Map();
  #kuuntelijat = new Map();

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener("message", (e) => {
      const viesti = JSON.parse(e.data);
      if (viesti.id !== undefined) {
        const odottava = this.#odottavat.get(viesti.id);
        this.#odottavat.delete(viesti.id);
        if (viesti.error) odottava?.hylkaa(new Error(`${viesti.error.message} (${odottava.metodi})`));
        else odottava?.ratkaise(viesti.result);
      } else {
        for (const kuuntelija of this.#kuuntelijat.get(viesti.method) ?? []) kuuntelija(viesti.params, viesti.sessionId);
      }
    });
  }

  laheta(metodi, parametrit = {}, sessionId) {
    const id = ++this.#id;
    this.#ws.send(JSON.stringify({ id, method: metodi, params: parametrit, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((ratkaise, hylkaa) => this.#odottavat.set(id, { ratkaise, hylkaa, metodi }));
  }

  kuuntele(metodi, kuuntelija) {
    this.#kuuntelijat.set(metodi, [...(this.#kuuntelijat.get(metodi) ?? []), kuuntelija]);
  }
}

// Laskee kehykset sivun sisällä. Asennetaan jokaiseen latautuvaan dokumenttiin.
const KEHYSLASKURI = `(() => {
  const m = { kehyksia: 0 };
  window.__kesto = m;
  const k = () => { m.kehyksia++; requestAnimationFrame(k); };
  requestAnimationFrame(k);
})();`;

const mt = (tavut) => Math.round((tavut / 1048576) * 10) / 10;

/** Prosessin muisti (RSS) megatavuina. Windowsissa ei mitata. */
function rssMt(pid) {
  if (!pid || platform() === "win32") return null;
  try {
    return Math.round(Number(execFileSync("ps", ["-o", "rss=", "-p", String(pid)]).toString().trim()) / 102.4) / 10;
  } catch {
    return null;
  }
}

// --- Ajo ---

const alku = Date.now();
const kansio = join(asetukset.kansio, new Date(alku).toISOString().replace(/[:.]/g, "-").slice(0, 19));
mkdirSync(kansio, { recursive: true });
const csv = join(kansio, "mittaukset.csv");
writeFileSync(
  csv,
  "aika,kulunut_min,heap_mt,heap_varattu_mt,dom_solmuja,kuuntelijoita,fps,renderoija_rss_mt,gpu_rss_mt,renderoija_cpu_pros,gpu_cpu_pros,latauksia,virheita\n",
);

const profiili = mkdtempSync(join(tmpdir(), "raapustamo-kesto-"));
const chrome = spawn(
  etsiChrome(),
  [
    `--user-data-dir=${profiili}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    `--window-size=${asetukset.leveys},${asetukset.korkeus}`,
    // Taustalla tai peitettynä Chrome hidastaisi ajastimet ja animaation, mikä vääristäisi mittauksen.
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--enable-precise-memory-info",
    ...(asetukset.nakyva ? [] : ["--headless=new", "--hide-scrollbars"]),
    "about:blank",
  ],
  { stdio: "ignore" },
);

let lopetetaan = false;
chrome.on("exit", (koodi) => {
  if (!lopetetaan) {
    console.error(`Chrome sulkeutui odottamatta (koodi ${koodi}).`);
    void lopeta(1);
  }
});

// Chrome kirjoittaa DevTools-portin profiilikansioon.
const porttitiedosto = join(profiili, "DevToolsActivePort");
for (let i = 0; i < 150 && !existsSync(porttitiedosto); i++) await new Promise((r) => setTimeout(r, 100));
if (!existsSync(porttitiedosto)) {
  console.error("Chrome ei käynnistynyt DevTools-portin kanssa.");
  process.exit(1);
}
const [portti, polku] = readFileSync(porttitiedosto, "utf8").trim().split("\n");
const ws = new WebSocket(`ws://127.0.0.1:${portti}${polku}`);
await new Promise((ratkaise, hylkaa) => {
  ws.addEventListener("open", ratkaise, { once: true });
  ws.addEventListener("error", hylkaa, { once: true });
});
const cdp = new Cdp(ws);

const { targetInfos } = await cdp.laheta("Target.getTargets");
const sivu = targetInfos.find((t) => t.type === "page");
const { sessionId: s } = await cdp.laheta("Target.attachToTarget", { targetId: sivu.targetId, flatten: true });

let latauksia = -1; // ensimmäinen lataus ei ole uudelleenlataus
let virheita = 0;
let kaatumisia = 0;
const kirjaaVirhe = (teksti) => {
  virheita += 1;
  appendFileSync(join(kansio, "virheet.log"), `${new Date().toISOString()} ${teksti}\n`);
};

cdp.kuuntele("Page.frameNavigated", ({ frame }) => {
  if (!frame.parentId) latauksia += 1;
});
cdp.kuuntele("Runtime.exceptionThrown", ({ exceptionDetails: d }) => kirjaaVirhe(`Poikkeus: ${d.exception?.description ?? d.text}`));
cdp.kuuntele("Runtime.consoleAPICalled", ({ type, args }) => {
  if (type === "error") kirjaaVirhe(`console.error: ${args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 500)}`);
});
cdp.kuuntele("Inspector.targetCrashed", () => {
  kaatumisia += 1;
  kirjaaVirhe("Välilehti kaatui, ladataan uudelleen");
  void cdp.laheta("Page.navigate", { url: asetukset.url }, s).catch(() => {});
});

await Promise.all(["Page.enable", "Runtime.enable", "Performance.enable", "Inspector.enable"].map((m) => cdp.laheta(m, {}, s)));
await cdp.laheta("Page.addScriptToEvaluateOnNewDocument", { source: KEHYSLASKURI }, s);
// Näkymättömän Chromen ikkunakoko ei ole sama kuin sivun näkymä, joten näkymä asetetaan suoraan
// screenin kokoiseksi (oletus 4032 × 1152), jotta mittaus vastaa natiivia 1:1-ulostuloa.
if (!asetukset.nakyva) {
  await cdp.laheta("Emulation.setDeviceMetricsOverride", { width: asetukset.leveys, height: asetukset.korkeus, deviceScaleFactor: 1, mobile: false }, s);
}
await cdp.laheta("Page.navigate", { url: asetukset.url }, s);

console.log(`Kestotesti: ${asetukset.url}`);
console.log(`Kesto ${asetukset.tunnit} h, mittaus ${asetukset.vali} s välein, ${asetukset.nakyva ? "näkyvä" : "näkymätön"} Chrome ${asetukset.leveys} × ${asetukset.korkeus}`);
console.log(`Tulokset: ${kansio}  (Ctrl+C lopettaa ja tekee yhteenvedon)\n`);

const rivit = [];
let edellinen = null;
let seuraavaKuva = 5;

async function kuvakaappaus(nimi) {
  try {
    const { data } = await cdp.laheta("Page.captureScreenshot", { format: "jpeg", quality: 60 }, s);
    writeFileSync(join(kansio, `${nimi}.jpg`), Buffer.from(data, "base64"));
  } catch (virhe) {
    console.warn("Kuvakaappaus epäonnistui", virhe.message);
  }
}

async function mittaa() {
  const nyt = Date.now();
  const kulunutMin = Math.round(((nyt - alku) / 60_000) * 10) / 10;
  const { metrics } = await cdp.laheta("Performance.getMetrics", {}, s);
  const metriikka = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  const { result } = await cdp.laheta(
    "Runtime.evaluate",
    { expression: "JSON.stringify({ k: window.__kesto?.kehyksia ?? null, t: performance.now() })", returnByValue: true },
    s,
  );
  const sivulla = JSON.parse(result.value);
  const { processInfo } = await cdp.laheta("SystemInfo.getProcessInfo");
  const renderoija = processInfo.find((p) => p.type === "renderer");
  const gpu = processInfo.find((p) => p.type === "GPU");

  // Kuvataajuus ja suoritin edellisestä mittauksesta. Uudelleenlataus nollaa sivun laskurit.
  const samaSivu = edellinen && sivulla.t > edellinen.t && sivulla.k !== null && edellinen.k !== null;
  const fps = samaSivu ? Math.round(((sivulla.k - edellinen.k) / ((sivulla.t - edellinen.t) / 1000)) * 10) / 10 : null;
  const cpu = (nykyinen, aiempi) =>
    nykyinen && aiempi && edellinen ? Math.round(((nykyinen.cpuTime - aiempi.cpuTime) / ((nyt - edellinen.aika) / 1000)) * 1000) / 10 : null;
  const renderoijaCpu = cpu(renderoija, edellinen?.renderoija);
  const gpuCpu = cpu(gpu, edellinen?.gpu);
  edellinen = { ...sivulla, aika: nyt, renderoija, gpu };

  const rivi = {
    kulunutMin,
    heapMb: mt(metriikka.JSHeapUsedSize),
    heapVarattuMb: mt(metriikka.JSHeapTotalSize),
    domSolmuja: metriikka.Nodes,
    kuuntelijoita: metriikka.JSEventListeners,
    fps,
    renderoijaRss: rssMt(renderoija?.id),
    gpuRss: rssMt(gpu?.id),
  };
  rivit.push(rivi);
  appendFileSync(
    csv,
    [
      new Date(nyt).toISOString(),
      kulunutMin,
      rivi.heapMb,
      rivi.heapVarattuMb,
      rivi.domSolmuja,
      rivi.kuuntelijoita,
      fps ?? "",
      rivi.renderoijaRss ?? "",
      rivi.gpuRss ?? "",
      renderoijaCpu ?? "",
      gpuCpu ?? "",
      Math.max(0, latauksia),
      virheita,
    ].join(",") + "\n",
  );
  console.log(
    `[${kulunutMin.toFixed(1).padStart(6)} min] heap ${rivi.heapMb} Mt · DOM ${rivi.domSolmuja} · ${fps ?? "–"} fps` +
      ` · renderöijä ${rivi.renderoijaRss ?? "–"} Mt / ${renderoijaCpu ?? "–"} % · GPU ${rivi.gpuRss ?? "–"} Mt / ${gpuCpu ?? "–"} %` +
      ` · latauksia ${Math.max(0, latauksia)} · virheitä ${virheita}`,
  );

  if (kulunutMin >= seuraavaKuva) {
    await kuvakaappaus(`kuva-${String(Math.round(kulunutMin)).padStart(4, "0")}min`);
    seuraavaKuva = seuraavaKuva < 60 ? 60 : seuraavaKuva + 60;
  }
}

async function lopeta(koodi) {
  if (lopetetaan) return;
  lopetetaan = true;
  clearInterval(mittaukset);
  clearTimeout(ajastin);
  const tulos = analysoi(rivit, { latauksia: Math.max(0, latauksia), virheita, kaatumisia });
  if (ws.readyState === WebSocket.OPEN) await kuvakaappaus("kuva-loppu");
  writeFileSync(join(kansio, "yhteenveto.json"), JSON.stringify({ asetukset, ...tulos }, null, 2));
  const pyorista = (n, d = 1) => (n === null ? "–" : n.toFixed(d));
  console.log(`
--- Yhteenveto (${pyorista(tulos.kestoMin / 60, 2)} h) ---
JS-muisti:        ${pyorista(tulos.heapAlkuMb)} → ${pyorista(tulos.heapLoppuMb)} Mt (maksimi ${pyorista(tulos.heapMaksimiMb)}), kasvu ${pyorista(tulos.kasvuMbH, 2)} Mt/h
DOM-solmut:       kasvu ${pyorista(tulos.solmuKasvuH, 0)} / h
Kuvataajuus:      mediaani ${pyorista(tulos.fpsMediaani, 0)}, minimi ${pyorista(tulos.fpsMinimi, 0)} fps${asetukset.nakyva ? "" : " (näkymätön Chrome: ei vertailukelpoinen playout-koneeseen)"}
Uudelleenlataukset ${tulos.latauksia}, kaatumiset ${tulos.kaatumisia}, virheet ${tulos.virheita}
Tulos:            ${tulos.ok ? "OK" : "TARKISTA"}${tulos.huomiot.map((h) => `\n  - ${h}`).join("")}
Tiedostot:        ${kansio}`);
  try {
    ws.close();
  } catch {}
  chrome.kill();
  setTimeout(() => {
    try {
      rmSync(profiili, { recursive: true, force: true });
    } catch {}
    process.exit(koodi ?? (tulos.ok ? 0 : 1));
  }, 500);
}

const mittaukset = setInterval(() => void mittaa().catch((virhe) => console.warn("Mittaus epäonnistui:", virhe.message)), asetukset.vali * 1000);
const ajastin = setTimeout(() => void lopeta(), asetukset.tunnit * 3_600_000);
process.on("SIGINT", () => void lopeta());
process.on("SIGTERM", () => void lopeta());
ws.addEventListener("close", () => {
  if (!lopetetaan) {
    console.error("Yhteys Chromeen katkesi.");
    void lopeta(1);
  }
});
