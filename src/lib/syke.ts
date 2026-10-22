// Näyttöjen sykkeen tulkinta moderointia varten. Näyttö lähettää sykkeen 30 s välein.

export interface NaytonSyke {
  tunnus: string;
  viimeksi_nahty: string;
  tiedot: {
    versio?: string;
    layout?: string;
    tauko?: boolean;
    verkossa?: boolean;
    piirroksia?: number;
    naytolla?: number[];
    kaynnissa_min?: number;
    virheita_min?: number;
  };
}

export type SykkeenTila = "ok" | "viive" | "poissa";

/** ok = syke tuore, viive = yksi tai kaksi sykettä jäänyt väliin, poissa = näyttö ei vastaa */
export function sykkeenTila(syke: Pick<NaytonSyke, "viimeksi_nahty" | "tiedot">, nyt = Date.now()): SykkeenTila {
  const ika = nyt - Date.parse(syke.viimeksi_nahty);
  if (ika > 180_000) return "poissa";
  if (ika > 75_000 || syke.tiedot.verkossa === false || (syke.tiedot.virheita_min ?? 0) > 0) return "viive";
  return "ok";
}

export function ikaTekstina(iso: string, nyt = Date.now()): string {
  const s = Math.max(0, Math.round((nyt - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  return `${Math.floor(s / 3600)} h`;
}
