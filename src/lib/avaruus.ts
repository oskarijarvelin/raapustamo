// Avaruus-layoutin laskenta: piirrokset syntyvät vapaaseen kohtaan, ajelehtivat hitaasti ja
// poistuvat (glitchaavat pois), kun ovat kulkeneet oman matkansa. Puhdasta laskentaa ilman DOMia.

export interface Alue {
  leveys: number;
  korkeus: number;
}

export interface Kappale {
  /** Keskipiste lavan pikseleinä */
  x: number;
  y: number;
  /** Piirroksen sivun pituus pikseleinä */
  koko: number;
  /** Nopeus px/s */
  vx: number;
  vy: number;
  /** Kulma ja kiertonopeus radiaaneina */
  kulma: number;
  kierto: number;
  /** Kuinka pitkälle kappale ajelehtii ennen poistumista, ja kuinka pitkälle se on jo kulkenut */
  matka: number;
  kuljettu: number;
}

type Satunnainen = () => number;

/** Kuinka paljon piirroksesta saa olla lavan reunan yli. Piirroksissa on reunoilla tyhjää tilaa. */
const REUNAVARA = 0.4;
const EHDOKKAITA = 40;

/** Rajat, joiden sisällä kappaleen keskipisteen on pysyttävä koko matkansa ajan. */
export function rajat(alue: Alue, koko: number) {
  const vara = koko * REUNAVARA;
  return { x0: vara, x1: alue.leveys - vara, y0: vara, y1: alue.korkeus - vara };
}

const sisalla = (r: ReturnType<typeof rajat>, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/**
 * Uusi kappale mahdollisimman kauas muista. Arvotaan ehdokkaita (paikka, suunta ja matka),
 * hylätään ne, jotka ajelehtisivat lavalta, ja valitaan se, jonka lähin naapuri on kauimpana.
 */
export function uusiKappale(
  alue: Alue,
  muut: readonly (Pick<Kappale, "x" | "y" | "koko"> & Partial<Pick<Kappale, "vx" | "vy">>)[],
  koko: number,
  elinaikaS: number,
  satunnainen: Satunnainen = Math.random,
): Kappale {
  const r = rajat(alue, koko);
  let paras: { x: number; y: number; kulma: number; matka: number; pisteet: number } | null = null;

  for (let i = 0; i < EHDOKKAITA; i++) {
    const x = r.x0 + satunnainen() * Math.max(0, r.x1 - r.x0);
    const y = r.y0 + satunnainen() * Math.max(0, r.y1 - r.y0);
    let suunta = satunnainen() * Math.PI * 2;
    const matka = koko * (0.35 + satunnainen() * 0.35);
    // Jos ajelehtiminen veisi lavalta, kokeillaan vastakkaista suuntaa.
    const loppu = (s: number) => [x + Math.cos(s) * matka, y + Math.sin(s) * matka] as const;
    if (!sisalla(r, ...loppu(suunta))) suunta += Math.PI;
    const [lx, ly] = loppu(suunta);
    const mahtuu = sisalla(r, lx, ly);

    // Etäisyys lähimpään naapuriin suhteessa kokoihin: nyt ja matkan puolivälissä, jolloin
    // myös naapurit ovat ajelehtineet eteenpäin.
    const keskiX = (x + lx) / 2;
    const keskiY = (y + ly) / 2;
    const puolivali = elinaikaS / 2;
    let lahin = Infinity;
    for (const m of muut) {
      const yhteinen = (koko + m.koko) / 2;
      const mx = m.x + (m.vx ?? 0) * puolivali;
      const my = m.y + (m.vy ?? 0) * puolivali;
      lahin = Math.min(lahin, Math.hypot(x - m.x, y - m.y) / yhteinen, Math.hypot(keskiX - mx, keskiY - my) / yhteinen);
    }
    const pisteet = (Number.isFinite(lahin) ? lahin : 10) - (mahtuu ? 0 : 100);
    if (!paras || pisteet > paras.pisteet) paras = { x, y, kulma: suunta, matka: mahtuu ? matka : 0, pisteet };
  }

  const p = paras!;
  const nopeus = p.matka / Math.max(1, elinaikaS);
  return {
    x: p.x,
    y: p.y,
    koko,
    vx: Math.cos(p.kulma) * nopeus,
    vy: Math.sin(p.kulma) * nopeus,
    kulma: (satunnainen() - 0.5) * 0.12,
    kierto: (satunnainen() - 0.5) * 0.012,
    // Jos mikään suunta ei mahtunut, kappale pysyy paikallaan ja poistuu elinajan päätteeksi.
    matka: p.matka || nopeus * elinaikaS || 1,
    kuljettu: 0,
  };
}

/** Siirtää kappaletta `dt` sekuntia eteenpäin. Palauttaa true, kun kappale on kulkenut matkansa. */
export function etene(k: Kappale, dt: number): boolean {
  k.x += k.vx * dt;
  k.y += k.vy * dt;
  k.kulma += k.kierto * dt;
  k.kuljettu += Math.hypot(k.vx, k.vy) * dt;
  return k.kuljettu >= k.matka;
}

/** Piirroksen koko: nostetut lähempänä (isompina), muut satunnaisessa syvyydessä. */
export function kappaleenKoko(korkeus: number, nostettu: boolean, satunnainen: Satunnainen = Math.random) {
  const suhde = nostettu ? 0.72 + satunnainen() * 0.08 : 0.36 + satunnainen() * 0.26;
  return Math.round(korkeus * suhde);
}
