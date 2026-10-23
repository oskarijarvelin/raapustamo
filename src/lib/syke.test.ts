import { describe, expect, it } from "vitest";
import { ikaTekstina, sykkeenTila } from "./syke";

const NYT = Date.UTC(2026, 10, 17, 18, 0, 0);
const sitten = (s: number) => new Date(NYT - s * 1000).toISOString();

describe("sykkeenTila", () => {
  it("on ok tuoreella sykkeellä", () => {
    expect(sykkeenTila({ viimeksi_nahty: sitten(20), tiedot: { verkossa: true } }, NYT)).toBe("ok");
  });

  it("varoittaa myöhästyneestä sykkeestä, katkenneesta verkosta ja virheistä", () => {
    expect(sykkeenTila({ viimeksi_nahty: sitten(90), tiedot: {} }, NYT)).toBe("viive");
    expect(sykkeenTila({ viimeksi_nahty: sitten(5), tiedot: { verkossa: false } }, NYT)).toBe("viive");
    expect(sykkeenTila({ viimeksi_nahty: sitten(5), tiedot: { virheita_min: 2 } }, NYT)).toBe("viive");
    expect(sykkeenTila({ viimeksi_nahty: sitten(5), tiedot: { silta: { yhteys: false, nakyvissa: false } } }, NYT)).toBe("viive");
    expect(sykkeenTila({ viimeksi_nahty: sitten(5), tiedot: { silta: { yhteys: true, nakyvissa: false } } }, NYT)).toBe("ok");
    expect(sykkeenTila({ viimeksi_nahty: sitten(5), tiedot: { kanava: false } }, NYT)).toBe("viive");
    expect(sykkeenTila({ viimeksi_nahty: sitten(5), tiedot: { kanava: true } }, NYT)).toBe("ok");
  });

  it("merkitsee näytön poissaolevaksi kolmen minuutin jälkeen", () => {
    expect(sykkeenTila({ viimeksi_nahty: sitten(200), tiedot: {} }, NYT)).toBe("poissa");
  });
});

describe("ikaTekstina", () => {
  it("muotoilee sekunnit, minuutit ja tunnit", () => {
    expect(ikaTekstina(sitten(12), NYT)).toBe("12 s");
    expect(ikaTekstina(sitten(185), NYT)).toBe("3 min");
    expect(ikaTekstina(sitten(7300), NYT)).toBe("2 h");
  });
});
