// Kioskien salainen tunniste. Pelkkä `?kiosk=ipad-1` ei riitä kioskin väljempään
// rate limitiin, vaan palvelin vaatii kioskikohtaisen avaimen. Avain johdetaan
// palvelimen salaisuudesta, joten avaimia ei tarvitse tallentaa minnekään.
// Sama laskenta on myös skriptissä `scripts/kioskiavain.mjs`.
import { createHmac, timingSafeEqual } from "node:crypto";

export const KIOSKI = /^ipad-[1-9][0-9]?$/;

/** Kioskin avain: HMAC-SHA256(salaisuus, "kioski:<tunnus>") base64url-muodossa, 22 merkkiä (~128 bittiä). */
export function kioskiavain(salaisuus: string, kioski: string): string {
  return createHmac("sha256", salaisuus).update(`kioski:${kioski}`).digest("base64url").slice(0, 22);
}

export function onKioskiavain(salaisuus: string, kioski: string, avain: unknown): boolean {
  if (!KIOSKI.test(kioski) || typeof avain !== "string") return false;
  const odotettu = Buffer.from(kioskiavain(salaisuus, kioski));
  const annettu = Buffer.from(avain);
  return annettu.length === odotettu.length && timingSafeEqual(odotettu, annettu);
}
