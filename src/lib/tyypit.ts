// Raapustamon tietotyypit. Vastaavat tietokannan taulua `piirrokset`
// (supabase/migrations/0001_perusrakenne.sql).

/** x ja y normalisoitu 0–1 piirrosalustan leveyteen, paine 0–1, t millisekunteina viivan alusta. */
export type Piste = [x: number, y: number, paine: number, t: number];

export type SivellinId = "tussi" | "sivellin" | "neon" | "kumi";

export type KokoId = "s" | "m" | "l";

export interface Viiva {
  vari: string;
  koko: number;
  sivellin: SivellinId;
  /** true = paine tulee kynästä, false = paine simuloidaan nopeudesta */
  paine: boolean;
  pisteet: Piste[];
}

export type PiirroksenTila = "jonossa" | "hyvaksytty" | "hylatty" | "piilotettu";

export type Kieli = "fi" | "en";

export interface AiArvio {
  luokka: "ok" | "epailyttava" | "sopimaton";
  varmuus: number;
  syy: string;
}

export interface Piirros {
  id: string;
  nro: number;
  luotu: string;
  viivat: Viiva[];
  lahde: string;
  kieli: Kieli;
  tila: PiirroksenTila;
  ai_arvio: AiArvio | null;
  nostettu: boolean;
  galleriaan: boolean;
  moderoitu: string | null;
  nayttokerrat: number;
  viimeksi_naytetty: string | null;
}

/** Näytön tarvitsemat kentät */
export type NaytettavaPiirros = Pick<
  Piirros,
  "id" | "nro" | "luotu" | "viivat" | "nostettu" | "nayttokerrat" | "viimeksi_naytetty"
>;
