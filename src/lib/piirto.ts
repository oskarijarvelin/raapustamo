// Musteet, siveltimet ja piirrosten renderöinti canvasille. Samaa koodia käyttävät
// piirtonäkymä, moderointi ja LED-näyttö, jotta piirros näyttää kaikkialla samalta.
import { getStroke } from "perfect-freehand";
import type { KokoId, SivellinId, Viiva } from "./tyypit";

export const MUSTEET = [
  { id: "valkoinen", hex: "#FFFFFF", fi: "Valkoinen", en: "White" },
  { id: "hiekka", hex: "#D6D4CA", fi: "Hiekka", en: "Sand" },
  { id: "roosa", hex: "#CE8DA7", fi: "Roosa", en: "Rose" },
  { id: "puna", hex: "#F54653", fi: "Punainen", en: "Red" },
  { id: "oranssi", hex: "#F47226", fi: "Oranssi", en: "Orange" },
  { id: "sini", hex: "#4D55DC", fi: "Sininen", en: "Blue" },
  // Oulu 2026 -metsänvihreä (#185636) ja -yönsininen (#002D58) katoavat mustalle
  // LED-taustalle, joten niistä käytetään vaalennettuja sävyjä. Tarkistetaan screen-testissä.
  { id: "metsa", hex: "#3E9E6A", fi: "Vihreä", en: "Green" },
  { id: "taivas", hex: "#3F86D1", fi: "Taivas", en: "Sky" },
] as const;

/** Kumi tallennetaan mustana, jotta vanhat esikatselut näyttävät oikealta mustalla taustalla. */
export const KUMIN_VARI = "#000000";

export const SALLITUT_VARIT: ReadonlySet<string> = new Set([...MUSTEET.map((m) => m.hex), KUMIN_VARI]);

interface Sivellin {
  thinning: number;
  smoothing: number;
  streamline: number;
  hehku?: boolean;
  kumi?: boolean;
  fi: string;
  en: string;
}

export const SIVELTIMET: Record<SivellinId, Sivellin> = {
  tussi: { thinning: 0.2, smoothing: 0.6, streamline: 0.45, fi: "Tussi", en: "Marker" },
  sivellin: { thinning: 0.72, smoothing: 0.7, streamline: 0.5, fi: "Sivellin", en: "Brush" },
  neon: { thinning: 0.05, smoothing: 0.6, streamline: 0.5, hehku: true, fi: "Neon", en: "Neon" },
  kumi: { thinning: 0, smoothing: 0.5, streamline: 0.4, kumi: true, fi: "Kumi", en: "Eraser" },
};

// Koko suhteessa piirrosalustan leveyteen. 0.01 × 1152 px ≈ 12 px screenillä.
export const KOOT: Record<KokoId, number> = { s: 0.01, m: 0.022, l: 0.045 };

// --- Renderöinti ---

const keskiarvo = (a: number, b: number) => (a + b) / 2;

