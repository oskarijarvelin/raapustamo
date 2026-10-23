"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import KeynoteOikeus from "./KeynoteOikeus";
import type { Yhteydentila } from "./lavayhteys";
import { Videolahetin, type KatsojanTila } from "./video";
import "./keynote.css";

/** "testikuva", "ruutu" tai kaappauslaitteen deviceId */
type Lahde = string;

interface Kuva {
  virta: MediaStream;
  pysayta: () => void;
}

const KUVA: MediaTrackConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };

const TILAT: Record<Yhteydentila, string> = { yhdistetty: "Kanava auki", yhdistetaan: "Yhdistetään…", virhe: "Kanava ei aukea" };
const KATSOJAN_TILAT: Partial<Record<RTCPeerConnectionState, string>> = {
  new: "Aloitetaan",
  connecting: "Yhdistetään",
  connected: "Yhdistetty",
  disconnected: "Katkos",
  failed: "Epäonnistui",
};

export default function KeynoteLahetin({ lava }: { lava: string }) {
  return <KeynoteOikeus otsikko="Keynote-lähetin">{(supabase) => <Lahetin supabase={supabase} lava={lava} />}</KeynoteOikeus>;
}

/**
 * Testikuva: vaalea dia, kohdistusruudukko ja kello. Sillä voi tarkistaa yhteyden, kohdistuksen ja
 * viiveen (kuvaa lähettimen ja iPadin kellot samaan kuvaan) ilman kaappauslaitetta.
 */
function luoTestikuva(lava: string): Kuva {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d")!;
  const piirra = () => {
    const { width: l, height: k } = canvas;
    ctx.fillStyle = "#f4f2ec";
    ctx.fillRect(0, 0, l, k);
    ctx.strokeStyle = "#c9c6bb";
    ctx.lineWidth = 2;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo((l * i) / 10, 0);
      ctx.lineTo((l * i) / 10, k);
      ctx.moveTo(0, (k * i) / 10);
      ctx.lineTo(l, (k * i) / 10);
      ctx.stroke();
    }
    ctx.strokeStyle = "#f54653";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, l - 8, k - 8);
    ctx.beginPath();
    ctx.moveTo(l / 2 - 40, k / 2);
    ctx.lineTo(l / 2 + 40, k / 2);
    ctx.moveTo(l / 2, k / 2 - 40);
    ctx.lineTo(l / 2, k / 2 + 40);
    ctx.stroke();
    // Liikkuva palkki näyttää kuvataajuuden ja nykimisen.
    const x = ((performance.now() / 4) % (l + 200)) - 200;
    ctx.fillStyle = "#4d55dc";
    ctx.fillRect(x, k - 120, 200, 40);
    ctx.fillStyle = "#111";
    ctx.font = "700 44px Poppins, Arial, sans-serif";
    ctx.fillText(`Raapustamo · Keynote-testikuva · ${lava}`, 80, 120);
    const nyt = new Date();
    const aika = `${nyt.toLocaleTimeString("fi-FI", { hour12: false })}.${String(nyt.getMilliseconds()).padStart(3, "0")}`;
    ctx.font = "700 160px ui-monospace, Menlo, monospace";
    ctx.fillText(aika, 80, k / 2 + 200);
  };
  piirra();
  const ajastin = setInterval(piirra, 1000 / 30);
  const virta = canvas.captureStream(30);
  return {
    virta,
    pysayta: () => {
      clearInterval(ajastin);
      virta.getTracks().forEach((t) => t.stop());
    },
  };
}

