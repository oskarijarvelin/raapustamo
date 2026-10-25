"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Kayttoehdot, Tietosuojaseloste, type OikeudellinenSivu } from "@/components/oikeudelliset/Oikeudelliset";
import "@/components/oikeudelliset/oikeudelliset.css";
import { KOOT, KUMIN_VARI, MUSTEET, SIVELTIMET, piirraPiirros, piirraViiva, sovitaCanvas, tunnus } from "@/lib/piirto";
import { TURNSTILE_ACTION } from "@/lib/turnstile";
import type { Kieli, KokoId, SivellinId, Viiva } from "@/lib/tyypit";
import { TEKSTIT } from "./tekstit";
import "./piirto.css";

type Nakyma = "aloitus" | "piirto" | "kiitos";

const KAYTTAMATTOMYYS_MS = 60_000;
const LASKURI_S = 10;
const KIITOS_KIOSKISSA_MS = 15_000;
const HALKAISIJAT: Record<KokoId, number> = { s: 8, m: 14, l: 22 };
const TURNSTILE_SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;

interface TurnstileApi {
  render: (
    kohde: HTMLElement,
    asetukset: {
      sitekey: string;
      action: string;
      theme: "dark";
      language: Kieli;
      appearance: "interaction-only";
      size: "flexible";
      callback: (tunniste: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widget: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface Props {
  /** Kioskin tunniste (`?kiosk=ipad-1`) tai null mobiilissa */
  kioski: string | null;
  /** Kieli URL:stä (`?kieli=en`), muuten selaimen kielestä */
  kieli: Kieli | null;
}

export default function Piirtonakyma({ kioski, kieli: urlKieli }: Props) {
  const [kieli, setKieli] = useState<Kieli>(urlKieli ?? "fi");
  const T = TEKSTIT[kieli];
  const [nakyma, setNakyma] = useState<Nakyma>("aloitus");
  const [vari, setVari] = useState<string>(MUSTEET[0].hex);
  const [sivellin, setSivellin] = useState<SivellinId>("tussi");
  const [koko, setKoko] = useState<KokoId>("m");
  const [, setVersio] = useState(0);
  const paivita = () => setVersio((v) => v + 1);

  const viivat = useRef<Viiva[]>([]);
  const kumotut = useRef<Viiva[]>([]);

  useEffect(() => {
    if (!urlKieli) setKieli(navigator.language.toLowerCase().startsWith("fi") ? "fi" : "en");
  }, [urlKieli]);

  useEffect(() => {
    document.documentElement.lang = kieli;
  }, [kieli]);

  // --- Piirtoalusta ---

  const kehysRef = useRef<HTMLDivElement>(null);
  const kerrosRef = useRef<HTMLCanvasElement>(null);
  const pintaRef = useRef<HTMLCanvasElement>(null);
  const px = useRef(0);

  const piirraKaikki = useCallback(() => {
    const ctx = kerrosRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, px.current, px.current);
    for (const viiva of viivat.current) piirraViiva(ctx, viiva, px.current);
  }, []);

  useEffect(() => {
    if (nakyma !== "piirto" || !kehysRef.current) return;
    const kehys = kehysRef.current;
    const havainnoija = new ResizeObserver(() => {
      if (!kehys.clientWidth || !kerrosRef.current || !pintaRef.current) return;
      px.current = sovitaCanvas(kerrosRef.current, kehys.clientWidth);
      sovitaCanvas(pintaRef.current, kehys.clientWidth);
      piirraKaikki();
    });
    havainnoija.observe(kehys);
    return () => havainnoija.disconnect();
  }, [nakyma, piirraKaikki]);

  const nykyinen = useRef<{ pointerId: number; viiva: Viiva; alue: DOMRect; alku: number } | null>(null);
  const kynaHavaittu = useRef(false);
  const piirtopyynto = useRef(0);

  function lisaaPiste(e: PointerEvent) {
    const n = nykyinen.current;
    if (!n) return;
    const x = Math.min(1, Math.max(0, (e.clientX - n.alue.left) / n.alue.width));
    const y = Math.min(1, Math.max(0, (e.clientY - n.alue.top) / n.alue.height));
    const paine = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5;
    n.viiva.pisteet.push([+x.toFixed(4), +y.toFixed(4), +paine.toFixed(3), Math.round(e.timeStamp - n.alku)]);
  }

  function pyydaPiirto() {
    if (piirtopyynto.current) return;
    piirtopyynto.current = requestAnimationFrame(() => {
      piirtopyynto.current = 0;
      const ctx = pintaRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, px.current, px.current);
      if (nykyinen.current) piirraViiva(ctx, nykyinen.current.viiva, px.current, { kumiNakyvana: true });
    });
  }

  function aloitaViiva(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "pen") kynaHavaittu.current = true;
    // Kämmenen hylkäys: kun kynä on havaittu, sormet eivät piirrä.
    if (nykyinen.current || (kynaHavaittu.current && e.pointerType === "touch")) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synteettisillä tapahtumilla ei ole aktiivista osoitinta.
    }
    nykyinen.current = {
      pointerId: e.pointerId,
      alue: e.currentTarget.getBoundingClientRect(),
      alku: e.timeStamp,
      viiva: {
        vari: sivellin === "kumi" ? KUMIN_VARI : vari,
        koko: KOOT[koko],
        sivellin,
        paine: e.pointerType === "pen",
        pisteet: [],
      },
    };
    lisaaPiste(e.nativeEvent);
    pyydaPiirto();
    paivita(); // piilottaa vihjeen
  }

