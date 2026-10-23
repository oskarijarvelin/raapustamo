// Avaruus-layoutin piirtomoottori: tähtikenttä, ajelehtivat piirrokset ja niiden glitch-poistuminen.
// Laskenta (sijoittelu ja liike) on tiedostossa src/lib/avaruus.ts.
import { etene, kappaleenKoko, uusiKappale, type Alue, type Kappale } from "@/lib/avaruus";
import { piirraPiirros, tunnus } from "@/lib/piirto";
import type { NaytettavaPiirros } from "@/lib/tyypit";
import { glitch, pehmea } from "./efektit";

const PIIRTYMINEN = 4200;
const ULOS = 700;
const ULOS_POISTETTU = 420;
const MIKRO = 180;
const ILMESTYMINEN = 1200;
const WARP = 2200;
const TAHTIA = 160;
/** Ensimmäiset piirrokset tulevat näin tiheään, jotta tyhjä avaruus täyttyy nopeasti. */
const ALKUVALI = 700;

interface Tahti {
  x: number;
  y: number;
  /** Syvyys 0–1: lähemmät ovat isompia, kirkkaampia ja liikkuvat nopeammin */
  z: number;
  vaihe: number;
}

interface Hahmo {
  k: Kappale;
  piirros: NaytettavaPiirros;
  uusi: boolean;
  vaihe: "piirtyy" | "ajelehtii" | "mikro" | "ulos";
  /** Simulaatioaika, jolloin piirtyminen alkoi */
  alku: number;
  seuraavaMikro: number;
  /** Todellinen aika (ms), jolloin ilmestyminen tai poistuminen alkoi */
  ilmestyy: number;
  ulos: number;
  ulosKesto: number;
  kuva: HTMLCanvasElement;
  kctx: CanvasRenderingContext2D;
  glitchKuva?: HTMLCanvasElement;
}

export interface AvaruudenAsetukset {
  canvas: HTMLCanvasElement;
  /** Montako piirrosta avaruudessa on yhtä aikaa */
  maara: number;
  /** Uusi piirros näin usein (ms) */
  vali: number;
  /** Seuraava näytettävä piirros, pois lukien jo näkyvissä olevat */
  valitse: (poissulje: ReadonlySet<string>) => NaytettavaPiirros | undefined;
  /** Kirjaa näyttökerran */
  kirjaa: (p: NaytettavaPiirros) => void;
  /** false = tauko tai klippi ei ole screenillä: aika pysähtyy eikä uusia piirroksia tule */
  aktiivinen: () => boolean;
  /** Kutsutaan, kun näkyvien piirrosten joukko muuttuu */
  muuttui: (nrot: number[]) => void;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function luoAvaruus(a: AvaruudenAsetukset) {
  const ctx = a.canvas.getContext("2d")!;
  const alue: Alue = { leveys: a.canvas.width, korkeus: a.canvas.height };
  const fontti = getComputedStyle(document.body).fontFamily;
  const tahdet: Tahti[] = Array.from({ length: TAHTIA }, () => ({
    x: Math.random() * alue.leveys,
    y: Math.random() * alue.korkeus,
    z: Math.random() ** 2,
    vaihe: Math.random() * Math.PI * 2,
  }));
  let hahmot: Hahmo[] = [];
  let sim = 0;
  let edellinen = performance.now();
  let seuraavaUusi = 0;
  let alkuun = a.maara;
  let warp = -Infinity;

  const nakyvat = () => hahmot.filter((h) => h.vaihe !== "ulos");
  const ilmoita = () => a.muuttui(nakyvat().map((h) => h.piirros.nro));

  function uusi(elinaikaS: number, nyt: number): boolean {
    const p = a.valitse(new Set(hahmot.map((h) => h.piirros.id)));
    if (!p) return false;
    const koko = kappaleenKoko(alue.korkeus, p.nostettu);
    const kuva = document.createElement("canvas");
    kuva.width = kuva.height = koko;
    hahmot.push({
      k: uusiKappale(alue, nakyvat().map((h) => h.k), koko, elinaikaS),
      piirros: p,
      uusi: p.nayttokerrat === 0,
      vaihe: "piirtyy",
      alku: sim,
      seuraavaMikro: 0,
      ilmestyy: nyt,
      ulos: 0,
      ulosKesto: ULOS,
      kuva,
      kctx: kuva.getContext("2d")!,
    });
    a.kirjaa(p);
    ilmoita();
    return true;
  }

  function aloitaUlos(h: Hahmo, nyt: number, kesto = ULOS) {
    if (h.vaihe === "ulos") return;
    h.vaihe = "ulos";
    h.ulos = nyt;
    h.ulosKesto = kesto;
    h.glitchKuva ??= Object.assign(document.createElement("canvas"), { width: h.kuva.width, height: h.kuva.height });
    ilmoita();
  }

  function piirraKuva(h: Hahmo, edistyminen: number) {
    const koko = h.kuva.width;
    const reuna = koko * 0.07;
    h.kctx.clearRect(0, 0, koko, koko);
    h.kctx.save();
    h.kctx.translate(reuna, reuna);
    // Ohuet viivat katoavat LED-screenillä: vähintään 8 px leveä viiva (≈ 2 cm).
    piirraPiirros(h.kctx, h.piirros, koko - reuna * 2, { edistyminen, minPx: 8 });
    h.kctx.restore();
  }

  function piirraTahdet(nyt: number, dt: number) {
    const w = Math.max(0, 1 - (nyt - warp) / WARP);
    const voima = w * w;
    const cx = alue.leveys / 2;
    const cy = alue.korkeus / 2;
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#FFFFFF";
    for (const t of tahdet) {
      t.x -= (3 + t.z * 12) * dt;
      if (t.x < 0) t.x += alue.leveys;
      const kirkkaus = (0.12 + t.z * 0.4) * (0.75 + 0.25 * Math.sin(nyt / 900 + t.vaihe));
      const koko = 1.5 + t.z * 2.5;
      if (voima > 0.01) {
        // Hyperavaruus: tähdet venyvät viivoiksi keskeltä poispäin.
        const dx = t.x - cx;
        const dy = t.y - cy;
        const pituus = voima * (40 + t.z * 520);
        const d = Math.hypot(dx, dy) || 1;
        ctx.globalAlpha = Math.min(1, kirkkaus + voima * 0.5);
        ctx.lineWidth = koko;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x - (dx / d) * pituus, t.y - (dy / d) * pituus);
        ctx.stroke();
      } else {
        ctx.globalAlpha = kirkkaus;
        ctx.fillRect(t.x, t.y, koko, koko);
      }
    }
    ctx.globalAlpha = 1;
  }

