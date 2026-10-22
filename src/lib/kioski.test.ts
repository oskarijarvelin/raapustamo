import { describe, expect, it } from "vitest";
import { kioskiavain as skriptinAvain } from "../../scripts/kioskiavain.mjs";
import { kioskiavain, onKioskiavain } from "./kioski";

describe("kioskiavain", () => {
  it("on kioskikohtainen ja riippuu salaisuudesta", () => {
    const avain = kioskiavain("salaisuus", "ipad-1");
    expect(avain).toHaveLength(22);
    expect(avain).toBe(kioskiavain("salaisuus", "ipad-1"));
    expect(avain).not.toBe(kioskiavain("salaisuus", "ipad-2"));
    expect(avain).not.toBe(kioskiavain("toinen", "ipad-1"));
  });

  it("lasketaan skriptissä samoin kuin palvelimella", () => {
    expect(skriptinAvain("salaisuus", "ipad-7")).toBe(kioskiavain("salaisuus", "ipad-7"));
  });

  it("hyväksyy vain oikean avaimen oikealle kioskille", () => {
    const avain = kioskiavain("salaisuus", "ipad-1");
    expect(onKioskiavain("salaisuus", "ipad-1", avain)).toBe(true);
    expect(onKioskiavain("salaisuus", "ipad-2", avain)).toBe(false);
    expect(onKioskiavain("toinen", "ipad-1", avain)).toBe(false);
    expect(onKioskiavain("salaisuus", "ipad-1", avain.slice(0, 21))).toBe(false);
    expect(onKioskiavain("salaisuus", "ipad-1", "ä".repeat(22))).toBe(false);
    expect(onKioskiavain("salaisuus", "ipad-1", null)).toBe(false);
    expect(onKioskiavain("salaisuus", "mobiili", avain)).toBe(false);
  });
});