  function jatkaViivaa(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (nykyinen.current?.pointerId !== e.pointerId) return;
    const yhdistetyt = e.nativeEvent.getCoalescedEvents?.();
    for (const tapahtuma of yhdistetyt?.length ? yhdistetyt : [e.nativeEvent]) lisaaPiste(tapahtuma);
    pyydaPiirto();
  }

  function lopetaViiva(e: ReactPointerEvent<HTMLCanvasElement>) {
    const n = nykyinen.current;
    if (n?.pointerId !== e.pointerId) return;
    nykyinen.current = null;
    viivat.current.push(n.viiva);
    kumotut.current = [];
    const ctx = kerrosRef.current?.getContext("2d");
    if (ctx) piirraViiva(ctx, n.viiva, px.current);
    pintaRef.current?.getContext("2d")?.clearRect(0, 0, px.current, px.current);
    paivita();
  }

  // --- Kumoa / tee uudelleen / tyhjennä ---

  function kumoa() {
    const viiva = viivat.current.pop();
    if (!viiva) return;
    kumotut.current.push(viiva);
    piirraKaikki();
    paivita();
  }

  function teeUudelleen() {
    const viiva = kumotut.current.pop();
    if (!viiva) return;
    viivat.current.push(viiva);
    piirraKaikki();
    paivita();
  }

  const tyhjennaAlusta = useCallback(() => {
    viivat.current = [];
    kumotut.current = [];
    piirraKaikki();
    paivita();
  }, [piirraKaikki]);

  const [varmistaTyhjennys, setVarmistaTyhjennys] = useState(false);
  useEffect(() => {
    if (!varmistaTyhjennys) return;
    const ajastin = setTimeout(() => setVarmistaTyhjennys(false), 3000);
    return () => clearTimeout(ajastin);
  }, [varmistaTyhjennys]);

  function tyhjenna() {
    if (!varmistaTyhjennys) return setVarmistaTyhjennys(true);
    setVarmistaTyhjennys(false);
    tyhjennaAlusta();
  }

  const nakyviaPisteita = viivat.current.filter((v) => v.sivellin !== "kumi").reduce((s, v) => s + v.pisteet.length, 0);

  // --- Lähetys ---