  function piirraHahmo(h: Hahmo, nyt: number) {
    let lahde: HTMLCanvasElement = h.kuva;
    let alfa = 1;
    let venytys = 1;
    const ilmestys = easeOut(Math.max(0, Math.min(1, (nyt - h.ilmestyy) / ILMESTYMINEN)));
    let mittakaava = 0.82 + 0.18 * ilmestys;

    if (h.vaihe === "piirtyy") {
      const v = Math.max(0, Math.min(1, (sim - h.alku) / PIIRTYMINEN));
      piirraKuva(h, pehmea(v));
      if (v >= 1) {
        h.vaihe = "ajelehtii";
        h.seuraavaMikro = sim + 5000 + Math.random() * 12000;
      }
    } else if (h.vaihe === "ajelehtii" && sim > h.seuraavaMikro) {
      h.vaihe = "mikro";
      h.alku = sim;
    } else if (h.vaihe === "mikro") {
      if (sim - h.alku < MIKRO) {
        h.glitchKuva ??= Object.assign(document.createElement("canvas"), { width: h.kuva.width, height: h.kuva.height });
        glitch(h.glitchKuva.getContext("2d")!, h.kuva, 0.2);
        lahde = h.glitchKuva;
      } else {
        h.vaihe = "ajelehtii";
        h.seuraavaMikro = sim + 5000 + Math.random() * 12000;
      }
    } else if (h.vaihe === "ulos") {
      const v = Math.min(1, (nyt - h.ulos) / h.ulosKesto);
      glitch(h.glitchKuva!.getContext("2d")!, h.kuva, 0.3 + v * 0.7);
      lahde = h.glitchKuva!;
      alfa = 1 - v ** 2;
      venytys = 1 + v * 0.35;
      mittakaava *= 1 - v * 0.08;
    }

    // Kauempana (pienemmät) piirrokset hieman himmeämpiä: syvyysvaikutelma ilman, että mikään katoaa.
    const syvyys = 0.84 + 0.16 * Math.max(0, Math.min(1, (h.k.koko / alue.korkeus - 0.36) / 0.44));
    const koko = h.k.koko * mittakaava;
    ctx.save();
    ctx.globalAlpha = alfa * syvyys;
    ctx.translate(h.k.x, h.k.y);
    ctx.rotate(h.k.kulma);
    ctx.scale(venytys, 1 / Math.sqrt(venytys));
    ctx.drawImage(lahde, -koko / 2, -koko / 2, koko, koko);
    ctx.restore();

    // Tunnus ja "Uusi"-merkki piirroksen alla
    if (h.vaihe === "piirtyy" || h.vaihe === "ulos") return;
    const y = h.k.y + koko * 0.44;
    ctx.save();
    ctx.globalAlpha = 0.5 * syvyys * ilmestys;
    ctx.font = `600 26px ${fontti}`;
    ctx.textBaseline = "middle";
    const teksti = tunnus(h.piirros.nro);
    const tLeveys = ctx.measureText(teksti).width;
    const merkki = h.uusi ? "UUSI" : "";
    ctx.font = `700 22px ${fontti}`;
    const mLeveys = merkki ? ctx.measureText(merkki).width + 32 : 0;
    let x = h.k.x - (tLeveys + (merkki ? mLeveys + 14 : 0)) / 2;
    ctx.font = `600 26px ${fontti}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(teksti, x, y);
    if (merkki) {
      x += tLeveys + 14;
      ctx.globalAlpha = 0.9 * ilmestys;
      ctx.beginPath();
      ctx.roundRect(x, y - 18, mLeveys, 36, 18);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.font = `700 22px ${fontti}`;
      ctx.fillText(merkki, x + 16, y + 1);
    }
    ctx.restore();
  }

  return {
    kehys(nyt: number) {
      const todellinen = Math.min(100, nyt - edellinen);
      edellinen = nyt;
      const aktiivinen = a.aktiivinen();
      const dt = aktiivinen ? todellinen : 0;
      sim += dt;

      if (aktiivinen && sim >= seuraavaUusi) {
        if (alkuun > 0) {
          // Alussa piirrokset porrastetaan, jotta ne eivät myöhemmin poistu kaikki yhtä aikaa.
          const i = a.maara - alkuun;
          if (uusi((a.vali / 1000) * (a.maara / 2 + i + 1), nyt)) alkuun--;
          else alkuun = 0;
          seuraavaUusi = sim + (alkuun > 0 ? ALKUVALI : a.vali);
        } else {
          if (nakyvat().length < a.maara + 1) uusi((a.maara * a.vali) / 1000, nyt);
          seuraavaUusi = sim + a.vali;
        }
      }

      for (const h of hahmot) if (h.vaihe !== "ulos" && etene(h.k, dt / 1000)) aloitaUlos(h, nyt);
      hahmot = hahmot.filter((h) => h.vaihe !== "ulos" || nyt - h.ulos < h.ulosKesto);

      ctx.clearRect(0, 0, alue.leveys, alue.korkeus);
      piirraTahdet(nyt, todellinen / 1000);
      // Kaukaiset ensin, jotta lähemmät piirtyvät niiden päälle.
      for (const h of [...hahmot].sort((x, y) => x.k.koko - y.k.koko)) piirraHahmo(h, nyt);
    },

    /** Poistaa piirroksen heti (hylätty tai piilotettu moderoinnissa), myös tauon aikana. */
    poista(id: string) {
      const nyt = performance.now();
      for (const h of hahmot) if (h.piirros.id === id) aloitaUlos(h, nyt, ULOS_POISTETTU);
    },

    /** Uusi hyväksytty piirros: jos avaruudessa on tilaa, se tulee heti eikä odota vuoroaan. */
    tayta() {
      if (a.aktiivinen() && alkuun === 0 && nakyvat().length < a.maara) {
        uusi((a.maara * a.vali) / 1000, performance.now());
        seuraavaUusi = sim + a.vali;
      }
    },

    /** Paluu tauolta tai klippi tuli screenille: hyperavaruus ja piirrokset piirtyvät uudelleen. */
    paluu() {
      const nyt = performance.now();
      warp = nyt;
      nakyvat()
        .sort((x, y) => x.k.x - y.k.x)
        .forEach((h, i) => {
          h.vaihe = "piirtyy";
          // Vasemmalta oikealle porrastettuna; negatiivinen edistyminen = tyhjä kunnes vuoro tulee.
          h.alku = sim + 500 + i * 220;
          h.ilmestyy = nyt + 400 + i * 220;
        });
    },

    naytolla: () => nakyvat().map((h) => h.piirros.nro),
  };
}

export type Avaruus = ReturnType<typeof luoAvaruus>;
