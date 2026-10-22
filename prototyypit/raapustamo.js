// Raapustamo – prototyyppien yhteinen koodi: muste- ja sivellinmääritykset, piirrosten
// renderöinti sekä demodatan tallennus selaimen localStorageen (tuotannossa Supabase).
import { getStroke } from "https://cdn.jsdelivr.net/npm/perfect-freehand@1.2.2/+esm";

// --- Musteet ja siveltimet ---

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
];

export const SIVELTIMET = {
  tussi: { thinning: 0.2, smoothing: 0.6, streamline: 0.45, fi: "Tussi", en: "Marker" },
  sivellin: { thinning: 0.72, smoothing: 0.7, streamline: 0.5, fi: "Sivellin", en: "Brush" },
  neon: { thinning: 0.05, smoothing: 0.6, streamline: 0.5, hehku: true, fi: "Neon", en: "Neon" },
  kumi: { thinning: 0, smoothing: 0.5, streamline: 0.4, kumi: true, fi: "Kumi", en: "Eraser" },
};

// Koko suhteessa piirrosalustan leveyteen. 0.01 × 1152 px ≈ 12 px screenillä.
export const KOOT = { s: 0.01, m: 0.022, l: 0.045 };

// --- Renderöinti ---

const keskiarvo = (a, b) => (a + b) / 2;

// perfect-freehandin ääriviiva → sileä Path2D (kirjaston README:n mukainen toteutus)
function polkuReunasta(reuna) {
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
const valimuisti = new WeakMap();

function viivanPolku(viiva, px, minPx, pisteita) {
  const valmis = pisteita >= viiva.pisteet.length;
  const avain = `${px}|${minPx}`;
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

/**
 * Piirtää yhden viivan. `px` = alustan leveys pikseleinä, `minPx` = pienin sallittu
 * viivanleveys (LED-screenillä ohuet viivat katoavat), `pisteita` = montako pistettä piirretään.
 * `kumiNakyvana` piirtää kumin mustana (esikatselu mustan taustan päällä) eikä pyyhi.
 */
export function piirraViiva(ctx, viiva, px, { minPx = 0, pisteita = viiva.pisteet.length, kumiNakyvana = false } = {}) {
  const polku = viivanPolku(viiva, px, minPx, pisteita);
  if (!polku) return;
  const s = SIVELTIMET[viiva.sivellin] ?? SIVELTIMET.tussi;
  ctx.save();
  if (s.kumi) {
    if (kumiNakyvana) ctx.fillStyle = "#000";
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
export function piirraPiirros(ctx, piirros, px, { edistyminen = 1, minPx = 0 } = {}) {
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
export function sovitaCanvas(canvas, cssKoko, dpr = window.devicePixelRatio || 1) {
  const px = Math.round(cssKoko * dpr);
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }
  return px;
}

export const tunnus = (nro) => `#${String(nro).padStart(4, "0")}`;

export const kellonaika = (ms) =>
  new Date(ms).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });

// --- Demodata (localStorage + BroadcastChannel; tuotannossa Supabase + Realtime) ---

const AVAIN = "raapustamo:demo:v1";
const TAUKO = "raapustamo:demo:tauko";
const kanava = "BroadcastChannel" in self ? new BroadcastChannel("raapustamo") : null;

function lue(avain) {
  try {
    return JSON.parse(localStorage.getItem(avain));
  } catch {
    return null;
  }
}

function kirjoita(avain, arvo) {
  try {
    localStorage.setItem(avain, JSON.stringify(arvo));
  } catch {
    // Yksityinen selausikkuna tms. – prototyyppi toimii silloin vain yhdessä välilehdessä.
  }
  kanava?.postMessage("muuttui");
}

let muistissa = null;

export function piirrokset() {
  const tallennettu = lue(AVAIN);
  if (Array.isArray(tallennettu)) {
    muistissa = tallennettu;
  } else if (!muistissa) {
    muistissa = siemen();
    kirjoita(AVAIN, muistissa);
  }
  return muistissa;
}

export function lisaaPiirros({ viivat, lahde, kieli }) {
  const lista = piirrokset();
  const nro = lista.reduce((m, p) => Math.max(m, p.nro), 0) + 1;
  const piirros = {
    id: crypto.randomUUID?.() ?? `p${Date.now()}`,
    nro,
    luotu: Date.now(),
    viivat,
    lahde,
    kieli,
    tila: "jonossa",
    ai_arvio: null,
    nostettu: false,
    nayttokerrat: 0,
    viimeksi_naytetty: null,
  };
  lista.push(piirros);
  kirjoita(AVAIN, lista);
  return piirros;
}

export function paivitaPiirros(id, muutos) {
  const lista = piirrokset();
  const piirros = lista.find((p) => p.id === id);
  if (!piirros) return null;
  Object.assign(piirros, muutos);
  kirjoita(AVAIN, lista);
  return piirros;
}

export function nollaaDemo() {
  muistissa = null;
  try {
    localStorage.removeItem(AVAIN);
    localStorage.removeItem(TAUKO);
  } catch {}
  piirrokset();
}

export const naytonTauko = () => lue(TAUKO) === true;
export const asetaTauko = (paalla) => kirjoita(TAUKO, paalla);

export function kuunteleMuutoksia(kasittelija) {
  kanava?.addEventListener("message", kasittelija);
  addEventListener("storage", (e) => {
    if (!e.key || e.key.startsWith("raapustamo:")) kasittelija();
  });
}

// --- Siemenpiirrokset, jotta moderointi ja näyttö eivät ole tyhjiä ---

function satunnainen(siemen) {
  return () => {
    siemen = (siemen * 16807) % 2147483647;
    return (siemen - 1) / 2147483646;
  };
}

const ympyra = (cx, cy, rx, ry = rx, a0 = 0, a1 = Math.PI * 2, n = 56) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });

