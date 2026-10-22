import { describe, expect, it, vi } from "vitest";
import { hostnimet, tarkistaTurnstile, TURNSTILE_ACTION, type TurnstileAsetukset } from "./turnstile";

const siteverify = (vastaus: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(vastaus), { status }));

const asetukset = (haku: typeof fetch, muuta: Partial<TurnstileAsetukset> = {}): TurnstileAsetukset => ({
  salaisuus: "salainen",
  hostnimet: hostnimet("raapustamo.fi, www.raapustamo.fi"),
  tuotanto: true,
  ip: "203.0.113.5",
  haku,
  ...muuta,
});

const OK = { success: true, action: TURNSTILE_ACTION, hostname: "raapustamo.fi", "error-codes": [] };

describe("tarkistaTurnstile", () => {
  it("hyväksyy oikean tunnisteen ja lähettää salaisuuden, tunnisteen ja IP:n", async () => {
    const haku = siteverify(OK);
    expect(await tarkistaTurnstile("tunniste", asetukset(haku))).toEqual({ ok: true });
    const [, init] = haku.mock.calls[0];
    const runko = new URLSearchParams(String(init?.body));
    expect(runko.get("secret")).toBe("salainen");
    expect(runko.get("response")).toBe("tunniste");
    expect(runko.get("remoteip")).toBe("203.0.113.5");
  });

  it("hylkää puuttuvan tai liian pitkän tunnisteen kysymättä Cloudflarelta", async () => {
    const haku = siteverify(OK);
    for (const tunniste of [undefined, "", 42, "x".repeat(2049)]) {
      expect((await tarkistaTurnstile(tunniste, asetukset(haku))).ok).toBe(false);
    }
    expect(haku).not.toHaveBeenCalled();
  });

  it("hylkää, jos sallittuja hostnimiä ei ole asetettu", async () => {
    const haku = siteverify(OK);
    expect((await tarkistaTurnstile("t", asetukset(haku, { hostnimet: hostnimet("") }))).ok).toBe(false);
    expect(haku).not.toHaveBeenCalled();
  });

  it("hylkää epäonnistuneen, uudelleenkäytetyn tai väärän tuloksen", async () => {
    const tapaukset = [
      { success: false, "error-codes": ["timeout-or-duplicate"] },
      { ...OK, action: "joku-muu" },
      { ...OK, hostname: "localhost" },
      { ...OK, hostname: undefined },
    ];
    for (const vastaus of tapaukset) {
      expect((await tarkistaTurnstile("t", asetukset(siteverify(vastaus)))).ok).toBe(false);
    }
  });

  it("ei päästä läpi, jos siteverify ei vastaa kunnolla", async () => {
    const kaatuu = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    const rikki = vi.fn<typeof fetch>(async () => new Response("<html>", { status: 200 }));
    expect((await tarkistaTurnstile("t", asetukset(kaatuu))).ok).toBe(false);
    expect((await tarkistaTurnstile("t", asetukset(rikki))).ok).toBe(false);
    expect((await tarkistaTurnstile("t", asetukset(siteverify(OK, 500)))).ok).toBe(false);
  });

  it("hyväksyy Cloudflaren testiavaimet kehityksessä mutta ei tuotannossa", async () => {
    // Testisalaisuus 1x0000… palauttaa tällaisen vastauksen ilman actionia.
    const testi = { success: true, hostname: "example.com", "error-codes": [], metadata: { result_with_testing_key: true } };
    const kehitys = { hostnimet: hostnimet("example.com"), tuotanto: false };
    expect(await tarkistaTurnstile("t", asetukset(siteverify(testi), kehitys))).toEqual({ ok: true });
    expect((await tarkistaTurnstile("t", asetukset(siteverify(testi), { ...kehitys, tuotanto: true }))).ok).toBe(false);
    // Hostname tarkistetaan testiavaimillakin.
    expect((await tarkistaTurnstile("t", asetukset(siteverify(testi), { tuotanto: false }))).ok).toBe(false);
  });
});
