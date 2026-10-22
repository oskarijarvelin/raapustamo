// Lähetysten rate limit laitekohtaisesti.
import { createHash } from "node:crypto";

export interface Raja {
  /** Vähimmäisväli kahden lähetyksen välillä sekunteina */
  vali: number;
  /** Enimmäismäärä tunnissa */
  tunnissa: number;
}

// Kioskin iPadin kaikki käyttäjät jakavat saman laitetunnisteen, joten raja on väljempi.
// TODO (vaihe 3): kioskeille oma salainen tunniste, jottei lähdettä voi väärentää.
export const RAJAT: Record<"mobiili" | "kioski", Raja> = {
  mobiili: { vali: 30, tunnissa: 10 },
  kioski: { vali: 8, tunnissa: 150 },
};

export const rajaLahteelle = (lahde: string) => (lahde.startsWith("ipad-") ? RAJAT.kioski : RAJAT.mobiili);

/** Anonyymi laitetunniste: IP + selain + suola hashattuna. IP:tä ei tallenneta selkokielisenä. */
export function laitetunniste(otsakkeet: Headers, suola: string): string {
  const ip = otsakkeet.get("x-forwarded-for")?.split(",")[0]?.trim() || otsakkeet.get("x-real-ip") || "tuntematon";
  const selain = otsakkeet.get("user-agent") ?? "";
  return createHash("sha256").update(`${suola}|${ip}|${selain}`).digest("hex");
}

/**
 * Montako sekuntia pitää vielä odottaa, vai 0 jos lähetys on sallittu.
 * `aiemmat` = laitteen lähetysajat viimeisen tunnin ajalta, uusin ensin.
 */
export function odotusaika(aiemmat: number[], raja: Raja, nyt = Date.now()): number {
  const uusin = aiemmat[0];
  if (uusin !== undefined && nyt - uusin < raja.vali * 1000) return Math.ceil((raja.vali * 1000 - (nyt - uusin)) / 1000);
  const tunnin = aiemmat.filter((t) => nyt - t < 3600_000);
  if (tunnin.length >= raja.tunnissa) {
    const vanhin = Math.min(...tunnin);
    return Math.ceil((3600_000 - (nyt - vanhin)) / 1000);
  }
  return 0;
}