const jana = (x0, y0, x1, y1, n = 14) =>
  Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);

const murtoviiva = (kulmat, n = 12) =>
  kulmat.slice(1).flatMap((p, i) => jana(kulmat[i][0], kulmat[i][1], p[0], p[1], n).slice(i ? 1 : 0));

const laatikkoon = (kulmat, x, y, w, h) => kulmat.map(([u, v]) => [x + u * w, y + v * h]);

const KIRJAIMET = {
  L: [[[0, 0], [0, 1], [0.8, 1]]],
  U: [[[0, 0], [0, 0.7], [0.1, 0.92], [0.3, 1], [0.7, 1], [0.9, 0.92], [1, 0.7], [1, 0]]],
  M: [[[0, 1], [0, 0], [0.5, 0.6], [1, 0], [1, 1]]],
  I: [[[0.5, 0], [0.5, 1]]],
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]],
  E: [[[0.9, 0], [0, 0], [0, 1], [0.9, 1]], [[0, 0.5], [0.7, 0.5]]],
  "!": [[[0.5, 0], [0.5, 0.68]], [[0.5, 0.92], [0.5, 1]]],
};

function teksti(sana, x, y, korkeus, vali = 0.25) {
  const leveys = korkeus * 0.62;
  const viivat = [];
  let kohta = x;
  for (const merkki of sana) {
    if (merkki === "O") {
      viivat.push(ympyra(kohta + leveys / 2, y + korkeus / 2, leveys / 2, korkeus / 2, -Math.PI / 2, Math.PI * 1.5));
    } else {
      for (const osa of KIRJAIMET[merkki] ?? []) viivat.push(murtoviiva(laatikkoon(osa, kohta, y, leveys, korkeus)));
    }
    kohta += leveys * (1 + vali);
  }
  return viivat;
}

const sydan = (cx, cy, s) =>
  Array.from({ length: 73 }, (_, i) => {
    const t = (i / 72) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [cx + (x / 17) * s, cy - (y / 17) * s];
  });

