"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import qrcode from "qrcode-generator";
import { demopiirros, demopiirrokset } from "@/lib/demopiirrokset";
import { seuraavaPiirros } from "@/lib/jono";
import { piirraPiirros, tunnus } from "@/lib/piirto";
import { lueNayttoavain } from "@/lib/nayttoavain";
import { NAYTTOKANAVA, NAYTTOKANAVAN_ASETUKSET, selainAsiakas } from "@/lib/supabase/selain";
import type { NaytettavaPiirros } from "@/lib/tyypit";
import { luoAvaruus, type Avaruus } from "./avaruus";
import { glitch, pehmea } from "./efektit";
import "./naytto.css";

export type Layout = "avaruus" | "trio" | "solo" | "seina";

interface Props {
  layout: Layout;
  /** Piirrosten vaihtoväli sekunteina (avaruudessa: uusi piirros vaihtoS / 3 sekunnin välein) */
  vaihtoS: number;
  /** Avaruus: montako piirrosta on näkyvissä yhtä aikaa */
  maara: number;
  naytaQr: boolean;
  /** QR-koodin osoite; oletuksena tämän palvelimen piirtonäkymä */
  qrUrl: string | null;
  /** QR-koodin alla näytettävä lyhyt osoite */
  osoite: string;
  /** null = sovita ikkunaan (esikatselu), 1 = natiivi 1:1-ulostulo */
  skaala: number | null;
  /** Näytön tunniste sykkeessä, esim. "led-1" */
  tunnus: string;
  /** Ajastettu uudelleenlataus minuutteina muistivuotojen varalle, 0 = pois */
  uudelleenlatausMin: number;
  /** Resolume-sillan osoite (silta/silta.mjs), esim. http://localhost:7400 – null = ei siltaa */
  siltaUrl: string | null;
  /** Demotila (`?demo=40`): generoidut piirrokset ilman tietokantaa, kestotestiin ja esittelyyn. 0 = pois */
  demo: number;
}

const LEVEYS = 4032;
const KORKEUS = 1152;
const PIIRTYMINEN = 4200;
const ULOS = 380;
const MIKRO = 180;
const PAIVITYSVALI = 20_000;
const VALIMUISTI = "raapustamo:naytto:v1";
const SYKEVALI = 30_000;
/** Jos animaatio on jumissa näin kauan näkyvällä sivulla, sivu ladataan uudelleen. */
const JUMIRAJA = 30_000;
/** Näin monta virhettä minuutissa → uudelleenlataus */
const VIRHERAJA = 20;
const KENTAT = "id, nro, luotu, viivat, nostettu, nayttokerrat, viimeksi_naytetty";
/** Tauolta paluun animaation kesto (ks. naytto.css: tauko-sulkeutuu) */
const PALUU = 1400;
const SIVUPALKKI = 576;
/** Demotilassa uusi piirros "hyväksytään" näin usein ja vanhin poistuu */
const DEMO_UUSI = 30_000;
/** Demotilassa hätäpysäytys ja paluu näin usein (8 s tauko) */
const DEMO_TAUKO = 15 * 60_000;

type Vaihe = "tyhja" | "ulos" | "piirtyy" | "valmis" | "mikro";

interface Solu {
  koko: number;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  puskuri: HTMLCanvasElement;
  pctx: CanvasRenderingContext2D;
  piirros: NaytettavaPiirros | null;
  seuraava: NaytettavaPiirros | null;
  uusi: boolean;
  /** Piirros vaihtui, kun klippi ei ollut screenillä: näyttökerta kirjataan vasta näkyviin tullessa. */
  kirjaamatta: boolean;
  vaihe: Vaihe;
  alku: number;
  seuraavaMikro: number;
}

type Tiedot = { nro: number; uusi: boolean } | null;

function lueValimuisti(): NaytettavaPiirros[] {
  try {
    return JSON.parse(localStorage.getItem(VALIMUISTI) ?? "[]");
  } catch {
    return [];
  }
}

function kirjoitaValimuisti(lista: NaytettavaPiirros[]) {
  try {
    localStorage.setItem(VALIMUISTI, JSON.stringify(lista));
  } catch {
    // Täysi tai estetty tallennustila: näyttö toimii silti verkosta.
  }
}

