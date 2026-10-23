// Näytön yhteiset efektit.

/** Glitch: vaakasuorat kaistat siirtyvät sivuttain. `voima` 0–1, yli 0.6 alkaa häivyttää. */
export function glitch(ctx: CanvasRenderingContext2D, lahde: HTMLCanvasElement, voima: number) {
  const { width: w, height: h } = lahde;
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, voima - 0.6) * 2.5);
  let y = 0;
  while (y < h) {
    const kaista = 6 + Math.floor(Math.random() * 70);
    const siirto = Math.random() < 0.4 ? (Math.random() - 0.5) * 2 * voima * w * 0.14 : 0;
    ctx.drawImage(lahde, 0, y, w, kaista, siirto, y, w, kaista);
    y += kaista;
  }
  ctx.globalAlpha = 1;
}

export const pehmea = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
