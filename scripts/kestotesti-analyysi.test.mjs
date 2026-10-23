import { describe, expect, it } from "vitest";
import { analysoi, kulmakerroin } from "./kestotesti-analyysi.mjs";

const rivit = (minuutteja, heap = () => 50, fps = 60) =>
  Array.from({ length: minuutteja + 1 }, (_, i) => ({ kulunutMin: i, heapMb: heap(i), domSolmuja: 400, fps }));

const eiTapahtumia = { latauksia: 0, virheita: 0, kaatumisia: 0 };

describe("kulmakerroin", () => {
  it("laskee suoran kulmakertoimen", () => {
    expect(kulmakerroin([[0, 1], [1, 3], [2, 5]])).toBeCloseTo(2);
    expect(kulmakerroin([[0, 4]])).toBe(0);
  });
});

describe("analysoi", () => {
  it("tasainen muisti ja sujuva kuva: ok", () => {
    const tulos = analysoi(rivit(120, (i) => 50 + Math.sin(i) * 2), eiTapahtumia);
    expect(tulos.ok).toBe(true);
    expect(Math.abs(tulos.kasvuMbH)).toBeLessThan(1);
  });

  it("huomaa vuodon", () => {
    // 0,5 Mt minuutissa = 30 Mt tunnissa
    const tulos = analysoi(rivit(120, (i) => 50 + i * 0.5), eiTapahtumia);
    expect(tulos.ok).toBe(false);
    expect(tulos.kasvuMbH).toBeCloseTo(30);
    expect(tulos.huomiot.join()).toContain("vuoto");
  });

  it("jättää lämpenemisen pois kasvusta", () => {
    // Ensimmäiset 10 min muisti nousee nopeasti, sen jälkeen tasaista.
    const tulos = analysoi(rivit(120, (i) => (i < 10 ? 20 + i * 3 : 50)), eiTapahtumia);
    expect(tulos.ok).toBe(true);
  });

  it("raportoi nykimisen, uudelleenlataukset ja virheet", () => {
    const tulos = analysoi(rivit(60, () => 50, 20), { latauksia: 2, virheita: 3, kaatumisia: 1 });
    expect(tulos.ok).toBe(false);
    expect(tulos.huomiot).toHaveLength(4);
  });

  it("varoittaa liian lyhyestä ajosta", () => {
    expect(analysoi(rivit(5), eiTapahtumia).huomiot[0]).toContain("lyhyt");
  });
});