function siemen() {
  const r = satunnainen(2026);
  const M = Object.fromEntries(MUSTEET.map((m) => [m.id, m.hex]));
  const viiva = (pisteet, vari, { koko = KOOT.m, sivellin = "tussi" } = {}) => {
    let t = 0;
    return {
      vari,
      koko,
      sivellin,
      paine: false,
      pisteet: pisteet.map(([x, y]) => [
        +(x + (r() - 0.5) * 0.004).toFixed(4),
        +(y + (r() - 0.5) * 0.004).toFixed(4),
        0.5,
        (t += 16),
      ]),
    };
  };
  const monta = (polut, vari, asetukset) => polut.map((p) => viiva(p, vari, asetukset));

  const kuvat = [
    // 1. MOI!
    [...monta(teksti("MOI!", 0.14, 0.32, 0.3), M.valkoinen, { koko: KOOT.l }), viiva(ympyra(0.5, 0.78, 0.3, 0.04, Math.PI, 0), M.sini, { koko: KOOT.m, sivellin: "neon" })],
    // 2. Sydän
    [viiva(sydan(0.5, 0.52, 0.34), M.puna, { koko: KOOT.l, sivellin: "sivellin" }), viiva(sydan(0.5, 0.52, 0.22), M.roosa, { sivellin: "neon" })],
    // 3. Aurinko
    [
      viiva(ympyra(0.5, 0.5, 0.17), M.oranssi, { koko: KOOT.l }),
      ...Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return viiva(jana(0.5 + Math.cos(a) * 0.24, 0.5 + Math.sin(a) * 0.24, 0.5 + Math.cos(a) * 0.38, 0.5 + Math.sin(a) * 0.38), i % 2 ? M.puna : M.oranssi, { koko: KOOT.m });
      }),
    ],
    // 4. Revontulet
    [0.25, 0.42, 0.6].map((y0, i) =>
      viiva(
        Array.from({ length: 60 }, (_, k) => [0.08 + k * 0.014, y0 + Math.sin(k / 6 + i) * 0.07 - k * 0.002]),
        [M.metsa, M.roosa, M.taivas][i],
        { koko: KOOT.l, sivellin: "neon" },
      ),
    ),
    // 5. Hymiö
    [viiva(ympyra(0.5, 0.5, 0.34), M.hiekka, { koko: KOOT.m }), viiva(ympyra(0.38, 0.4, 0.035), M.hiekka, { koko: KOOT.l }), viiva(ympyra(0.62, 0.4, 0.035), M.hiekka, { koko: KOOT.l }), viiva(ympyra(0.5, 0.52, 0.18, 0.16, 0.15 * Math.PI, 0.85 * Math.PI), M.oranssi, { koko: KOOT.m })],
    // 6. Tähti
    [
      viiva(
        murtoviiva(Array.from({ length: 6 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI * 4) / 5;
          return [0.5 + Math.cos(a) * 0.36, 0.53 + Math.sin(a) * 0.36];
        }), 10),
        M.valkoinen,
        { koko: KOOT.m, sivellin: "neon" },
      ),
    ],
    // 7. Spiraali
    [viiva(Array.from({ length: 160 }, (_, i) => { const a = i / 9; return [0.5 + Math.cos(a) * i * 0.0023, 0.5 + Math.sin(a) * i * 0.0023]; }), M.roosa, { koko: KOOT.m, sivellin: "sivellin" })],
    // 8. Sateenkaari
    ["puna", "oranssi", "hiekka", "metsa", "taivas", "sini"].map((v, i) => viiva(ympyra(0.5, 0.72, 0.4 - i * 0.05, 0.4 - i * 0.05, Math.PI, Math.PI * 2), M[v], { koko: KOOT.m })),
    // 9. Kukka
    [
      viiva(jana(0.5, 0.52, 0.5, 0.92), M.metsa, { koko: KOOT.m }),
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return viiva(ympyra(0.5 + Math.cos(a) * 0.12, 0.36 + Math.sin(a) * 0.12, 0.08), M.roosa, { koko: KOOT.s, sivellin: "sivellin" });
      }),
      viiva(ympyra(0.5, 0.36, 0.05), M.oranssi, { koko: KOOT.l }),
    ],
    // 10. LUMO + sydän
    [...monta(teksti("LUMO", 0.1, 0.28, 0.24), M.valkoinen, { koko: KOOT.m }), viiva(sydan(0.5, 0.74, 0.12), M.puna, { koko: KOOT.m, sivellin: "neon" })],
    // 11. Kissa
    [
      viiva(ympyra(0.5, 0.55, 0.28, 0.24), M.hiekka, { koko: KOOT.m }),
      viiva(murtoviiva([[0.28, 0.42], [0.3, 0.16], [0.44, 0.33]]), M.hiekka, { koko: KOOT.m }),
      viiva(murtoviiva([[0.56, 0.33], [0.7, 0.16], [0.72, 0.42]]), M.hiekka, { koko: KOOT.m }),
      viiva(ympyra(0.41, 0.52, 0.025), M.metsa, { koko: KOOT.l }),
      viiva(ympyra(0.59, 0.52, 0.025), M.metsa, { koko: KOOT.l }),
      ...[0.58, 0.62].flatMap((y) => [viiva(jana(0.2, y, 0.4, y + 0.01), M.valkoinen, { koko: KOOT.s }), viiva(jana(0.6, y + 0.01, 0.8, y), M.valkoinen, { koko: KOOT.s })]),
    ],
    // 12. Glitch-raidat
    Array.from({ length: 9 }, (_, i) => {
      const y = 0.18 + i * 0.08;
      const x0 = 0.1 + r() * 0.25;
      return viiva(jana(x0, y, x0 + 0.3 + r() * 0.3, y), [M.valkoinen, M.sini, M.puna][i % 3], { koko: i % 2 ? KOOT.l : KOOT.m });
    }),
    // 13. Aallot (jonossa)
    [0.35, 0.5, 0.65].map((y0, i) => viiva(Array.from({ length: 50 }, (_, k) => [0.1 + k * 0.016, y0 + Math.sin(k / 4 + i) * 0.05]), [M.taivas, M.sini, M.valkoinen][i], { koko: KOOT.m })),
    // 14. HEI + raapustus (jonossa)
    [...monta(teksti("HEI", 0.2, 0.3, 0.26), M.oranssi, { koko: KOOT.l }), viiva(Array.from({ length: 40 }, (_, k) => [0.2 + k * 0.015, 0.72 + Math.sin(k * 1.7) * 0.04]), M.hiekka, { koko: KOOT.s })],
    // 15. Raapustus (jonossa)
    [viiva(Array.from({ length: 90 }, (_, k) => [0.5 + Math.sin(k * 0.7) * 0.3 * Math.cos(k * 0.11), 0.5 + Math.cos(k * 0.9) * 0.3]), M.puna, { koko: KOOT.m })],
    // 16. Raapustus (hylätty)
    [viiva(Array.from({ length: 70 }, (_, k) => [0.2 + (k % 10) * 0.065, 0.2 + Math.floor(k / 10) * 0.09 + r() * 0.05]), M.valkoinen, { koko: KOOT.l })],
  ];

  const nyt = Date.now();
  const arviot = {
    12: { luokka: "ok", varmuus: 0.97, syy: "Ei havaittuja ongelmia." },
    13: { luokka: "epailyttava", varmuus: 0.71, syy: "Piirroksessa on tekstiä – tarkista, ettei siinä ole nimeä tai yhteystietoja." },
    14: { luokka: "sopimaton", varmuus: 0.64, syy: "Muoto voi muistuttaa sopimatonta symbolia." },
    15: { luokka: "sopimaton", varmuus: 0.88, syy: "Muoto voi muistuttaa sopimatonta symbolia." },
  };
  const lahteet = ["mobiili", "ipad-1", "mobiili", "ipad-2"];

  return kuvat.map((viivat, i) => {
    const tila = i < 12 ? "hyvaksytty" : i < 15 ? "jonossa" : "hylatty";
    const naytetty = tila === "hyvaksytty" && i % 3 !== 0;
    return {
      id: `siemen-${i + 1}`,
      nro: i + 1,
      luotu: nyt - (kuvat.length - i) * 7 * 60 * 1000,
      viivat,
      lahde: lahteet[i % lahteet.length],
      kieli: i % 4 === 3 ? "en" : "fi",
      tila,
      ai_arvio: arviot[i] ?? { luokka: "ok", varmuus: 0.95, syy: "Ei havaittuja ongelmia." },
      nostettu: i === 1 || i === 3,
      nayttokerrat: naytetty ? 1 + (i % 4) : 0,
      viimeksi_naytetty: naytetty ? nyt - i * 60 * 1000 : null,
    };
  });
}
