"use client";

// Aloitus- ja kiitosnäkymän tausta: sama tähtikenttä kuin LED-näytön avaruudessa ja sen päällä
// himmeitä, hitaasti ajelehtivia piirroksia, jotka glitchaavat välillä.
import { useEffect, useRef } from "react";
import { glitch } from "@/components/naytto/efektit";
import { piirraPiirros } from "@/lib/piirto";
import { TAUSTAPIIRROKSET } from "@/lib/taustapiirrokset";

const MIKRO = 180;

interface Tahti {
  x: number;
  y: number;
  /** Syvyys 0–1: lähemmät ovat isompia, kirkkaampia ja liikkuvat nopeammin */
  z: number;
  vaihe: number;
}

interface Hahmo {
  x: number;
  y: number;
  koko: number;
  vx: number;
  vy: number;
  kulma: number;
  kierto: number;
  alfa: number;
  kuva: HTMLCanvasElement;
  glitchKuva: HTMLCanvasElement;
  seuraavaMikro: number;
}

function sekoita<T>(taulukko: readonly T[]): T[] {
  const tulos = [...taulukko];
  for (let i = tulos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tulos[i], tulos[j]] = [tulos[j], tulos[i]];
  }
  return tulos;
}

export default function Avaruustausta() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const liikkumaton = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let tahdet: Tahti[] = [];
    let hahmot: Hahmo[] = [];

    function alusta() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      tahdet = [];
      hahmot = [];
      // Piilotettu tai pienennetty ikkuna voi hetkellisesti olla nollan kokoinen.
      if (!w || !h) return;

      tahdet = Array.from({ length: Math.min(240, Math.round((w * h) / 5000)) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() ** 2,
        vaihe: Math.random() * Math.PI * 2,
      }));

      // Piirrokset levitetään arpomalla ehdokkaita ja valitsemalla kauimpana muista oleva.
      const maara = Math.max(4, Math.min(TAUSTAPIIRROKSET.length, Math.round((w * h) / 90_000)));
      const lyhyempi = Math.min(w, h);
      for (const piirros of sekoita(TAUSTAPIIRROKSET).slice(0, maara)) {
        const koko = lyhyempi * (0.32 + Math.random() * 0.2) * (w > h ? 0.8 : 1);
        let paras = { x: 0, y: 0, etaisyys: -1 };
        for (let i = 0; i < 30; i++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          const etaisyys = Math.min(Infinity, ...hahmot.map((m) => Math.hypot(m.x - x, m.y - y) / ((m.koko + koko) / 2)));
          if (etaisyys > paras.etaisyys) paras = { x, y, etaisyys };
        }
        const px = Math.round(koko * dpr);
        const kuva = Object.assign(document.createElement("canvas"), { width: px, height: px });
        piirraPiirros(kuva.getContext("2d")!, piirros, px);
        const suunta = Math.random() * Math.PI * 2;
        const nopeus = 4 + Math.random() * 6;
        hahmot.push({
          x: paras.x,
          y: paras.y,
          koko,
          vx: Math.cos(suunta) * nopeus,
          vy: Math.sin(suunta) * nopeus,
          kulma: (Math.random() - 0.5) * 0.5,
          kierto: (Math.random() - 0.5) * 0.04,
          alfa: 0.2 + Math.random() * 0.1,
          kuva,
          glitchKuva: Object.assign(document.createElement("canvas"), { width: px, height: px }),
          seuraavaMikro: performance.now() + 3000 + Math.random() * 12000,
        });
      }
    }

    function piirra(nyt: number, dt: number) {
      ctx!.clearRect(0, 0, w, h);
      ctx!.fillStyle = "#FFFFFF";
      for (const t of tahdet) {
        t.x -= (3 + t.z * 12) * dt;
        if (t.x < 0) t.x += w;
        ctx!.globalAlpha = (0.15 + t.z * 0.45) * (0.75 + 0.25 * Math.sin(nyt / 900 + t.vaihe));
        const koko = 0.8 + t.z * 1.6;
        ctx!.fillRect(t.x, t.y, koko, koko);
      }

      for (const hh of hahmot) {
        hh.x += hh.vx * dt;
        hh.y += hh.vy * dt;
        hh.kulma += hh.kierto * dt;
        // Reunan yli ajelehtinut palaa vastakkaiselta puolelta.
        const vara = hh.koko / 2;
        if (hh.x < -vara) hh.x += w + vara * 2;
        if (hh.x > w + vara) hh.x -= w + vara * 2;
        if (hh.y < -vara) hh.y += h + vara * 2;
        if (hh.y > h + vara) hh.y -= h + vara * 2;

        let lahde = hh.kuva;
        if (!liikkumaton && nyt > hh.seuraavaMikro) {
          if (nyt - hh.seuraavaMikro < MIKRO) {
            glitch(hh.glitchKuva.getContext("2d")!, hh.kuva, 0.25);
            lahde = hh.glitchKuva;
          } else {
            hh.seuraavaMikro = nyt + 6000 + Math.random() * 12000;
          }
        }
        ctx!.save();
        ctx!.globalAlpha = hh.alfa;
        ctx!.translate(hh.x, hh.y);
        ctx!.rotate(hh.kulma);
        ctx!.drawImage(lahde, -hh.koko / 2, -hh.koko / 2, hh.koko, hh.koko);
        ctx!.restore();
      }
      ctx!.globalAlpha = 1;
    }

    alusta();
    let kehys = 0;
    let edellinen = performance.now();
    function silmukka(nyt: number) {
      piirra(nyt, Math.min(100, nyt - edellinen) / 1000);
      edellinen = nyt;
      kehys = requestAnimationFrame(silmukka);
    }
    if (liikkumaton) piirra(edellinen, 0);
    else kehys = requestAnimationFrame(silmukka);

    let koonmuutos: ReturnType<typeof setTimeout> | undefined;
    function kokoMuuttui() {
      clearTimeout(koonmuutos);
      koonmuutos = setTimeout(() => {
        alusta();
        if (liikkumaton) piirra(performance.now(), 0);
      }, 150);
    }
    window.addEventListener("resize", kokoMuuttui);
    return () => {
      cancelAnimationFrame(kehys);
      clearTimeout(koonmuutos);
      window.removeEventListener("resize", kokoMuuttui);
    };
  }, []);

  return <canvas className="avaruustausta" ref={canvasRef} aria-hidden="true" />;
}