  const dialogiRef = useRef<HTMLDialogElement>(null);
  const vahvistusRef = useRef<HTMLCanvasElement>(null);
  const [ehdot, setEhdot] = useState(false);
  const [lahetetaan, setLahetetaan] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [kiitos, setKiitos] = useState<{ nro: number; viivat: Viiva[] } | null>(null);

  // Kioskin avain tulee asennusosoitteesta (`?kiosk=ipad-1&avain=…`). Se tallennetaan
  // laitteelle ja poistetaan osoiteriviltä, jottei kävijä näe sitä.
  const kioskiavain = useRef<string | null>(null);
  useEffect(() => {
    if (!kioski) return;
    const avainNimi = `raapustamo:kioskiavain:${kioski}`;
    const url = new URL(window.location.href);
    const urlAvain = url.searchParams.get("avain");
    try {
      if (urlAvain) localStorage.setItem(avainNimi, urlAvain);
      kioskiavain.current = urlAvain ?? localStorage.getItem(avainNimi);
    } catch {
      kioskiavain.current = urlAvain;
    }
    if (urlAvain) {
      url.searchParams.delete("avain");
      history.replaceState(null, "", url);
    }
  }, [kioski]);

  // Turnstile: widget renderöidään vahvistusdialogiin, kun dialogi avataan ensimmäisen kerran.
  // Se näkyy vain, jos Cloudflare vaatii vuorovaikutusta. Tunniste on kertakäyttöinen.
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidget = useRef<string | null>(null);
  const [turnstileTunniste, setTurnstileTunniste] = useState("");
  const [turnstileVirhe, setTurnstileVirhe] = useState(!TURNSTILE_SITEKEY);