// perfect-freehandin ääriviiva → sileä Path2D (kirjaston README:n mukainen toteutus)
function polkuReunasta(reuna: number[][]): Path2D | null {
  const n = reuna.length;
  if (n < 4) return null;
  let a = reuna[0];
  let b = reuna[1];
  const c = reuna[2];
  let d =
    `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ` +
    `${keskiarvo(b[0], c[0]).toFixed(2)},${keskiarvo(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2; i < n - 1; i++) {
    a = reuna[i];
    b = reuna[i + 1];
    d += `${keskiarvo(a[0], b[0]).toFixed(2)},${keskiarvo(a[1], b[1]).toFixed(2)} `;
  }
  return new Path2D(d + "Z");
}

// Valmiiden viivojen polut välimuistiin, jotta piirtymisanimaatio laskee vain keskeneräisen viivan.
// Pistemäärä kuuluu avaimeen, koska piirtonäkymässä viiva kasvaa samana objektina kesken vedon.
const valimuisti = new WeakMap<Viiva, { avain: string; polku: Path2D | null }>();

function viivanPolku(viiva: Viiva, px: number, minPx: number, pisteita: number) {
  const valmis = pisteita >= viiva.pisteet.length;
  const avain = `${px}|${minPx}|${viiva.pisteet.length}`;
  if (valmis) {
    const osuma = valimuisti.get(viiva);
    if (osuma && osuma.avain === avain) return osuma.polku;
  }
  const s = SIVELTIMET[viiva.sivellin] ?? SIVELTIMET.tussi;
  const pisteet = viiva.pisteet.slice(0, pisteita).map(([x, y, p]) => [x * px, y * px, p]);
  const reuna = getStroke(pisteet, {
    size: Math.max(viiva.koko * px, minPx),
    thinning: s.thinning,
    smoothing: s.smoothing,
    streamline: s.streamline,
    simulatePressure: !viiva.paine,
    last: valmis,
  });
  const polku = polkuReunasta(reuna);
  if (valmis) valimuisti.set(viiva, { avain, polku });
  return polku;
}

interface ViivanAsetukset {
  /** Pienin sallittu viivanleveys pikseleinä (LED-screenillä ohuet viivat katoavat). */
  minPx?: number;
  /** Montako pistettä viivasta piirretään (piirtymisanimaatio). */
  pisteita?: number;
  /** Piirtää kumin mustana (esikatselu mustan taustan päällä) eikä pyyhi. */
  kumiNakyvana?: boolean;
}

/** Piirtää yhden viivan. `px` = alustan leveys pikseleinä. */
export function piirraViiva(ctx: CanvasRenderingContext2D, viiva: Viiva, px: number, asetukset: ViivanAsetukset = {}) {
  const { minPx = 0, pisteita = viiva.pisteet.length, kumiNakyvana = false } = asetukset;
  const polku = viivanPolku(viiva, px, minPx, pisteita);
  if (!polku) return;
  const s = SIVELTIMET[viiva.sivellin] ?? SIVELTIMET.tussi;
  ctx.save();
  if (s.kumi) {
    if (kumiNakyvana) ctx.fillStyle = KUMIN_VARI;
    else ctx.globalCompositeOperation = "destination-out";
    ctx.fill(polku);
  } else {
    ctx.fillStyle = viiva.vari;
    if (s.hehku) {
      ctx.shadowColor = viiva.vari;
      ctx.shadowBlur = Math.max(viiva.koko * px, minPx) * 1.5;
      ctx.fill(polku);
    }
    ctx.fill(polku);
  }
  ctx.restore();
}

/** Piirtää koko piirroksen; `edistyminen` 0–1 piirtää viivat esiin järjestyksessä. */
export function piirraPiirros(
  ctx: CanvasRenderingContext2D,
  piirros: { viivat: Viiva[] },
  px: number,
  { edistyminen = 1, minPx = 0 }: { edistyminen?: number; minPx?: number } = {},
) {
  const yhteensa = piirros.viivat.reduce((s, v) => s + v.pisteet.length, 0);
  let jaljella = edistyminen >= 1 ? Infinity : Math.floor(yhteensa * edistyminen);
  for (const viiva of piirros.viivat) {
    if (jaljella <= 0) break;
    const n = viiva.pisteet.length;
    piirraViiva(ctx, viiva, px, { minPx, pisteita: Math.min(n, jaljella) });
    jaljella -= n;
  }
}

/** Asettaa canvasin pikselikoon CSS-koon ja näytön tarkkuuden mukaan; palauttaa leveyden pikseleinä. */
export function sovitaCanvas(canvas: HTMLCanvasElement, cssKoko: number, dpr = window.devicePixelRatio || 1) {
  const px = Math.round(cssKoko * dpr);
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }
  return px;
}

/** Piirtää piirroksen canvasille sen koko alalle (pienoiskuvat ja esikatselut). */
export function piirraKokonaan(canvas: HTMLCanvasElement, piirros: { viivat: Viiva[] }, cssKoko = canvas.clientWidth) {
  if (!cssKoko) return;
  const px = sovitaCanvas(canvas, cssKoko);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, px, px);
  piirraPiirros(ctx, piirros, px);
}

export const tunnus = (nro: number) => `#${String(nro).padStart(4, "0")}`;

export const kellonaika = (aika: string | number) =>
  new Date(aika).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });
