import { describe, expect, it } from "vitest";
import { demopiirros, demopiirrokset } from "./demopiirrokset";
import { tarkistaLahetys } from "./validointi";

describe("demopiirrokset", () => {
  it("ovat samanlaisia kuin oikeat lähetykset (palvelimen validointi hyväksyy)", () => {
    for (const p of demopiirrokset(60)) {
      const tulos = tarkistaLahetys({ viivat: p.viivat, lahde: "mobiili", kieli: "fi" });
      expect(tulos.ok, `${p.id}: ${!tulos.ok && tulos.virhe}`).toBe(true);
    }
  });

  it("sama numero tuottaa saman piirroksen", () => {
    expect(demopiirros(7)).toEqual(demopiirros(7));
    expect(demopiirros(7).viivat).not.toEqual(demopiirros(8).viivat);
  });

  it("tunnisteet ovat yksilöllisiä ja osa on nostettu", () => {
    const lista = demopiirrokset(40);
    expect(new Set(lista.map((p) => p.id)).size).toBe(40);
    expect(lista.some((p) => p.nostettu)).toBe(true);
  });
});
