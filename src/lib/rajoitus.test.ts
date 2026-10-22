import { describe, expect, it } from "vitest";
import { laitetunniste, odotusaika, RAJAT, rajaLahteelle } from "./rajoitus";

const NYT = Date.UTC(2026, 10, 17, 18, 0, 0);
const sekuntiaSitten = (s: number) => NYT - s * 1000;

describe("odotusaika", () => {
  it("sallii ensimmäisen lähetyksen", () => {
    expect(odotusaika([], RAJAT.mobiili, NYT)).toBe(0);
  });

  it("vaatii vähimmäisvälin", () => {
    expect(odotusaika([sekuntiaSitten(10)], RAJAT.mobiili, NYT)).toBe(20);
    expect(odotusaika([sekuntiaSitten(31)], RAJAT.mobiili, NYT)).toBe(0);
  });

  it("rajoittaa tuntimäärän", () => {
    const aiemmat = Array.from({ length: 10 }, (_, i) => sekuntiaSitten(60 + i * 300));
    expect(odotusaika(aiemmat, RAJAT.mobiili, NYT)).toBe(3600 - (60 + 9 * 300));
  });

  it("antaa kioskille väljemmät rajat", () => {
    expect(rajaLahteelle("ipad-1")).toBe(RAJAT.kioski);
    expect(rajaLahteelle("mobiili")).toBe(RAJAT.mobiili);
    expect(odotusaika([sekuntiaSitten(10)], RAJAT.kioski, NYT)).toBe(0);
  });
});

describe("laitetunniste", () => {
  it("on sama samalle laitteelle ja eri suolalla eri", () => {
    const otsakkeet = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1", "user-agent": "Safari" });
    const a = laitetunniste(otsakkeet, "suola");
    expect(a).toBe(laitetunniste(new Headers({ "x-forwarded-for": "203.0.113.5", "user-agent": "Safari" }), "suola"));
    expect(a).not.toBe(laitetunniste(otsakkeet, "toinen"));
    expect(a).not.toContain("203.0.113.5");
  });
});

describe("kioskin laitetunniste", () => {
  it("ei riipu verkosta eikä selaimesta ja eroaa puhelinten tunnisteista", () => {
    const a = new Headers({ "x-forwarded-for": "203.0.113.5", "user-agent": "Safari" });
    const b = new Headers({ "x-forwarded-for": "198.51.100.7", "user-agent": "Chrome" });
    expect(laitetunniste(a, "suola", "ipad-1")).toBe(laitetunniste(b, "suola", "ipad-1"));
    expect(laitetunniste(a, "suola", "ipad-1")).not.toBe(laitetunniste(a, "suola", "ipad-2"));
    expect(laitetunniste(a, "suola", "ipad-1")).not.toBe(laitetunniste(a, "suola"));
  });
});
