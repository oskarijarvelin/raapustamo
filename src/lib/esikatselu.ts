// Piirroksen rasterointi palvelimella: vektorit → SVG → PNG. Tekoälyesisuodatus tarvitsee
// kuvan, ja se tehdään palvelimen omasta vektoridatasta, ei selaimen lähettämästä kuvasta.
import { Resvg } from "@resvg/resvg-js";
import { KUMIN_VARI, SIVELTIMET, viivanSvgPolku } from "./piirto";
import type { Viiva } from "./tyypit";

/** Piirros SVG:nä mustalla taustalla, kuten screenillä. Neonin hehkua ei piirretä. */
export function piirrosSvg(viivat: Viiva[], koko: number): string {
  const polut = viivat.flatMap((viiva) => {
    const d = viivanSvgPolku(viiva, koko);
    if (!d) return [];
    // Kumi on mustaa mustalla taustalla, joten järjestyksessä piirrettynä se peittää alleen jäävän.
    const vari = SIVELTIMET[viiva.sivellin]?.kumi ? KUMIN_VARI : viiva.vari;
    return [`<path d="${d}" fill="${vari}"/>`];
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${koko}" height="${koko}" viewBox="0 0 ${koko} ${koko}">` +
    `<rect width="${koko}" height="${koko}" fill="#000000"/>${polut.join("")}</svg>`
  );
}

export function piirrosPng(viivat: Viiva[], koko = 768): Buffer {
  return new Resvg(piirrosSvg(viivat, koko), { font: { loadSystemFonts: false } }).render().asPng();
}
