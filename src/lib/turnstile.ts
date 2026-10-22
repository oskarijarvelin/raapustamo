// Cloudflare Turnstile -tunnisteen tarkistus palvelimella (siteverify).
// Tunniste on kertakäyttöinen: sama tunniste hylätään toisella kerralla.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Piirtonäkymän widgetin action. Siteverify palauttaa sen, ja se tarkistetaan. */
export const TURNSTILE_ACTION = "piirros";

export interface TurnstileAsetukset {
  salaisuus: string;
  /** Sallitut piirtonäkymän hostnimet (TURNSTILE_HOSTNAMES). Tuotannossa ei localhostia. */
  hostnimet: Set<string>;
  /** Tuotannossa Cloudflaren testiavainten tuloksia ei hyväksytä. */
  tuotanto: boolean;
  ip?: string;
  haku?: typeof fetch;
}

export type TurnstileTulos = { ok: true } | { ok: false; syy: string };

export const hostnimet = (arvo: string | undefined) =>
  new Set(
    (arvo ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  );

interface SiteverifyVastaus {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
  metadata?: { result_with_testing_key?: boolean };
}

export async function tarkistaTurnstile(tunniste: unknown, asetukset: TurnstileAsetukset): Promise<TurnstileTulos> {
  if (typeof tunniste !== "string" || tunniste.length === 0 || tunniste.length > 2048) return { ok: false, syy: "tunniste puuttuu" };
  if (asetukset.hostnimet.size === 0) return { ok: false, syy: "TURNSTILE_HOSTNAMES puuttuu" };

  let tulos: SiteverifyVastaus;
  try {
    const vastaus = await (asetukset.haku ?? fetch)(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: asetukset.salaisuus,
        response: tunniste,
        ...(asetukset.ip ? { remoteip: asetukset.ip } : {}),
      }),
    });
    if (!vastaus.ok) return { ok: false, syy: `siteverify ${vastaus.status}` };
    tulos = await vastaus.json();
  } catch (virhe) {
    // Verkkovirhe, aikakatkaisu tai rikkinäinen vastaus: lähetystä ei päästetä läpi.
    return { ok: false, syy: `siteverify ei vastannut: ${virhe instanceof Error ? virhe.message : virhe}` };
  }

  if (tulos.success !== true) return { ok: false, syy: `hylätty: ${(tulos["error-codes"] ?? []).join(", ") || "ei syytä"}` };
  if (!tulos.hostname || !asetukset.hostnimet.has(tulos.hostname)) return { ok: false, syy: `väärä hostname: ${tulos.hostname}` };

  // Cloudflaren testiavaimet (1x0000…) hyväksyvät kaiken eivätkä palauta actionia.
  // Kehityksessä ne kelpaavat, tuotannossa testiavain on aina konfiguraatiovirhe.
  if (tulos.metadata?.result_with_testing_key) {
    return asetukset.tuotanto ? { ok: false, syy: "testiavain tuotannossa" } : { ok: true };
  }
  if (tulos.action !== TURNSTILE_ACTION) return { ok: false, syy: `väärä action: ${tulos.action}` };
  return { ok: true };
}
