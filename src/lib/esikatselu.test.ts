import { describe, expect, it } from "vitest";
import { piirrosPng, piirrosSvg } from "./esikatselu";
import { HYMIO } from "./testipiirrokset";

describe("piirrosSvg", () => {
  it("piirtää viivat järjestyksessä mustalle taustalle ja kumin mustana", () => {
    const svg = piirrosSvg(HYMIO, 768);
    expect(svg).toContain('viewBox="0 0 768 768"');
    expect(svg).toContain('<rect width="768" height="768" fill="#000000"/>');
    const varit = [...svg.matchAll(/<path d="[^"]+" fill="(#[0-9A-F]{6})"\/>/g)].map((m) => m[1]);
    expect(varit).toEqual(["#F47226", "#3F86D1", "#3F86D1", "#F54653", "#000000"]);
  });

  it("ei päästä selaimen dataa SVG:hen muuten kuin numeroina ja paletin väreinä", () => {
    // Validointi hylkää vieraat värit jo API:ssa, mutta polkuun päätyy joka tapauksessa vain numeroita.
    const svg = piirrosSvg(HYMIO, 512);
    for (const m of svg.matchAll(/ d="([^"]+)"/g)) expect(m[1]).toMatch(/^[MQTZ0-9., -]+$/);
  });
});

describe("piirrosPng", () => {
  it("tuottaa pyydetyn kokoisen PNG-kuvan", () => {
    const png = piirrosPng(HYMIO, 768);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.readUInt32BE(16)).toBe(768); // IHDR: leveys
    expect(png.readUInt32BE(20)).toBe(768); // IHDR: korkeus
  });
});