  function renderoiTurnstile() {
    const api = window.turnstile;
    if (!TURNSTILE_SITEKEY || !api || !turnstileRef.current || turnstileWidget.current !== null) return;
    if (!dialogiRef.current?.open) return;
    turnstileWidget.current = api.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITEKEY,
      action: TURNSTILE_ACTION,
      theme: "dark",
      language: kieli,
      appearance: "interaction-only",
      size: "flexible",
      callback: (tunniste) => {
        setTurnstileTunniste(tunniste);
        setTurnstileVirhe(false);
      },
      "expired-callback": () => setTurnstileTunniste(""),
      "error-callback": () => {
        setTurnstileTunniste("");
        setTurnstileVirhe(true);
      },
    });
  }

  function nollaaTurnstile() {
    setTurnstileTunniste("");
    if (turnstileWidget.current !== null) window.turnstile?.reset(turnstileWidget.current);
  }

  function avaaVahvistus() {
    setEhdot(false);
    setVirhe(null);
    dialogiRef.current?.showModal();
    if (turnstileWidget.current === null) renderoiTurnstile();
    else if (turnstileVirhe) {
      setTurnstileVirhe(false);
      nollaaTurnstile();
    }
    const canvas = vahvistusRef.current;
    if (!canvas) return;
    const p = sovitaCanvas(canvas, 96);
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, p, p);
    if (ctx) piirraPiirros(ctx, { viivat: viivat.current }, p);
  }

  async function laheta() {
    setLahetetaan(true);
    setVirhe(null);
    try {
      const vastaus = await fetch("/api/piirrokset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          viivat: viivat.current,
          lahde: kioski ?? "mobiili",
          kieli,
          turnstile: turnstileTunniste,
          ...(kioski ? { kioskiavain: kioskiavain.current } : {}),
        }),
      });
      const data = await vastaus.json().catch(() => ({}));
      if (vastaus.status === 201) {
        setKiitos({ nro: data.nro, viivat: viivat.current });
        dialogiRef.current?.close();
        viivat.current = [];
        kumotut.current = [];
        setNakyma("kiitos");
      } else if (vastaus.status === 429) {
        setVirhe(T.virheLiianUsein.replace("{s}", String(data.odota ?? 30)));
      } else if (data.virhe === "tarkistus-epaonnistui") {
        setVirhe(T.virheTarkistus);
      } else if (data.virhe === "kioski-tunnistamaton") {
        setVirhe(T.virheKioski);
      } else {
        setVirhe(T.virheYleinen);
      }
    } catch {
      setVirhe(T.virheVerkko);
    } finally {
      // Tunniste kului palvelimella joka tapauksessa, joten seuraava yritys tarvitsee uuden.
      nollaaTurnstile();
      setLahetetaan(false);
    }
  }

  // Käyttöehdot ja tietosuojaseloste avautuvat sovelluksen omaan ikkunaan, jottei piirros katoa
  // (eikä kioskin käyttäjä pääse sivulta muualle).
  const oikeudellinenRef = useRef<HTMLDialogElement>(null);
  const [oikeudellinen, setOikeudellinen] = useState<OikeudellinenSivu | null>(null);
  function avaaOikeudellinen(sivu: OikeudellinenSivu) {
    setOikeudellinen(sivu);
    if (!oikeudellinenRef.current?.open) oikeudellinenRef.current?.showModal();
    oikeudellinenRef.current?.querySelector(".oikeudellinen-sisalto")?.scrollTo(0, 0);
  }

  const kiitosRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (nakyma !== "kiitos" || !kiitos || !kiitosRef.current) return;
    const canvas = kiitosRef.current;
    const p = sovitaCanvas(canvas, 180);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, p, p);
    // Neliön muotoinen piirros ympyrän sisään
    ctx.save();
    ctx.translate(p * 0.15, p * 0.15);
    piirraPiirros(ctx, kiitos, p * 0.7);
    ctx.restore();
  }, [nakyma, kiitos]);

  // --- Kioskitila: nollaus käyttämättömyyden jälkeen ---

  const [laskuri, setLaskuri] = useState<number | null>(null);
  const idleAjastin = useRef<ReturnType<typeof setTimeout>>(undefined);

  const nollaaKioski = useCallback(() => {
    setLaskuri(null);
    oikeudellinenRef.current?.close();
    dialogiRef.current?.close();
    tyhjennaAlusta();
    setNakyma("aloitus");
  }, [tyhjennaAlusta]);

  const herata = useCallback(() => {
    if (!kioski) return;
    clearTimeout(idleAjastin.current);
    if (nakyma === "piirto") idleAjastin.current = setTimeout(() => setLaskuri(LASKURI_S), KAYTTAMATTOMYYS_MS);
  }, [kioski, nakyma]);

  useEffect(() => {
    if (!kioski) return;
    herata();
    document.addEventListener("pointerdown", herata, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", herata, { capture: true });
      clearTimeout(idleAjastin.current);
    };
  }, [kioski, herata]);

  useEffect(() => {
    if (laskuri === null) return;
    if (laskuri <= 0) return nollaaKioski();
    const ajastin = setTimeout(() => setLaskuri(laskuri - 1), 1000);
    return () => clearTimeout(ajastin);
  }, [laskuri, nollaaKioski]);

  useEffect(() => {
    if (!kioski || nakyma !== "kiitos") return;
    const ajastin = setTimeout(() => setNakyma("aloitus"), KIITOS_KIOSKISSA_MS);
    return () => clearTimeout(ajastin);
  }, [kioski, nakyma]);

  // --- Näkymät ---

  return (
    <div className="piirtosivu">
      {TURNSTILE_SITEKEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={renderoiTurnstile} />
      )}
      <header className="ylapalkki">
        <div className="tuotemerkki">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-merkki" src="/brand/latf-merkki.png" alt="Lumo Art & Tech Festival" />
          <span className="erotin" aria-hidden="true" />
          <span className="ylaotsikko">Raapustamo</span>
        </div>
        <button
          className="siru kielinappi"
          type="button"
          aria-label={T.toinenKieli}
          onClick={() => setKieli(kieli === "fi" ? "en" : "fi")}
        >
          {kieli === "fi" ? "EN" : "FI"}
        </button>
      </header>

      {nakyma === "aloitus" && (
        <main className="nakyma aloitus">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="supergrafiikka" src="/brand/latf-merkki-pysty.png" alt="" />
          <span className="ylaotsikko hiljainen">{T.ylaotsikko}</span>
          <h1 className="otsikko aloitus-otsikko">
            <span>{T.otsikko1}</span>
            <span className="glitch glitch--hiljainen" data-teksti={T.otsikko2}>
              {T.otsikko2}
            </span>
          </h1>
          <p className="aloitus-ingressi ingressi">{T.ingressi}</p>
          <button className="nappi nappi--ensisijainen nappi--iso" type="button" onClick={() => setNakyma("piirto")}>
            {T.aloita}
          </button>
          <p className="oikeudelliset-linkit">
            <button type="button" onClick={() => avaaOikeudellinen("ehdot")}>
              {T.kayttoehdot}
            </button>
            <button type="button" onClick={() => avaaOikeudellinen("tietosuoja")}>
              {T.tietosuoja}
            </button>
          </p>
        </main>
      )}

      {nakyma === "piirto" && (
        <main className="nakyma piirto">
          <div className="alusta-alue">
            <div className="alusta-kehys" ref={kehysRef}>
              <canvas ref={kerrosRef} />
              <canvas
                ref={pintaRef}
                className="pinta"
                onPointerDown={aloitaViiva}
                onPointerMove={jatkaViivaa}
                onPointerUp={lopetaViiva}
                onPointerCancel={lopetaViiva}
              />
              {viivat.current.length === 0 && !nykyinen.current && <div className="vihje">{T.vihje}</div>}
            </div>
          </div>

          <div className="tyokalut">
            <div className="rivi varit" role="group">
              {MUSTEET.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="vari"
                  style={{ "--c": m.hex } as React.CSSProperties}
                  aria-label={m[kieli]}
                  title={m[kieli]}
                  aria-pressed={sivellin !== "kumi" && vari === m.hex}
                  onClick={() => {
                    setVari(m.hex);
                    if (sivellin === "kumi") setSivellin("tussi");
                  }}
                />
              ))}
            </div>
            <div className="rivi">
              <div className="segmentit" role="group">
                {(Object.keys(SIVELTIMET) as SivellinId[]).map((id) => (
                  <button key={id} type="button" aria-pressed={sivellin === id} onClick={() => setSivellin(id)}>
                    {SIVELTIMET[id][kieli]}
                  </button>
                ))}
              </div>
            </div>
            <div className="rivi">
              <div className="koot" role="group">
                {(Object.keys(KOOT) as KokoId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="koko"
                    style={{ "--d": `${HALKAISIJAT[id]}px` } as React.CSSProperties}
                    aria-label={T[id]}
                    aria-pressed={koko === id}
                    onClick={() => setKoko(id)}
                  />
                ))}
              </div>
              <div className="toiminnot">
                <button className="ikoninappi" type="button" aria-label={T.kumoa} title={T.kumoa} disabled={!viivat.current.length} onClick={kumoa}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 14 4 9l5-5" />
                    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                  </svg>
                </button>
                <button
                  className="ikoninappi"
                  type="button"
                  aria-label={T.uudelleen}
                  title={T.uudelleen}
                  disabled={!kumotut.current.length}
                  onClick={teeUudelleen}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 14 5-5-5-5" />
                    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
                  </svg>
                </button>
                <button
                  className={`ikoninappi${varmistaTyhjennys ? " varmista" : ""}`}
                  type="button"
                  aria-label={varmistaTyhjennys ? T.varmista : T.tyhjenna}
                  title={varmistaTyhjennys ? T.varmista : T.tyhjenna}
                  disabled={!viivat.current.length}
                  onClick={tyhjenna}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              className="nappi nappi--ensisijainen nappi--iso laheta"
              type="button"
              disabled={nakyviaPisteita < 8}
              onClick={avaaVahvistus}
            >
              {T.laheta}
            </button>
          </div>
        </main>
      )}

      {nakyma === "kiitos" && kiitos && (
        <main className="nakyma kiitos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="supergrafiikka" src="/brand/latf-merkki-pysty.png" alt="" />
          <canvas className="kiitos-esikatselu" ref={kiitosRef} />
          <h1 className="otsikko kiitos-otsikko glitch" data-teksti={T.kiitosOtsikko}>
            {T.kiitosOtsikko}
          </h1>
          <span className="ylaotsikko hiljainen">{T.kiitosAli}</span>
          <p className="kiitos-teksti">{T.kiitosTeksti}</p>
          <span className="siru">
            <span className="hiljainen">{T.tunnusOtsikko}</span> <strong>{tunnus(kiitos.nro)}</strong>
          </span>
          <button className="nappi nappi--ensisijainen nappi--iso" type="button" onClick={() => setNakyma("piirto")}>
            {T.uusi}
          </button>
        </main>
      )}

      <dialog ref={dialogiRef}>
        <form className="vahvistus" method="dialog" onSubmit={(e) => e.preventDefault()}>
          <h2 className="otsikko vahvistus-otsikko">{T.vahvistusOtsikko}</h2>
          <div className="vahvistus-yla">
            <canvas ref={vahvistusRef} />
            <p>{T.vahvistusTeksti}</p>
          </div>
          <label className="valinta">
            <input type="checkbox" checked={ehdot} onChange={(e) => setEhdot(e.target.checked)} />
            <span>{T.ehdot}</span>
          </label>
          <p className="oikeudelliset-linkit">
            <button type="button" onClick={() => avaaOikeudellinen("ehdot")}>
              {T.kayttoehdot}
            </button>
            <button type="button" onClick={() => avaaOikeudellinen("tietosuoja")}>
              {T.tietosuoja}
            </button>
          </p>
          <div className="turnstile" ref={turnstileRef} />
          {(virhe || turnstileVirhe) && (
            <p className="virhe" role="alert">
              {virhe ?? T.virheTarkistus}
            </p>
          )}
          <div className="vahvistus-napit">
            <button
              className="nappi nappi--ensisijainen nappi--iso"
              type="button"
              disabled={!ehdot || lahetetaan || !turnstileTunniste}
              onClick={laheta}
            >
              {lahetetaan ? T.lahetetaan : ehdot && !turnstileTunniste && !turnstileVirhe ? T.tarkistetaan : T.lahetaVahvistus}
            </button>
            <button className="nappi nappi--haamu" type="button" onClick={() => dialogiRef.current?.close()}>
              {T.jatka}
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={oikeudellinenRef} className="oikeudellinen-ikkuna" onClose={() => setOikeudellinen(null)}>
        <div className="oikeudellinen-sisalto">
          {oikeudellinen === "ehdot" && <Kayttoehdot kieli={kieli} avaa={avaaOikeudellinen} />}
          {oikeudellinen === "tietosuoja" && <Tietosuojaseloste kieli={kieli} />}
        </div>
        <button className="nappi nappi--ensisijainen" type="button" onClick={() => oikeudellinenRef.current?.close()}>
          {T.sulje}
        </button>
      </dialog>

      {laskuri !== null && (
        <div className="laskuri" role="alertdialog" aria-live="assertive">
          <span className="ylaotsikko hiljainen">{T.idleOtsikko}</span>
          <span className="otsikko laskuri-numero">{laskuri}</span>
          <p className="hiljainen">{T.idleTeksti}</p>
          <button
            className="nappi nappi--ensisijainen nappi--iso"
            type="button"
            onClick={() => {
              setLaskuri(null);
              herata();
            }}
          >
            {T.idleJatka}
          </button>
        </div>
      )}
    </div>
  );
}
