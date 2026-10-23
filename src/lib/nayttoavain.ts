// Näytön avain sykettä varten (migraatio 0005). Avain tulee asennusosoitteesta
// (`?avain=…`, ks. npm run nayttoavain), tallentuu laitteelle ja poistuu osoiteriviltä,
// joten myöhemmät uudelleenlataukset toimivat ilman sitä. Vain selaimessa.

const tallennusavain = (tunnus: string) => `raapustamo:nayttoavain:${tunnus}`;

/** Lukee näytön avaimen osoitteesta tai laitteelta. null = näyttöä ei ole asennettu avaimella. */
export function lueNayttoavain(tunnus: string): string | null {
  const url = new URL(window.location.href);
  const urlAvain = url.searchParams.get("avain");
  if (urlAvain) {
    url.searchParams.delete("avain");
    history.replaceState(null, "", url);
  }
  try {
    if (urlAvain) localStorage.setItem(tallennusavain(tunnus), urlAvain);
    return urlAvain ?? localStorage.getItem(tallennusavain(tunnus));
  } catch {
    return urlAvain;
  }
}
