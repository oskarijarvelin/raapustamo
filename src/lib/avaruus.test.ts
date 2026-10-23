import { describe, expect, it } from "vitest";
import { etene, kappaleenKoko, rajat, uusiKappale, type Alue } from "./avaruus";

const ALUE: Alue = { leveys: 3456, korkeus: 1152 };

/** Toistettava satunnaislukugeneraattori (mulberry32) */
function siemen(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("uusiKappale", () => {
  it("pysyy lavalla koko matkansa ajan", () => {
    for (let i = 0; i < 200; i++) {
      const satunnainen = siemen(i);
      const koko = kappaleenKoko(ALUE.korkeus, i % 7 === 0, satunnainen);
      const k = uusiKappale(ALUE, [], koko, 24, satunnainen);
      const r = rajat(ALUE, koko);
      const kesto = k.matka / Math.hypot(k.vx, k.vy);
      for (const [x, y] of [
        [k.x, k.y],
        [k.x + k.vx * kesto, k.y + k.vy * kesto],
      ]) {
        expect(x).toBeGreaterThanOrEqual(r.x0 - 0.01);
        expect(x).toBeLessThanOrEqual(r.x1 + 0.01);
        expect(y).toBeGreaterThanOrEqual(r.y0 - 0.01);
        expect(y).toBeLessThanOrEqual(r.y1 + 0.01);
      }
    }
  });

  it("valitsee paikan kaukaa muista piirroksista", () => {
    const muut = [
      { x: 600, y: 576, koko: 600 },
      { x: 1700, y: 576, koko: 600 },
    ];
    for (let i = 0; i < 50; i++) {
      const k = uusiKappale(ALUE, muut, 600, 24, siemen(i));
      // Vapaa tila on oikeassa reunassa.
      expect(k.x).toBeGreaterThan(2300);
    }
  });

  it("kulkee matkansa elinajassa", () => {
    const k = uusiKappale(ALUE, [], 500, 20, siemen(3));
    expect(Math.hypot(k.vx, k.vy) * 20).toBeCloseTo(k.matka, 5);
  });

  it("väistää naapuria, joka on ajelehtimassa kohti vapaata tilaa", () => {
    // Naapuri on nyt vasemmalla, mutta liikkuu nopeasti oikealle keskelle.
    const naapuri = { x: 600, y: 576, koko: 600, vx: 100, vy: 0 };
    const keskelle = Array.from({ length: 50 }, (_, i) => uusiKappale(ALUE, [naapuri], 600, 24, siemen(i))).filter(
      (k) => Math.abs(k.x + k.vx * 12 - (naapuri.x + naapuri.vx * 12)) < 600,
    );
    expect(keskelle.length).toBeLessThan(5);
  });
});

describe("etene", () => {
  it("liikuttaa ja kertoo, kun matka on kuljettu", () => {
    const k = { x: 100, y: 100, koko: 500, vx: 10, vy: 0, kulma: 0, kierto: 0.01, matka: 50, kuljettu: 0 };
    expect(etene(k, 4)).toBe(false);
    expect(k.x).toBe(140);
    expect(k.kulma).toBeCloseTo(0.04);
    expect(etene(k, 1)).toBe(true);
  });
});

describe("kappaleenKoko", () => {
  it("nostetut ovat isompia kuin muut", () => {
    for (let i = 0; i < 100; i++) {
      const tavallinen = kappaleenKoko(1152, false, siemen(i));
      const nostettu = kappaleenKoko(1152, true, siemen(i));
      expect(tavallinen).toBeGreaterThanOrEqual(Math.round(1152 * 0.36));
      expect(tavallinen).toBeLessThanOrEqual(Math.round(1152 * 0.62));
      expect(nostettu).toBeGreaterThan(tavallinen);
    }
  });
});