function Lahetin({ supabase, lava }: { supabase: SupabaseClient | null; lava: string }) {
  const lahetin = useRef<Videolahetin | null>(null);
  const [yhteys, setYhteys] = useState<Yhteydentila>("yhdistetaan");
  const [katsojat, setKatsojat] = useState<KatsojanTila[]>([]);
  const [laitteet, setLaitteet] = useState<MediaDeviceInfo[]>([]);
  const [lahde, setLahde] = useState<Lahde>("testikuva");
  const [virta, setVirta] = useState<MediaStream | null>(null);
  const [kuvanTiedot, setKuvanTiedot] = useState<string | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const kuva = useRef<Kuva | null>(null);
  const herateLukko = useRef<WakeLockSentinel | null>(null);
  const esikatselu = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const l = new Videolahetin(supabase, lava, { yhteys: setYhteys, katsojat: setKatsojat });
    lahetin.current = l;
    return () => {
      l.lopeta();
      lahetin.current = null;
    };
  }, [supabase, lava]);

  // Kaappauskortit näkyvät selaimelle kameroina. Nimet näkyvät vasta, kun kameran käyttö on sallittu.
  const paivitaLaitteet = useCallback(async () => {
    const kaikki = await navigator.mediaDevices.enumerateDevices();
    setLaitteet(kaikki.filter((l) => l.kind === "videoinput"));
  }, []);

  useEffect(() => {
    void paivitaLaitteet();
    navigator.mediaDevices.addEventListener("devicechange", paivitaLaitteet);
    return () => navigator.mediaDevices.removeEventListener("devicechange", paivitaLaitteet);
  }, [paivitaLaitteet]);

  async function salliLaitteet() {
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: true });
      v.getTracks().forEach((t) => t.stop());
      await paivitaLaitteet();
    } catch (e) {
      setVirhe(`Kameroiden käyttö estettiin: ${e instanceof Error ? e.message : e}`);
    }
  }

  useEffect(() => {
    if (esikatselu.current) esikatselu.current.srcObject = virta;
  }, [virta]);

  const vapauta = useCallback(() => {
    kuva.current?.pysayta();
    kuva.current = null;
    setVirta(null);
    setKuvanTiedot(null);
    void herateLukko.current?.release().catch(() => {});
    herateLukko.current = null;
  }, []);

  const lopeta = useCallback(() => {
    void lahetin.current?.aseta(null);
    vapauta();
  }, [vapauta]);

  useEffect(() => () => kuva.current?.pysayta(), []);

  async function aloita() {
    setVirhe(null);
    let uusi: Kuva;
    try {
      if (lahde === "testikuva") {
        uusi = luoTestikuva(lava);
      } else {
        const virta =
          lahde === "ruutu"
            ? await navigator.mediaDevices.getDisplayMedia({ video: KUVA, audio: false })
            : await navigator.mediaDevices.getUserMedia({ video: { ...KUVA, deviceId: { exact: lahde } }, audio: false });
        uusi = { virta, pysayta: () => virta.getTracks().forEach((t) => t.stop()) };
      }
    } catch (e) {
      setVirhe(`Kuvan avaaminen epäonnistui: ${e instanceof Error ? e.message : e}`);
      return;
    }
    const raita = uusi.virta.getVideoTracks()[0];
    // Ruudunjaon voi lopettaa myös selaimen omasta palkista.
    raita.addEventListener("ended", () => kuva.current === uusi && lopeta());
    await lahetin.current?.aseta(raita);
    kuva.current?.pysayta();
    kuva.current = uusi;
    setVirta(uusi.virta);
    const a = raita.getSettings();
    setKuvanTiedot(`${a.width ?? "?"} × ${a.height ?? "?"} · ${Math.round(a.frameRate ?? 0)} fps`);
    void paivitaLaitteet();
    // Kaappauskone ei saa mennä lepotilaan kesken esityksen.
    if (!herateLukko.current) herateLukko.current = (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
  }

  const nimettomia = laitteet.some((l) => !l.label);
  const editorinOsoite = `/keynote?lava=${lava}&video=1`;

  return (
    <div className="keynote-lahetin">
      <header className="ylapalkki">
        <div className="tuotemerkki">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-merkki" src="/brand/latf-merkki.png" alt="Lumo Art & Tech Festival" />
          <span className="erotin" aria-hidden="true" />
          <span className="ylaotsikko">Keynote-lähetin</span>
        </div>
        <div className="yla-oikea">
          <span className="siru">{lava}</span>
          <span className="siru kanava" data-tila={supabase ? yhteys : "paikallinen"}>
            <span className="piste" />
            {supabase ? TILAT[yhteys] : "Testitila"}
          </span>
        </div>
      </header>

      <main>
        <section className="paneeli asetukset">
          <label>
            Lähde
            <select value={lahde} onChange={(e) => setLahde(e.target.value)}>
              <option value="testikuva">Testikuva</option>
              <option value="ruutu">Jaa ruutu tai ikkuna</option>
              {laitteet
                .filter((l) => l.deviceId)
                .map((l, i) => (
                  <option key={l.deviceId} value={l.deviceId}>
                    {l.label || `Kaappauslaite ${i + 1}`}
                  </option>
                ))}
            </select>
          </label>
          {(nimettomia || !laitteet.length) && (
            <button className="nappi nappi--haamu" type="button" onClick={salliLaitteet}>
              {laitteet.length ? "Näytä laitteiden nimet" : "Hae kaappauslaitteet"}
            </button>
          )}
          <div className="napit">
            <button className="nappi nappi--ensisijainen" type="button" onClick={aloita}>
              {virta ? "Vaihda lähde" : "Aloita lähetys"}
            </button>
            {virta && (
              <button className="nappi nappi--vaara" type="button" onClick={lopeta}>
                Lopeta
              </button>
            )}
          </div>
          {virhe && (
            <p className="virhe" role="alert">
              {virhe}
            </p>
          )}
          <p className="hiljainen ohje">
            Kaappauskortti näkyy listassa kamerana. Kuvasuhteen kannattaa olla sama kuin esityksessä, esim. 1920 × 1080, jolloin editori
            ottaa sen alustan kuvasuhteeksi.
          </p>
        </section>

        <section className="paneeli esikatselu">
          <video ref={esikatselu} muted playsInline autoPlay />
          {!virta && <div className="tyhja hiljainen">Ei lähetystä</div>}
          {kuvanTiedot && <span className="siru tiedot">{kuvanTiedot}</span>}
        </section>

        <section className="paneeli katsojat">
          <h2 className="ylaotsikko">Editorit</h2>
          {katsojat.length ? (
            <ul>
              {katsojat.map((k) => (
                <li key={k.id} data-tila={k.tila}>
                  <span className="piste" />
                  <span>iPad {k.id.slice(0, 4)}</span>
                  <span className="hiljainen">{KATSOJAN_TILAT[k.tila] ?? k.tila}</span>
                  {k.kbps !== null && <span className="hiljainen">{(k.kbps / 1000).toFixed(1)} Mbit/s</span>}
                  {k.rtt !== null && <span className="hiljainen">{k.rtt} ms</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hiljainen">
              {virta ? "Odotetaan editoria. " : "Aloita lähetys, niin editorit yhdistävät. "}
              Avaa iPadilla <code>{editorinOsoite}</code>.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
