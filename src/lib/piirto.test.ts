import { beforeAll, describe, expect, it } from "vitest";
import { piirraViiva } from "./piirto";
import type { Viiva } from "./tyypit";

// Node-ympäristössä ei ole Path2D:tä. Riittää, että polun SVG-merkkijono talteen.
beforeAll(() => {
  globalThis.Path2D = class {
    constructor(readonly d: string) {}
  } as unknown as typeof Path2D;
});

function piirretytPolut() {
  const polut: string[] = [];
  const ctx = {
    save() {},
    restore() {},
    fill(polku: { d: string }) {
      polut.push(polku.d);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, polut };
}

describe("piirraViiva", () => {
  it("piirtää kasvavan viivan uudelleen joka kerta, kun pisteitä tulee lisää", () => {
    // Piirtonäkymä lisää pisteet samaan viivaobjektiin hiiren ollessa pohjassa.
    const viiva: Viiva = { vari: "#FFFFFF", koko: 0.022, sivellin: "tussi", paine: false, pisteet: [[0.1, 0.5, 0.5, 0]] };
    const { ctx, polut } = piirretytPolut();
    piirraViiva(ctx, viiva, 900);
    for (let i = 1; i <= 10; i++) viiva.pisteet.push([0.1 + i * 0.08, 0.5, 0.5, i * 16]);
    piirraViiva(ctx, viiva, 900);
    expect(polut).toHaveLength(2);
    expect(polut[1]).not.toBe(polut[0]);
  });

  it("käyttää välimuistia, kun valmis viiva piirretään uudelleen samankokoisena", () => {
    const viiva: Viiva = {
      vari: "#FFFFFF",
      koko: 0.022,
      sivellin: "tussi",
      paine: false,
      pisteet: [
        [0.1, 0.1, 0.5, 0],
        [0.5, 0.5, 0.5, 16],
        [0.9, 0.9, 0.5, 32],
      ],
    };
    const { ctx, polut } = piirretytPolut();
    piirraViiva(ctx, viiva, 900);
    piirraViiva(ctx, viiva, 900);
    expect(polut[1]).toBe(polut[0]);
  });
});
