import { describe, expect, it } from "vitest";
import { KEYNOTE_MUSTEET, eriSuhde, kasitteleViesti, lueSuhde, sovitaSuhteeseen, tyhjaLava, yhdistaTallennettu, type LavanViiva } from "./keynote";
import { KUMIN_VARI } from "./piirto";
import type { Piste } from "./tyypit";

const pisteet = (n: number, alku = 0): Piste[] => Array.from({ length: n }, (_, i) => [(alku + i) / 100, 0.1, 0.5, (alku + i) * 16]);

const viiva = (id: string, n = 3): LavanViiva => ({ id, vari: "#FFFFFF", koko: 0.008, sivellin: "tussi", paine: true, pisteet: pisteet(n) });

describe("kasitteleViesti", () => {
  it("kokoaa keskeneräisen viivan alku- ja jatkoviesteistä", () => {
    const tila = tyhjaLava();
    expect(kasitteleViesti(tila, { tyyppi: "alku", viiva: viiva("a", 2) }).piirra).toBe("kesken");
    kasitteleViesti(tila, { tyyppi: "jatko", id: "a", alku: 2, pisteet: pisteet(3, 2) });
    expect(tila.kesken.get("a")?.pisteet).toEqual(pisteet(5));
  });

  it("ei monista pisteitä, jos jatko menee osittain päällekkäin", () => {
    const tila = tyhjaLava();
    kasitteleViesti(tila, { tyyppi: "alku", viiva: viiva("a", 4) });
    kasitteleViesti(tila, { tyyppi: "jatko", id: "a", alku: 2, pisteet: pisteet(4, 2) });
    expect(tila.kesken.get("a")?.pisteet).toEqual(pisteet(6));
  });

  it("ohittaa jatkon, jonka alkua ei saatu, ja piirtää viivan valmis-viestistä", () => {
    const tila = tyhjaLava();
    expect(kasitteleViesti(tila, { tyyppi: "jatko", id: "a", alku: 5, pisteet: pisteet(2, 5) }).piirra).toBe("ei");
    expect(kasitteleViesti(tila, { tyyppi: "valmis", versio: 1, viiva: viiva("a", 7) })).toEqual({ piirra: "lisatty", synkkaa: false });
    expect(tila.viivat.map((v) => v.id)).toEqual(["a"]);
    expect(tila.kesken.size).toBe(0);
  });

  it("valmis korvaa keskeneräisen viivan ja kasvattaa versiota", () => {
    const tila = tyhjaLava();
    kasitteleViesti(tila, { tyyppi: "alku", viiva: viiva("a", 2) });
    kasitteleViesti(tila, { tyyppi: "valmis", versio: 1, viiva: viiva("a", 9) });
    expect(tila.versio).toBe(1);
    expect(tila.kesken.has("a")).toBe(false);
    expect(tila.viivat[0].pisteet).toHaveLength(9);
  });

  it("kumoaminen ja palauttaminen", () => {
    const tila = tyhjaLava();
    kasitteleViesti(tila, { tyyppi: "valmis", versio: 1, viiva: viiva("a") });
    kasitteleViesti(tila, { tyyppi: "valmis", versio: 2, viiva: viiva("b") });
    expect(kasitteleViesti(tila, { tyyppi: "poista", versio: 3, id: "b" }).piirra).toBe("kaikki");
    expect(tila.viivat.map((v) => v.id)).toEqual(["a"]);
    kasitteleViesti(tila, { tyyppi: "valmis", versio: 4, viiva: viiva("b") });
    expect(tila.viivat.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("tyhjennys vaihtaa myös kuvasuhteen", () => {
    const tila = tyhjaLava();
    kasitteleViesti(tila, { tyyppi: "alku", viiva: viiva("k") });
    kasitteleViesti(tila, { tyyppi: "valmis", versio: 1, viiva: viiva("a") });
    kasitteleViesti(tila, { tyyppi: "tyhjenna", versio: 2, suhde: 3.5 });
    expect(tila.viivat).toEqual([]);
    expect(tila.kesken.size).toBe(0);
    expect(tila.suhde).toBe(3.5);
  });

  it("pyytää synkronointia, kun välistä puuttuu versioita", () => {
    const tila = tyhjaLava();
    kasitteleViesti(tila, { tyyppi: "valmis", versio: 1, viiva: viiva("a") });
    expect(kasitteleViesti(tila, { tyyppi: "valmis", versio: 3, viiva: viiva("c") }).synkkaa).toBe(true);
    expect(tila.viivat.map((v) => v.id)).toEqual(["a", "c"]);
  });

  it("ohittaa vanhentuneet muutokset, jotka tallennettu tila jo sisältää", () => {
    const tila = tyhjaLava();
    yhdistaTallennettu(tila, { tunnus: "lava-1", viivat: [viiva("a"), viiva("b")], suhde: 1.5, versio: 5, nakyvissa: true });
    // Myöhässä tullut poisto (versio 4) ei saa poistaa jo palautettua viivaa b.
    expect(kasitteleViesti(tila, { tyyppi: "poista", versio: 4, id: "b" }).piirra).toBe("ei");
    expect(tila.viivat.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("myöhässä tullut valmis siivoaa keskeneräisen kopion", () => {
    const tila = tyhjaLava();
    kasitteleViesti(tila, { tyyppi: "alku", viiva: viiva("a") });
    yhdistaTallennettu(tila, { tunnus: "lava-1", viivat: [], suhde: 1.5, versio: 2, nakyvissa: true });
    expect(kasitteleViesti(tila, { tyyppi: "valmis", versio: 1, viiva: viiva("a") }).piirra).toBe("kesken");
    expect(tila.kesken.size).toBe(0);
    expect(tila.viivat).toEqual([]);
  });

  it("synkkaa-viesti pyytää hakua vain, jos tila on vanhempi", () => {
    const tila = tyhjaLava();
    tila.versio = 4;
    expect(kasitteleViesti(tila, { tyyppi: "synkkaa", versio: 4 }).synkkaa).toBe(false);
    expect(kasitteleViesti(tila, { tyyppi: "synkkaa", versio: 6 }).synkkaa).toBe(true);
  });

  it("piilottaa ja näyttää alustan", () => {
    const tila = tyhjaLava();
    expect(kasitteleViesti(tila, { tyyppi: "nakyvyys", versio: 1, nakyvissa: false }).piirra).toBe("nakyvyys");
    expect(tila.nakyvissa).toBe(false);
  });
});

describe("yhdistaTallennettu", () => {
  it("ei korvaa tuoreempaa tilaa vanhemmalla", () => {
    const tila = tyhjaLava();
    tila.versio = 7;
    expect(yhdistaTallennettu(tila, { tunnus: "lava-1", viivat: [viiva("a")], suhde: 2, versio: 6, nakyvissa: true })).toBe(false);
    expect(tila.viivat).toEqual([]);
  });

  it("rajaa virheellisen kuvasuhteen", () => {
    const tila = tyhjaLava();
    yhdistaTallennettu(tila, { tunnus: "lava-1", viivat: [], suhde: 100, versio: 1, nakyvissa: false });
    expect(tila.suhde).toBe(8);
    expect(tila.nakyvissa).toBe(false);
  });
});

describe("lueSuhde", () => {
  it("tulkitsee eri muodot", () => {
    expect(lueSuhde("16:9")).toBeCloseTo(16 / 9);
    expect(lueSuhde("4032x1152")).toBeCloseTo(3.5);
    expect(lueSuhde("3.5")).toBe(3.5);
  });

  it("hylkää virheelliset", () => {
    expect(lueSuhde(undefined)).toBeNull();
    expect(lueSuhde("leveä")).toBeNull();
    expect(lueSuhde("100:1")).toBeNull();
    expect(lueSuhde("0:9")).toBeNull();
  });
});

describe("sovitaSuhteeseen", () => {
  it("sovittaa leveän alustan kapeampaan tilaan", () => {
    expect(sovitaSuhteeseen(1180, 820, 3.5)).toEqual({ leveys: 1180, korkeus: 1180 / 3.5 });
  });

  it("sovittaa kapean alustan leveään tilaan", () => {
    expect(sovitaSuhteeseen(4032, 1152, 16 / 9)).toEqual({ leveys: 1152 * (16 / 9), korkeus: 1152 });
  });
});

describe("eriSuhde", () => {
  it("sallii pyöristyserot mutta huomaa eri kuvasuhteen", () => {
    expect(eriSuhde(1920 / 1080, 1280 / 720)).toBe(false);
    expect(eriSuhde(1920 / 1080, 1920 / 1082)).toBe(false);
    expect(eriSuhde(16 / 9, 4 / 3)).toBe(true);
  });
});

describe("KEYNOTE_MUSTEET", () => {
  it("sisältää tummat sävyt, mutta musta ei ole kumin väri", () => {
    const varit = KEYNOTE_MUSTEET.map((m) => m.hex);
    expect(varit).toContain("#111111");
    expect(varit).not.toContain(KUMIN_VARI);
    expect(new Set(varit).size).toBe(varit.length);
  });
});