function QrKoodi({ url }: { url: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    canvas.width = canvas.height = n * 10;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, n * 10, n * 10);
    ctx.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(c * 10, r * 10, 10, 10);
  }, [url]);
  return (
    <div className="qr-laatikko">
      <canvas ref={ref} />
    </div>
  );
}

export default function Naytto({ layout, vaihtoS, maara, naytaQr, qrUrl, osoite, skaala, tunnus: nayttoTunnus, uudelleenlatausMin, siltaUrl, demo }: Props) {
  // Demotila ei koske tietokantaan: ei sykettä, näyttökertoja eikä oikeita piirroksia.
  const supabase = useMemo(() => (demo ? null : selainAsiakas()), [demo]);
  const solujenMaara = layout === "avaruus" ? 0 : layout === "trio" ? 3 : layout === "solo" ? 1 : 12;
  const koko = layout === "seina" ? 576 : 1152;
  const avaruusLeveys = naytaQr ? LEVEYS - SIVUPALKKI : LEVEYS;

  const juuriRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const avaruusRef = useRef<HTMLCanvasElement>(null);
  const [avaruusTyhja, setAvaruusTyhja] = useState(true);
  const [tiedot, setTiedot] = useState<Tiedot[]>(() => Array(solujenMaara).fill(null));
  const [tauko, setTauko] = useState(false);
  const taukoRef = useRef(false);
  taukoRef.current = tauko;
  const [muunnos, setMuunnos] = useState({ s: skaala ?? 1, x: 0, y: 0 });
  const [qrOsoite, setQrOsoite] = useState(qrUrl ?? "");

  // Hätäpysäytys tulee voimaan heti. Paluu animoidaan: taukoruutu glitchaa ja sulkeutuu
  // valoviivaksi, ja samaan aikaan piirrokset piirtyvät uudelleen esiin sen alla.
  const [taukoTila, setTaukoTila] = useState<"pois" | "paalla" | "poistuu">("pois");
  const paluuRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (tauko) setTaukoTila("paalla");
    else setTaukoTila((vanha) => (vanha === "paalla" ? "poistuu" : vanha));
  }, [tauko]);
  useEffect(() => {
    if (taukoTila !== "poistuu") return;
    paluuRef.current();
    const ajastin = setTimeout(() => setTaukoTila("pois"), PALUU);
    return () => clearTimeout(ajastin);
  }, [taukoTila]);

  // Kehityksessä tauon voi kokeilla konsolista ilman moderointia: raapustamo.tauko(true)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { raapustamo: object }).raapustamo = { tauko: setTauko };
  }, []);

  useEffect(() => {
    if (!qrUrl) setQrOsoite(`${location.origin}/`);
  }, [qrUrl]);

  // --- Skaalaus ---
  useEffect(() => {
    const sovita = () => {
      if (skaala) return setMuunnos({ s: skaala, x: 0, y: 0 });
      const s = Math.min(innerWidth / LEVEYS, innerHeight / KORKEUS);
      setMuunnos({ s, x: (innerWidth - LEVEYS * s) / 2, y: (innerHeight - KORKEUS * s) / 2 });
    };
    sovita();
    addEventListener("resize", sovita);
    return () => removeEventListener("resize", sovita);
  }, [skaala]);

  // --- Moottori: data, jono ja animaatio ---
  useEffect(() => {
    const solut: Solu[] = canvasRefs.current.slice(0, solujenMaara).map((canvas) => {
      const puskuri = document.createElement("canvas");
      puskuri.width = puskuri.height = koko;
      return {
        koko,
        canvas: canvas!,
        ctx: canvas!.getContext("2d")!,
        puskuri,
        pctx: puskuri.getContext("2d")!,
        piirros: null,
        seuraava: null,
        uusi: false,
        kirjaamatta: false,
        vaihe: "tyhja",
        alku: 0,
        seuraavaMikro: 0,
      };
    });

    const piirrokset = new Map<string, NaytettavaPiirros>((demo ? demopiirrokset(demo) : lueValimuisti()).map((p) => [p.id, p]));
    // Demotila ei ylikirjoita playout-koneen välimuistia generoiduilla piirroksilla.
    const tallennaValimuisti = (lista: NaytettavaPiirros[]) => !demo && kirjoitaValimuisti(lista);
    let avaruus: Avaruus | null = null;

    // Resolume-silta kertoo, onko Raapustamo-klippi screenillä. Ilman siltaa tai sen yhteyttä
    // oletetaan, että näyttö näkyy aina, jotta piirrokset kiertävät joka tapauksessa.
    const silta = { yhteys: false, nakyvissa: false };
    const naytetaan = () => !siltaUrl || !silta.yhteys || silta.nakyvissa;
    const merkitseSilta = () => {
      if (!juuriRef.current) return;
      juuriRef.current.dataset.silta = !siltaUrl ? "ei-kaytossa" : !silta.yhteys ? "ei-yhteytta" : silta.nakyvissa ? "nakyvissa" : "piilossa";
    };

    function kirjaaNaytetyksi(p: NaytettavaPiirros) {
      p.nayttokerrat += 1;
      p.viimeksi_naytetty = new Date().toISOString();
      supabase?.rpc("merkitse_naytetyksi", { piirros: p.id }).then(({ error }) => error && console.warn("Näyttökerran kirjaus epäonnistui", error));
    }
    const paivitaTiedot = () => setTiedot(solut.map((s) => (s.piirros ? { nro: s.piirros.nro, uusi: s.uusi } : null)));

    if (layout === "avaruus" && avaruusRef.current) {
      avaruus = luoAvaruus({
        canvas: avaruusRef.current,
        maara,
        vali: (vaihtoS * 1000) / 3,
        valitse: (poissulje) => seuraavaPiirros([...piirrokset.values()], poissulje),
        kirjaa: kirjaaNaytetyksi,
        aktiivinen: () => !taukoRef.current && naytetaan(),
        muuttui: (nrot) => setAvaruusTyhja(nrot.length === 0),
      });
    }

    function piirraSisalto(s: Solu, edistyminen: number) {
      if (!s.piirros) return;
      const reuna = s.koko * 0.07;
      s.ctx.save();
      s.ctx.translate(reuna, reuna);
      // Ohuet viivat katoavat LED-screenillä: vähintään 8 px leveä viiva (≈ 2 cm).
      piirraPiirros(s.ctx, s.piirros, s.koko - reuna * 2, { edistyminen, minPx: 8 });
      s.ctx.restore();
    }

    function aloitaPiirtyminen(s: Solu, nyt: number) {
      s.piirros = s.seuraava;
      s.seuraava = null;
      s.vaihe = s.piirros ? "piirtyy" : "tyhja";
      s.alku = nyt;
      s.ctx.clearRect(0, 0, s.koko, s.koko);
      paivitaTiedot();
    }

    function paivitaSolu(s: Solu, nyt: number) {
      const t = nyt - s.alku;
      if (s.vaihe === "ulos") {
        const v = Math.min(1, t / ULOS);
        glitch(s.ctx, s.puskuri, v);
        if (v >= 1) aloitaPiirtyminen(s, nyt);
      } else if (s.vaihe === "piirtyy") {
        const v = Math.min(1, t / PIIRTYMINEN);
        s.ctx.clearRect(0, 0, s.koko, s.koko);
        piirraSisalto(s, pehmea(v));
        if (v >= 1) {
          s.pctx.clearRect(0, 0, s.koko, s.koko);
          s.pctx.drawImage(s.canvas, 0, 0);
          s.vaihe = "valmis";
          s.seuraavaMikro = nyt + 6000 + Math.random() * 14000;
        }
      } else if (s.vaihe === "valmis" && nyt > s.seuraavaMikro) {
        s.vaihe = "mikro";
        s.alku = nyt;
      } else if (s.vaihe === "mikro") {
        if (t < MIKRO) {
          glitch(s.ctx, s.puskuri, 0.2);
        } else {
          s.ctx.clearRect(0, 0, s.koko, s.koko);
          s.ctx.drawImage(s.puskuri, 0, 0);
          s.vaihe = "valmis";
          s.seuraavaMikro = nyt + 6000 + Math.random() * 14000;
        }
      }
    }

    // Virhe yhdessä ruudussa ei saa pysäyttää koko näyttöä.
    const virheet: number[] = [];
    const kirjaaVirhe = (virhe: unknown) => {
      virheet.push(Date.now());
      console.error("Näytön virhe", virhe);
    };
    const virheKuuntelija = (e: ErrorEvent | PromiseRejectionEvent) => kirjaaVirhe("reason" in e ? e.reason : e.error);
    addEventListener("error", virheKuuntelija);
    addEventListener("unhandledrejection", virheKuuntelija);

    let kehysId = 0;
    let viimeisinKehys = performance.now();
    const kehys = (nyt: number) => {
      viimeisinKehys = nyt;
      try {
        avaruus?.kehys(nyt);
      } catch (virhe) {
        kirjaaVirhe(virhe);
      }
      for (const s of solut) {
        try {
          paivitaSolu(s, nyt);
        } catch (virhe) {
          kirjaaVirhe(virhe);
          s.vaihe = "tyhja";
          s.piirros = null;
          s.seuraava = null;
        }
      }
      kehysId = requestAnimationFrame(kehys);
    };
    kehysId = requestAnimationFrame(kehys);

    function vaihdaSeuraavaan(s: Solu, pakota = false) {
      const naytolla = new Set(
        solut
          .filter((x) => x !== s)
          .flatMap((x) => [x.piirros?.id, x.seuraava?.id])
          .filter((id): id is string => Boolean(id)),
      );
      const p = seuraavaPiirros([...piirrokset.values()], naytolla);
      if (!p && !pakota) return;
      s.seuraava = p ?? null;
      s.uusi = p ? p.nayttokerrat === 0 : false;
      s.kirjaamatta = Boolean(p) && !naytetaan();
      if (p && naytetaan()) kirjaaNaytetyksi(p);
      if (s.vaihe === "tyhja") return aloitaPiirtyminen(s, performance.now());
      if (s.vaihe === "piirtyy") {
        // Kesken piirtymisen vaihdettaessa glitchataan ulos se, mitä ruudussa juuri nyt näkyy.
        s.pctx.clearRect(0, 0, s.koko, s.koko);
        s.pctx.drawImage(s.canvas, 0, 0);
      }
      s.vaihe = "ulos";
      s.alku = performance.now();
    }

    function kierros() {
      // Avaruudessa piirrokset vaihtuvat omaan tahtiinsa (luoAvaruus).
      if (avaruus || taukoRef.current || !naytetaan()) return;
      const kohteet = layout === "seina" ? [...solut].sort(() => Math.random() - 0.5).slice(0, 3) : solut;
      kohteet.forEach((s, i) => setTimeout(() => vaihdaSeuraavaan(s), i * 700));
    }

    /** Poistaa piirroksen heti screeniltä (hylätty tai piilotettu moderoinnissa). */
    function poista(id: string) {
      piirrokset.delete(id);
      tallennaValimuisti([...piirrokset.values()]);
      avaruus?.poista(id);
      for (const s of solut) {
        if (s.piirros?.id === id || s.seuraava?.id === id) vaihdaSeuraavaan(s, true);
      }
    }

    function tayta() {
      avaruus?.tayta();
      for (const s of solut) if (!s.piirros && !s.seuraava) vaihdaSeuraavaan(s);
    }

    async function lataa() {
      if (!supabase) return;
      // Hätäpysäytyksen lopullinen totuus on tietokannassa. Se tarkistetaan joka kerta, jottei
      // saamatta jäänyt komento jätä näyttöä väärään tilaan pidemmäksi aikaa kuin yhdeksi väliksi.
      const { data: asetus } = await supabase.from("asetukset").select("arvo").eq("avain", "naytto").single();
      if (asetus) setTauko(Boolean(asetus.arvo?.tauko));
      const { data, error } = await supabase.from("piirrokset").select(KENTAT).eq("tila", "hyvaksytty");
      if (error || !data) return console.warn("Piirrosten haku epäonnistui – jatketaan välimuistista", error);
      const tuoreet = new Map((data as NaytettavaPiirros[]).map((p) => [p.id, p]));
      for (const id of [...piirrokset.keys()]) if (!tuoreet.has(id)) poista(id);
      for (const [id, p] of tuoreet) piirrokset.set(id, p);
      tallennaValimuisti([...piirrokset.values()]);
      tayta();
    }

    // Aloitus: välimuistista heti, sitten verkosta
    solut.forEach((s, i) => setTimeout(() => vaihdaSeuraavaan(s, true), 300 + i * (layout === "seina" ? 250 : 700)));
    lataa();
    const paivitys = setInterval(lataa, PAIVITYSVALI);

    // Demotila käy läpi samat polut kuin festivaalilla: uusia hyväksyntöjä, poistoja sekä hätäpysäytys
    // ja paluu. Kestotesti (scripts/kestotesti.mjs) näkee näin myös näiden polkujen muistivuodot.
    let demoNro = demo;
    let demoTaukoAjastin: ReturnType<typeof setTimeout> | undefined;
    const demoUudet = demo
      ? setInterval(() => {
          const uusi = demopiirros(++demoNro);
          piirrokset.set(uusi.id, uusi);
          if (piirrokset.size > demo) poista(piirrokset.keys().next().value!);
          tayta();
        }, DEMO_UUSI)
      : undefined;
    const demoTauot = demo
      ? setInterval(() => {
          setTauko(true);
          demoTaukoAjastin = setTimeout(() => setTauko(false), 8000);
        }, DEMO_TAUKO)
      : undefined;
    let kierrokset = setInterval(kierros, vaihtoS * 1000);

    /** Klippi tuli screenille tai näyttö palasi tauolta: piirrokset piirtyvät esiin uudelleen ja kierros alkaa alusta. */
    function tuliNakyviin() {
      avaruus?.paluu();
      solut.forEach((s, i) =>
        setTimeout(() => {
          if (s.piirros && s.kirjaamatta) kirjaaNaytetyksi(s.piirros);
          s.kirjaamatta = false;
          if (!s.piirros) return vaihdaSeuraavaan(s);
          if (s.vaihe === "valmis" || s.vaihe === "mikro") {
            s.vaihe = "piirtyy";
            s.alku = performance.now();
          }
        }, i * (layout === "seina" ? 150 : 500)),
      );
      clearInterval(kierrokset);
      kierrokset = setInterval(kierros, vaihtoS * 1000);
    }

    let siltaLahde: EventSource | null = null;
    if (siltaUrl) {
      const paivitaSilta = (yhteys: boolean, nakyvissa: boolean) => {
        const ennen = naytetaan();
        silta.yhteys = yhteys;
        silta.nakyvissa = nakyvissa;
        merkitseSilta();
        if (!ennen && naytetaan()) tuliNakyviin();
      };
      siltaLahde = new EventSource(new URL("/tapahtumat", siltaUrl));
      siltaLahde.addEventListener("tila", (e) => {
        try {
          paivitaSilta(true, Boolean(JSON.parse((e as MessageEvent<string>).data).nakyvissa));
        } catch (virhe) {
          console.warn("Sillan viesti ei kelpaa", virhe);
        }
      });
      // EventSource yhdistää itse uudelleen; sillä välin näyttö kiertää kuin ilman siltaa.
      siltaLahde.onerror = () => paivitaSilta(false, silta.nakyvissa);
    }
    merkitseSilta();
    paluuRef.current = tuliNakyviin;

    // Syke: moderointi näkee, että screen on elossa ja mitä siinä näkyy. Syke vaatii näytön avaimen
    // (npm run nayttoavain), jottei kukaan muu voi lähettää sykettä tämän näytön nimissä.
    const kaynnistetty = Date.now();
    const nayttoavain = lueNayttoavain(nayttoTunnus);
    if (!nayttoavain) console.warn(`Näytön ${nayttoTunnus} avain puuttuu: syke ei näy moderoinnissa. Avaa asennusosoite (npm run nayttoavain).`);
    const syke = () => {
      if (!nayttoavain) return;
      const minuuttiSitten = Date.now() - 60_000;
      supabase
        ?.rpc("naytto_syke", {
          naytto: nayttoTunnus,
          avain: nayttoavain,
          syke_tiedot: {
            versio: process.env.NEXT_PUBLIC_VERSIO ?? "dev",
            layout,
            tauko: taukoRef.current,
            verkossa: navigator.onLine,
            piirroksia: piirrokset.size,
            naytolla: avaruus ? avaruus.naytolla() : solut.flatMap((s) => (s.piirros ? [s.piirros.nro] : [])),
            kaynnissa_min: Math.round((Date.now() - kaynnistetty) / 60_000),
            virheita_min: virheet.filter((t) => t > minuuttiSitten).length,
            silta: siltaUrl ? { yhteys: silta.yhteys, nakyvissa: silta.nakyvissa } : null,
          },
        })
        .then(({ error }) => error && console.warn("Syke epäonnistui", error.message));
    };
    syke();
    const sykkeet = setInterval(syke, SYKEVALI);

    // Vahtikoira: jumittunut animaatio tai virheiden tulva → uudelleenlataus.
    const vahti = setInterval(() => {
      const jumissa = document.visibilityState === "visible" && performance.now() - viimeisinKehys > JUMIRAJA;
      const minuuttiSitten = Date.now() - 60_000;
      if (jumissa || virheet.filter((t) => t > minuuttiSitten).length > VIRHERAJA) location.reload();
    }, 10_000);
    const ajastettu = uudelleenlatausMin > 0 ? setTimeout(() => location.reload(), uudelleenlatausMin * 60_000) : undefined;

    let muutokset: RealtimeChannel | null = null;
    let komennot: RealtimeChannel | null = null;
    if (supabase) {
      // Hyväksytyt piirrokset tulevat realtime-muutoksina. Hylkäys/piilotus ei näy anonyymille
      // RLS:n vuoksi, joten moderointi lähettää siitä erillisen broadcast-komennon.
      muutokset = supabase
        .channel("naytto-muutokset")
        .on("postgres_changes", { event: "*", schema: "public", table: "piirrokset" }, (muutos) => {
          const p = muutos.new as NaytettavaPiirros & { tila?: string };
          if (muutos.eventType === "DELETE") return poista((muutos.old as { id: string }).id);
          if (p.tila && p.tila !== "hyvaksytty") return poista(p.id);
          const vanha = piirrokset.get(p.id);
          piirrokset.set(p.id, vanha ? { ...vanha, nostettu: p.nostettu } : p);
          tallennaValimuisti([...piirrokset.values()]);
          tayta();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "asetukset" }, (muutos) => {
          const rivi = muutos.new as { avain: string; arvo: { tauko?: boolean } };
          if (rivi.avain === "naytto") setTauko(Boolean(rivi.arvo.tauko));
        })
        .subscribe();
      // Yksityinen kanava: kuunnella saa kuka tahansa, lähettää vain moderaattorit (migraatio 0005).
      const kanava = supabase
        .channel(NAYTTOKANAVA, NAYTTOKANAVAN_ASETUKSET)
        .on("broadcast", { event: "piilota" }, ({ payload }) => poista(payload.id))
        .on("broadcast", { event: "tauko" }, ({ payload }) => setTauko(Boolean(payload.tauko)));
      komennot = kanava;
      void supabase.realtime.setAuth().then(() => komennot === kanava && kanava.subscribe());
    }

    return () => {
      cancelAnimationFrame(kehysId);
      clearInterval(paivitys);
      clearInterval(demoUudet);
      clearInterval(demoTauot);
      clearTimeout(demoTaukoAjastin);
      clearInterval(kierrokset);
      clearInterval(sykkeet);
      siltaLahde?.close();
      clearInterval(vahti);
      clearTimeout(ajastettu);
      removeEventListener("error", virheKuuntelija);
      removeEventListener("unhandledrejection", virheKuuntelija);
      if (muutokset) supabase?.removeChannel(muutokset);
      if (komennot) supabase?.removeChannel(komennot);
      komennot = null;
    };
  }, [supabase, layout, koko, solujenMaara, vaihtoS, maara, nayttoTunnus, uudelleenlatausMin, siltaUrl, demo]);

  // Service Worker: näyttö käynnistyy välimuistista myös ilman verkkoa (vain tuotannossa,
  // koska kehityspalvelimen tiedostot muuttuvat jatkuvasti).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/naytto-sw.js", { scope: "/naytto" }).catch((virhe) => console.warn("Service Worker epäonnistui", virhe));
  }, []);

  const solut = Array.from({ length: solujenMaara }, (_, i) => (
    <div key={i} className="solu" style={{ width: koko, height: koko }}>
      <canvas
        ref={(el) => {
          canvasRefs.current[i] = el;
        }}
        width={koko}
        height={koko}
      />
      {tiedot[i] ? (
        <div className="solu-tiedot">
          <span>{tunnus(tiedot[i].nro)}</span>
          {tiedot[i].uusi && <span className="uusi">Uusi</span>}
        </div>
      ) : (
        <div className="tyhja">
          <span className="otsikko">
            Sinun piirroksesi
            <br />
            tähän?
          </span>
          <span>Your drawing here?</span>
        </div>
      )}
    </div>
  ));

  return (
    <div className="nayttosivu" ref={juuriRef}>
      {demo > 0 && <div className="demo-merkki">Demo</div>}
      <div
        className="lava"
        data-layout={layout}
        style={{
          transform: `translate(${muunnos.x}px, ${muunnos.y}px) scale(${muunnos.s})`,
          ...(layout === "avaruus" && { gridTemplateColumns: naytaQr ? `${avaruusLeveys}px ${SIVUPALKKI}px` : `${LEVEYS}px` }),
        }}
      >
        {layout === "avaruus" && (
          <div className="avaruus">
            <canvas ref={avaruusRef} width={avaruusLeveys} height={KORKEUS} />
            {avaruusTyhja && (
              <div className="tyhja">
                <span className="otsikko">
                  Sinun piirroksesi
                  <br />
                  tähän?
                </span>
                <span>Your drawing here?</span>
              </div>
            )}
          </div>
        )}
        {layout === "solo" && (
          <section className="teksti-alue">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="supergrafiikka" src="/brand/latf-merkki-pysty.png" alt="" />
            <span className="ylaotsikko">Lumo Art &amp; Tech Festival · Raapustamo</span>
            <h1 className="otsikko">
              <span>Vieraskirja on paperia.</span>
              <span className="glitch glitch--hiljainen" data-teksti="…tai 30 neliötä valoa.">
                …tai 30 neliötä valoa.
              </span>
            </h1>
            <p>A guestbook is paper… or 30 m² of light.</p>
          </section>
        )}
        {layout === "seina" ? <div className="ruudukko">{solut}</div> : solut}
        {naytaQr && (
          <aside className="sivupalkki">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/brand/latf-logo-pysty.png" alt="Lumo Art & Tech Festival" />
            <div className="kehotus">
              <h2 className="otsikko">
                Piirrä
                <br />
                sinäkin!
              </h2>
              <span>Draw yours</span>
            </div>
            <div className="qr">
              {qrOsoite && <QrKoodi url={qrOsoite} />}
              <span className="qr-osoite">{osoite}</span>
            </div>
          </aside>
        )}
        {taukoTila !== "pois" && (
          <div className={taukoTila === "poistuu" ? "tauko poistuu" : "tauko"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/brand/latf-logo-vaaka.png" alt="Lumo Art & Tech Festival" />
            <div className="qr">
              <h2 className="otsikko">
                Raapustamo
                <br />
                palaa pian
              </h2>
              {qrOsoite && <QrKoodi url={qrOsoite} />}
              <span className="qr-osoite">{osoite}</span>
            </div>
          </div>
        )}
      </div>
      {muunnos.s !== 1 && (
        <div className="esikatselu-info">
          Esikatselu {Math.round(muunnos.s * 100)} % · 4032 × 1152 · ?layout=avaruus|trio|solo|seina · ?skaala=1
        </div>
      )}
    </div>
  );
}
