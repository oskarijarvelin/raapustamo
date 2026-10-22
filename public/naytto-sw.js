// Raapustamon näytön Service Worker: näyttö käynnistyy välimuistista myös ilman verkkoa.
// Rekisteröidään vain /naytto-polulle (ks. src/components/naytto/Naytto.tsx).
// Piirrokset tulevat välimuistiin erikseen localStoragen kautta.

const VERSIO = "naytto-v1";
const ESILATAUS = ["/brand/latf-logo-pysty.png", "/brand/latf-logo-vaaka.png", "/brand/latf-merkki-pysty.png"];
const VERKON_AIKARAJA = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSIO)
      .then((valimuisti) => valimuisti.addAll(ESILATAUS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((avaimet) => Promise.all(avaimet.filter((a) => a !== VERSIO).map((a) => caches.delete(a))))
      .then(() => self.clients.claim()),
  );
});

const aikaraja = (ms) => new Promise((_, hylkaa) => setTimeout(() => hylkaa(new Error("aikaraja")), ms));

async function verkkoEnsin(request, avain) {
  const valimuisti = await caches.open(VERSIO);
  try {
    const vastaus = await Promise.race([fetch(request), aikaraja(VERKON_AIKARAJA)]);
    if (vastaus.ok) await valimuisti.put(avain, vastaus.clone());
    return vastaus;
  } catch {
    // Sama URL parametreineen ensin, muuten mikä tahansa tallennettu näyttösivu.
    const osuma = (await valimuisti.match(avain)) ?? (await valimuisti.match("/naytto", { ignoreSearch: true }));
    return osuma ?? Response.error();
  }
}

async function valimuistiEnsin(request) {
  const valimuisti = await caches.open(VERSIO);
  const osuma = await valimuisti.match(request);
  if (osuma) return osuma;
  const vastaus = await fetch(request);
  if (vastaus.ok) await valimuisti.put(request, vastaus.clone());
  return vastaus;
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Supabase ja muut ulkoiset osoitteet suoraan verkkoon.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === "/naytto") {
    e.respondWith(verkkoEnsin(request, url.pathname + url.search));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    // Versioidut tiedostot (JS, CSS, fontit) eivät muutu, joten välimuisti ensin.
    e.respondWith(valimuistiEnsin(request));
  }
});
