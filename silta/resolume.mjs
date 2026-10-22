// Resolume-sillan logiikka: onko Raapustamo-klippi screenillä?
// Ei riippuvuuksia, jotta silta käynnistyy playout-koneella pelkällä Nodella.

/**
 * Resolumen klipin yhteystilat. REST-rajapinta palauttaa tekstinä, OSC numerona samassa järjestyksessä:
 * 0 Empty, 1 Disconnected, 2 Previewing, 3 Connected, 4 Connected & previewing.
 * Varmistetaan screen-testissä oikealla Resolumella.
 */
const KYTKETYT_TEKSTIT = new Set(["connected", "connected & previewing"]);

export function onKytketty(arvo) {
  if (typeof arvo === "number") return arvo >= 3;
  if (typeof arvo === "boolean") return arvo;
  if (typeof arvo === "string") return KYTKETYT_TEKSTIT.has(arvo.trim().toLowerCase());
  return false;
}

const parametri = (p) => (p && typeof p === "object" && "value" in p ? p.value : p);

/**
 * Etsii REST-rajapinnan komposiitiosta (GET /api/v1/composition) klipit, joiden nimessä on `nimi`.
 * Huom. Resolume palauttaa vain aktiivisen deckin klipit.
 */
export function etsiKlipit(komposiitio, nimi) {
  const haku = nimi.trim().toLowerCase();
  const tulos = [];
  (komposiitio?.layers ?? []).forEach((kerros, k) => {
    const kerrosOhitettu = parametri(kerros?.bypassed) === true;
    (kerros?.clips ?? []).forEach((klippi, c) => {
      const klipinNimi = String(parametri(klippi?.name) ?? "");
      if (!klipinNimi.toLowerCase().includes(haku)) return;
      tulos.push({
        kerros: k + 1,
        sarake: c + 1,
        nimi: klipinNimi,
        kytketty: onKytketty(parametri(klippi?.connected)),
        kerrosOhitettu,
      });
    });
  });
  return tulos;
}

/** Klippi näkyy, kun se on kytketty eikä sen kerros ole ohitettu (bypass). */
export const onNakyvissa = (klipit) => klipit.some((k) => k.kytketty && !k.kerrosOhitettu);

// --- OSC ---

function lueMerkkijono(puskuri, kohta) {
  const loppu = puskuri.indexOf(0, kohta);
  if (loppu < 0) throw new Error("OSC: merkkijono ei pääty");
  const teksti = puskuri.toString("utf8", kohta, loppu);
  return [teksti, kohta + Math.ceil((loppu - kohta + 1) / 4) * 4];
}

function lueViesti(puskuri) {
  let [osoite, kohta] = lueMerkkijono(puskuri, 0);
  if (kohta >= puskuri.length) return { osoite, argumentit: [] };
  let tyypit;
  [tyypit, kohta] = lueMerkkijono(puskuri, kohta);
  const argumentit = [];
  for (const tyyppi of tyypit.slice(1)) {
    if (tyyppi === "i") {
      argumentit.push(puskuri.readInt32BE(kohta));
      kohta += 4;
    } else if (tyyppi === "f") {
      argumentit.push(puskuri.readFloatBE(kohta));
      kohta += 4;
    } else if (tyyppi === "s") {
      let teksti;
      [teksti, kohta] = lueMerkkijono(puskuri, kohta);
      argumentit.push(teksti);
    } else if (tyyppi === "T") argumentit.push(true);
    else if (tyyppi === "F") argumentit.push(false);
    else if (tyyppi === "N" || tyyppi === "I") argumentit.push(null);
    else break; // Tuntematon tyyppi: loput argumentit ohitetaan.
  }
  return { osoite, argumentit };
}

/** Purkaa OSC-paketin viesteiksi (myös #bundle-niput). */
export function lueOsc(puskuri) {
  if (puskuri.toString("utf8", 0, 8) === "#bundle\0") {
    const viestit = [];
    let kohta = 16; // "#bundle\0" + 8 tavun aikaleima
    while (kohta + 4 <= puskuri.length) {
      const koko = puskuri.readInt32BE(kohta);
      viestit.push(...lueOsc(puskuri.subarray(kohta + 4, kohta + 4 + koko)));
      kohta += 4 + koko;
    }
    return viestit;
  }
  return [lueViesti(puskuri)];
}

/** OSC-osoitteen vertailu, `*` vastaa yhtä osoitteen osaa (esim. /composition/layers/*\/clips/4/connected). */
export function osoiteTasmaa(kuvio, osoite) {
  const k = kuvio.split("/");
  const o = osoite.split("/");
  return k.length === o.length && k.every((osa, i) => osa === "*" || osa === o[i]);
}
