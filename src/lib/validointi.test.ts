import { describe, expect, it } from "vitest";
import { KOOT } from "./piirto";
import { RAJAT, tarkistaLahetys } from "./validointi";

const viiva = (pisteita = 10, muutos: Record<string, unknown> = {}) => ({
  vari: "#FFFFFF",
  koko: KOOT.m,
  sivellin: "tussi",
  paine: false,
  pisteet: Array.from({ length: pisteita }, (_, i) => [i / pisteita, 0.5, 0.5, i * 16]),
  ...muutos,
});

const lahetys = (muutos: Record<string, unknown> = {}) => ({ viivat: [viiva()], lahde: "mobiili", kieli: "fi", ...muutos });

describe("tarkistaLahetys", () => {
  it("hyväksyy kelvollisen piirroksen ja pyöristää pisteet", () => {
    const tulos = tarkistaLahetys(lahetys({ viivat: [viiva(10, { pisteet: Array.from({ length: 10 }, () => [0.123456, 0.5, 0.33333, 1.6]) })] }));
    expect(tulos.ok).toBe(true);
    if (tulos.ok) expect(tulos.lahetys.viivat[0].pisteet[0]).toEqual([0.1235, 0.5, 0.333, 2]);
  });

  it("poistaa tuntemattomat kentät", () => {
    const tulos = tarkistaLahetys({ ...lahetys(), tila: "hyvaksytty", viivat: [{ ...viiva(), extra: "x" }] });
    expect(tulos.ok).toBe(true);
    if (tulos.ok) {
      expect(tulos.lahetys).not.toHaveProperty("tila");
      expect(tulos.lahetys.viivat[0]).not.toHaveProperty("extra");
    }
  });

  it("hyväksyy kioskilähteen", () => {
    expect(tarkistaLahetys(lahetys({ lahde: "ipad-2" })).ok).toBe(true);
  });

  it.each([
    ["tyhjä piirros", lahetys({ viivat: [] })],
    ["pelkkä kumi", lahetys({ viivat: [viiva(20, { sivellin: "kumi", vari: "#000000" })] })],
    ["liian vähän pisteitä", lahetys({ viivat: [viiva(RAJAT.pisteitaVahintaan - 1)] })],
    ["väri paletin ulkopuolelta", lahetys({ viivat: [viiva(10, { vari: "#123456" })] })],
    ["tuntematon koko", lahetys({ viivat: [viiva(10, { koko: 0.5 })] })],
    ["tuntematon sivellin", lahetys({ viivat: [viiva(10, { sivellin: "spray" })] })],
    ["piste alustan ulkopuolella", lahetys({ viivat: [viiva(10, { pisteet: Array(10).fill([1.5, 0.5, 0.5, 0]) })] })],
    ["piste ei ole luku", lahetys({ viivat: [viiva(10, { pisteet: Array(10).fill([0.5, "x", 0.5, 0]) })] })],
    ["tuntematon lähde", lahetys({ lahde: "<script>" })],
    ["tuntematon kieli", lahetys({ kieli: "sv" })],
    ["liikaa viivoja", lahetys({ viivat: Array.from({ length: RAJAT.viivoja + 1 }, () => viiva(2)) })],
    ["ei objekti", "piirros"],
  ])("hylkää: %s", (_, data) => {
    expect(tarkistaLahetys(data).ok).toBe(false);
  });
});
