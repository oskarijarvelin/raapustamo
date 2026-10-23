// Kestotestin mittausten analyysi (scripts/kestotesti.mjs). Erillään, jotta sen voi testata.

/** Alun mittaukset jätetään pois muistin kasvusta: sivu lataa ja välimuistit täyttyvät. */
export const LAMPENEMINEN_MIN = 10;
/** Tätä nopeampi muistin kasvu tunnissa viittaa vuotoon. */
export const VUOTORAJA_MB_H = 5;
/** Tätä pienempi kuvataajuus on näkyvää nykimistä. */
export const FPS_RAJA = 30;

/** Pienimmän neliösumman suoran kulmakerroin: y:n muutos x:n yksikköä kohden. */
export function kulmakerroin(pisteet) {
  const n = pisteet.length;
  if (n < 2) return 0;
  const kx = pisteet.reduce((s, [x]) => s + x, 0) / n;
  const ky = pisteet.reduce((s, [, y]) => s + y, 0) / n;
  let osoittaja = 0;
  let nimittaja = 0;
  for (const [x, y] of pisteet) {
    osoittaja += (x - kx) * (y - ky);
    nimittaja += (x - kx) ** 2;
  }
  return nimittaja ? osoittaja / nimittaja : 0;
}

const mediaani = (luvut) => {
  if (!luvut.length) return null;
  const j = [...luvut].sort((a, b) => a - b);
  const k = Math.floor(j.length / 2);
  return j.length % 2 ? j[k] : (j[k - 1] + j[k]) / 2;
};

/**
 * @param {{ kulunutMin: number, heapMb: number, domSolmuja: number, fps: number | null }[]} rivit
 * @param {{ latauksia: number, virheita: number, kaatumisia: number }} tapahtumat
 */
export function analysoi(rivit, { latauksia, virheita, kaatumisia }) {
  const lampimat = rivit.filter((r) => r.kulunutMin >= LAMPENEMINEN_MIN);
  const kasvuMbH = kulmakerroin(lampimat.map((r) => [r.kulunutMin / 60, r.heapMb]));
  const solmuKasvuH = kulmakerroin(lampimat.map((r) => [r.kulunutMin / 60, r.domSolmuja]));
  const fpsit = rivit.map((r) => r.fps).filter((f) => typeof f === "number");
  const tulos = {
    kestoMin: rivit.at(-1)?.kulunutMin ?? 0,
    heapAlkuMb: lampimat[0]?.heapMb ?? rivit[0]?.heapMb ?? null,
    heapLoppuMb: rivit.at(-1)?.heapMb ?? null,
    heapMaksimiMb: rivit.length ? Math.max(...rivit.map((r) => r.heapMb)) : null,
    kasvuMbH,
    solmuKasvuH,
    fpsMediaani: mediaani(fpsit),
    fpsMinimi: fpsit.length ? Math.min(...fpsit) : null,
    latauksia,
    virheita,
    kaatumisia,
  };
  const huomiot = [];
  if (lampimat.length < 6) huomiot.push(`Liian lyhyt ajo luotettavaan vuotoarvioon (alle ${LAMPENEMINEN_MIN + 5} min)`);
  else if (kasvuMbH > VUOTORAJA_MB_H) huomiot.push(`Muisti kasvaa ${kasvuMbH.toFixed(1)} Mt/h (raja ${VUOTORAJA_MB_H}): mahdollinen vuoto`);
  if (lampimat.length >= 6 && solmuKasvuH > 100) huomiot.push(`DOM-solmuja tulee ${Math.round(solmuKasvuH)} lisää tunnissa`);
  if (tulos.fpsMediaani !== null && tulos.fpsMediaani < FPS_RAJA) huomiot.push(`Kuvataajuuden mediaani ${tulos.fpsMediaani.toFixed(0)} fps (raja ${FPS_RAJA})`);
  if (latauksia > 0) huomiot.push(`Sivu latautui uudelleen ${latauksia} kertaa (vahtikoira tai kaatuminen)`);
  if (kaatumisia > 0) huomiot.push(`Välilehti kaatui ${kaatumisia} kertaa`);
  if (virheita > 0) huomiot.push(`${virheita} virhettä konsolissa`);
  return { ...tulos, huomiot, ok: huomiot.length === 0 };
}
