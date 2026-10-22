"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import qrcode from "qrcode-generator";
import { seuraavaPiirros } from "@/lib/jono";
import { piirraPiirros, tunnus } from "@/lib/piirto";
import { NAYTTOKANAVA, selainAsiakas } from "@/lib/supabase/selain";
import type { NaytettavaPiirros } from "@/lib/tyypit";
import "./naytto.css";

export type Layout = "trio" | "solo" | "seina";

interface Props {
  layout: Layout;
  /** Piirrosten vaihtoväli sekunteina */
  vaihtoS: number;
  naytaQr: boolean;
  /** QR-koodin osoite; oletuksena tämän palvelimen piirtonäkymä */
  qrUrl: string | null;
  /** QR-koodin alla näytettävä lyhyt osoite */
  osoite: string;
  /** null = sovita ikkunaan (esikatselu), 1 = natiivi 1:1-ulostulo */
  skaala: number | null;
}

const LEVEYS = 4032;
const KORKEUS = 1152;
const PIIRTYMINEN = 4200;
const ULOS = 380;
const MIKRO = 180;
const PAIVITYSVALI = 20_000;
const VALIMUISTI = "raapustamo:naytto:v1";
const KENTAT = "id, nro, luotu, viivat, nostettu, nayttokerrat, viimeksi_naytetty";

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
  vaihe: Vaihe;
  alku: number;
  seuraavaMikro: number;
}

type Tiedot = { nro: number; uusi: boolean } | null;

// --- Glitch: vaakasuorat kaistat siirtyvät sivuttain ---

function glitch(ctx: CanvasRenderingContext2D, lahde: HTMLCanvasElement, voima: number) {
  const { width: w, height: h } = lahde;
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 1 - Math.max(0, voima - 0.6) * 2.5;
  let y = 0;
  while (y < h) {
    const kaista = 6 + Math.floor(Math.random() * 70);
    const siirto = Math.random() < 0.4 ? (Math.random() - 0.5) * 2 * voima * w * 0.14 : 0;
    ctx.drawImage(lahde, 0, y, w, kaista, siirto, y, w, kaista);
    y += kaista;
  }
  ctx.globalAlpha = 1;
}

const pehmea = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

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

export default function Naytto({ layout, vaihtoS, naytaQr, qrUrl, osoite, skaala }: Props) {
  const supabase = useMemo(() => selainAsiakas(), []);
  const solujenMaara = layout === "trio" ? 3 : layout === "solo" ? 1 : 12;
  const koko = layout === "seina" ? 576 : 1152;

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [tiedot, setTiedot] = useState<Tiedot[]>(() => Array(solujenMaara).fill(null));
  const [tauko, setTauko] = useState(false);
  const taukoRef = useRef(false);
  taukoRef.current = tauko;
  const [muunnos, setMuunnos] = useState({ s: skaala ?? 1, x: 0, y: 0 });
  const [qrOsoite, setQrOsoite] = useState(qrUrl ?? "");

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
        vaihe: "tyhja",
        alku: 0,
        seuraavaMikro: 0,
      };
    });

    const piirrokset = new Map<string, NaytettavaPiirros>(lueValimuisti().map((p) => [p.id, p]));
    const paivitaTiedot = () => setTiedot(solut.map((s) => (s.piirros ? { nro: s.piirros.nro, uusi: s.uusi } : null)));

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

    let kehysId = 0;
    const kehys = (nyt: number) => {
      for (const s of solut) paivitaSolu(s, nyt);
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
      if (p) {
        p.nayttokerrat += 1;
        p.viimeksi_naytetty = new Date().toISOString();
        supabase?.rpc("merkitse_naytetyksi", { piirros: p.id }).then(({ error }) => error && console.warn("Näyttökerran kirjaus epäonnistui", error));
      }
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
      if (taukoRef.current) return;
      const kohteet = layout === "seina" ? [...solut].sort(() => Math.random() - 0.5).slice(0, 3) : solut;
      kohteet.forEach((s, i) => setTimeout(() => vaihdaSeuraavaan(s), i * 700));
    }

    /** Poistaa piirroksen heti screeniltä (hylätty tai piilotettu moderoinnissa). */
    function poista(id: string) {
      piirrokset.delete(id);
      kirjoitaValimuisti([...piirrokset.values()]);
      for (const s of solut) {
        if (s.piirros?.id === id || s.seuraava?.id === id) vaihdaSeuraavaan(s, true);
      }
    }

    function tayta() {
      for (const s of solut) if (!s.piirros && !s.seuraava) vaihdaSeuraavaan(s);
    }

    async function lataa() {
      if (!supabase) return;
      const { data, error } = await supabase.from("piirrokset").select(KENTAT).eq("tila", "hyvaksytty");
      if (error || !data) return console.warn("Piirrosten haku epäonnistui – jatketaan välimuistista", error);
      const tuoreet = new Map((data as NaytettavaPiirros[]).map((p) => [p.id, p]));
      for (const id of [...piirrokset.keys()]) if (!tuoreet.has(id)) poista(id);
      for (const [id, p] of tuoreet) piirrokset.set(id, p);
      kirjoitaValimuisti([...piirrokset.values()]);
      tayta();
    }

    // Aloitus: välimuistista heti, sitten verkosta
    solut.forEach((s, i) => setTimeout(() => vaihdaSeuraavaan(s, true), 300 + i * (layout === "seina" ? 250 : 700)));
    lataa();
    const paivitys = setInterval(lataa, PAIVITYSVALI);
    const kierrokset = setInterval(kierros, vaihtoS * 1000);

    let muutokset: RealtimeChannel | null = null;
    let komennot: RealtimeChannel | null = null;
    if (supabase) {
      supabase
        .from("asetukset")
        .select("arvo")
        .eq("avain", "naytto")
        .single()
        .then(({ data }) => setTauko(Boolean(data?.arvo?.tauko)));

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
          kirjoitaValimuisti([...piirrokset.values()]);
          tayta();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "asetukset" }, (muutos) => {
          const rivi = muutos.new as { avain: string; arvo: { tauko?: boolean } };
          if (rivi.avain === "naytto") setTauko(Boolean(rivi.arvo.tauko));
        })
        .subscribe();
      komennot = supabase
        .channel(NAYTTOKANAVA)
        .on("broadcast", { event: "piilota" }, ({ payload }) => poista(payload.id))
        .on("broadcast", { event: "tauko" }, ({ payload }) => setTauko(Boolean(payload.tauko)))
        .subscribe();
    }

    return () => {
      cancelAnimationFrame(kehysId);
      clearInterval(paivitys);
      clearInterval(kierrokset);
      if (muutokset) supabase?.removeChannel(muutokset);
      if (komennot) supabase?.removeChannel(komennot);
    };
  }, [supabase, layout, koko, solujenMaara, vaihtoS]);

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
    <div className="nayttosivu">
      <div
        className="lava"
        data-layout={layout}
        style={{ transform: `translate(${muunnos.x}px, ${muunnos.y}px) scale(${muunnos.s})` }}
      >
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
        {tauko && (
          <div className="tauko">
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
          Esikatselu {Math.round(muunnos.s * 100)} % · 4032 × 1152 · ?layout=trio|solo|seina · ?skaala=1
        </div>
      )}
    </div>
  );
}
