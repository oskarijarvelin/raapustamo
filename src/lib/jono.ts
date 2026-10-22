// Jonologiikka: missä järjestyksessä moderaattori näkee piirrokset ja mitä screen näyttää seuraavaksi.
import type { NaytettavaPiirros, Piirros } from "./tyypit";

const aika = (iso: string | null) => (iso ? Date.parse(iso) : 0);

const AI_PRIORITEETTI: Record<string, number> = { sopimaton: 0, epailyttava: 1 };

/** Moderointijono: tekoälyn epäilyttäviksi merkitsemät ensin, muuten vanhin ensin. */
export function moderointijono(piirrokset: Piirros[]): Piirros[] {
  const prioriteetti = (p: Piirros) => AI_PRIORITEETTI[p.ai_arvio?.luokka ?? ""] ?? 2;
  return piirrokset
    .filter((p) => p.tila === "jonossa")
    .sort((a, b) => prioriteetti(a) - prioriteetti(b) || aika(a.luotu) - aika(b.luotu));
}

/**
 * Seuraava screenille näytettävä piirros:
 * 1) näyttämättömät ensin (vanhin ensin), 2) nostetut useammin,
 * 3) vähiten / pisimpään sitten näytetyt.
 */
export function seuraavaPiirros<T extends NaytettavaPiirros>(piirrokset: T[], poissulje: ReadonlySet<string>): T | undefined {
  const painotettu = (p: T) => p.nayttokerrat / (p.nostettu ? 2 : 1);
  return piirrokset
    .filter((p) => !poissulje.has(p.id))
    .sort((a, b) => {
      const uusiA = a.nayttokerrat === 0;
      const uusiB = b.nayttokerrat === 0;
      if (uusiA !== uusiB) return uusiA ? -1 : 1;
      if (uusiA) return aika(a.luotu) - aika(b.luotu);
      return painotettu(a) - painotettu(b) || aika(a.viimeksi_naytetty) - aika(b.viimeksi_naytetty);
    })[0];
}
