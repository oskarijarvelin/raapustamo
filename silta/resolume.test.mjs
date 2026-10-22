import { describe, expect, it } from "vitest";
import { etsiKlipit, lueOsc, onKytketty, onNakyvissa, osoiteTasmaa } from "./resolume.mjs";

// --- OSC-pakettien rakennus testejä varten ---
const tasaa = (puskuri) => Buffer.concat([puskuri, Buffer.alloc((4 - (puskuri.length % 4)) % 4 || 0)]);
const merkkijono = (s) => tasaa(Buffer.concat([Buffer.from(s), Buffer.alloc(1)]));
const int32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n);
  return b;
};
const viesti = (osoite, ...argumentit) => {
  const tyypit = "," + argumentit.map((a) => (typeof a === "string" ? "s" : Number.isInteger(a) ? "i" : "f")).join("");
  const data = argumentit.map((a) => {
    if (typeof a === "string") return merkkijono(a);
    if (Number.isInteger(a)) return int32(a);
    const b = Buffer.alloc(4);
    b.writeFloatBE(a);
    return b;
  });
  return Buffer.concat([merkkijono(osoite), merkkijono(tyypit), ...data]);
};
const nippu = (...viestit) =>
  Buffer.concat([merkkijono("#bundle"), Buffer.alloc(8), ...viestit.flatMap((v) => [int32(v.length), v])]);

const komposiitio = (klipit, bypassed = false) => ({
  layers: [
    { bypassed: { value: false }, clips: [{ name: { value: "Mainos 1" }, connected: { value: "Connected" } }] },
    { bypassed: { value: bypassed }, clips: klipit.map(([nimi, connected]) => ({ name: { value: nimi }, connected: { value: connected } })) },
  ],
});

describe("onKytketty", () => {
  it("tunnistaa Resolumen tilat tekstinä ja numerona", () => {
    expect(onKytketty("Connected")).toBe(true);
    expect(onKytketty("Connected & previewing")).toBe(true);
    expect(onKytketty("Previewing")).toBe(false);
    expect(onKytketty("Disconnected")).toBe(false);
    expect(onKytketty(3)).toBe(true);
    expect(onKytketty(4)).toBe(true);
    expect(onKytketty(1)).toBe(false);
    expect(onKytketty(undefined)).toBe(false);
  });
});

describe("etsiKlipit ja onNakyvissa", () => {
  it("löytää klipin nimen perusteella kirjainkoosta riippumatta", () => {
    const klipit = etsiKlipit(komposiitio([["Mainos 2", "Disconnected"], ["RAAPUSTAMO trio", "Connected"]]), "raapustamo");
    expect(klipit).toEqual([{ kerros: 2, sarake: 2, nimi: "RAAPUSTAMO trio", kytketty: true, kerrosOhitettu: false }]);
    expect(onNakyvissa(klipit)).toBe(true);
  });

  it("ei ole näkyvissä, kun klippi on irti tai kerros ohitettu", () => {
    expect(onNakyvissa(etsiKlipit(komposiitio([["Raapustamo", "Disconnected"]]), "Raapustamo"))).toBe(false);
    expect(onNakyvissa(etsiKlipit(komposiitio([["Raapustamo", "Connected"]], true), "Raapustamo"))).toBe(false);
    expect(onNakyvissa(etsiKlipit({}, "Raapustamo"))).toBe(false);
  });
});

describe("lueOsc", () => {
  it("purkaa yksittäisen viestin", () => {
    expect(lueOsc(viesti("/composition/layers/2/clips/4/connected", 3))).toEqual([
      { osoite: "/composition/layers/2/clips/4/connected", argumentit: [3] },
    ]);
  });

  it("purkaa nipun ja eri argumenttityypit", () => {
    const paketti = nippu(viesti("/a", 1), viesti("/b/c", 0.5, "teksti"));
    expect(lueOsc(paketti)).toEqual([
      { osoite: "/a", argumentit: [1] },
      { osoite: "/b/c", argumentit: [0.5, "teksti"] },
    ]);
  });
});

describe("osoiteTasmaa", () => {
  it("tukee tähteä yhden osan paikalla", () => {
    expect(osoiteTasmaa("/composition/layers/*/clips/4/connected", "/composition/layers/2/clips/4/connected")).toBe(true);
    expect(osoiteTasmaa("/composition/layers/2/clips/4/connected", "/composition/layers/2/clips/5/connected")).toBe(false);
    expect(osoiteTasmaa("/composition/layers/2/clips/4/connected", "/composition/layers/2/clips/4/name")).toBe(false);
  });
});
