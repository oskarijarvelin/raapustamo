import { describe, expect, it } from "vitest";
import { moderointijono, seuraavaPiirros } from "./jono";
import type { AiArvio, Piirros } from "./tyypit";

let laskuri = 0;
const piirros = (muutos: Partial<Piirros> = {}): Piirros => {
  laskuri += 1;
  return {
    id: `p${laskuri}`,
    nro: laskuri,
    luotu: new Date(Date.UTC(2026, 10, 17, 18, laskuri)).toISOString(),
    viivat: [],
    lahde: "mobiili",
    kieli: "fi",
    tila: "hyvaksytty",
    ai_arvio: null,
    nostettu: false,
    galleriaan: true,
    moderoitu: null,
    nayttokerrat: 0,
    viimeksi_naytetty: null,
    ...muutos,
  };
};

const arvio = (luokka: AiArvio["luokka"]): AiArvio => ({ luokka, varmuus: 0.9, syy: "" });

describe("seuraavaPiirros", () => {
  it("näyttää näyttämättömät ensin vanhimmasta alkaen", () => {
    const vanha = piirros({ nayttokerrat: 0 });
    const uusi = piirros({ nayttokerrat: 0 });
    const naytetty = piirros({ nayttokerrat: 1, viimeksi_naytetty: "2026-11-17T17:00:00Z" });
    expect(seuraavaPiirros([naytetty, uusi, vanha], new Set())?.id).toBe(vanha.id);
  });

  it("painottaa nostettuja", () => {
    const tavallinen = piirros({ nayttokerrat: 2, viimeksi_naytetty: "2026-11-17T17:00:00Z" });
    const nostettu = piirros({ nayttokerrat: 3, nostettu: true, viimeksi_naytetty: "2026-11-17T17:30:00Z" });
    expect(seuraavaPiirros([tavallinen, nostettu], new Set())?.id).toBe(nostettu.id);
  });

  it("valitsee pisimpään sitten näytetyn, kun näyttökerrat ovat samat", () => {
    const aiemmin = piirros({ nayttokerrat: 2, viimeksi_naytetty: "2026-11-17T17:00:00Z" });
    const askettain = piirros({ nayttokerrat: 2, viimeksi_naytetty: "2026-11-17T18:00:00Z" });
    expect(seuraavaPiirros([askettain, aiemmin], new Set())?.id).toBe(aiemmin.id);
  });

  it("ohittaa screenillä jo näkyvät", () => {
    const a = piirros();
    const b = piirros();
    expect(seuraavaPiirros([a, b], new Set([a.id]))?.id).toBe(b.id);
    expect(seuraavaPiirros([a], new Set([a.id]))).toBeUndefined();
  });
});

describe("moderointijono", () => {
  it("näyttää vain jonossa olevat, tekoälyn liputtamat ensin", () => {
    const ok = piirros({ tila: "jonossa", ai_arvio: arvio("ok") });
    const eiArviota = piirros({ tila: "jonossa" });
    const epailyttava = piirros({ tila: "jonossa", ai_arvio: arvio("epailyttava") });
    const sopimaton = piirros({ tila: "jonossa", ai_arvio: arvio("sopimaton") });
    const hyvaksytty = piirros({ tila: "hyvaksytty" });
    expect(moderointijono([ok, eiArviota, epailyttava, sopimaton, hyvaksytty]).map((p) => p.id)).toEqual([
      sopimaton.id,
      epailyttava.id,
      ok.id,
      eiArviota.id,
    ]);
  });
});
