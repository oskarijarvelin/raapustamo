# Tietoturvakatselmointi

> 23.10.2026 · Versio `efc8452` (tuotanto www.raapustamo.fi) · Vaihe 4
> Katselmoitu: lähetys-API ja apukirjastot, tekoälyarvio, kioskiavain, Turnstile, migraatiot 0001–0004 (RLS, funktiot,
> Realtime-kanavat), näyttö, moderointi, keynote, Resolume-silta, tuotannon HTTP-otsakkeet ja riippuvuudet (`npm audit`).

## Löydökset

| # | Vakavuus | Löydös | Korjaus | Tila |
|---|---|---|---|---|
| 1 | **Korkea** | Julkinen `naytto`-broadcast-kanava ei tarkista lähettäjää. Anon-avain ja kanavan nimi ovat sivun JavaScriptissä, joten kuka tahansa voi lähettää näytölle `tauko: false` ja **kumota hätäpysäytyksen**, `tauko: true` ja pysäyttää screenin, tai `piilota` ja poistaa piirroksia screeniltä. Näyttö lukee tauon tietokannasta vain käynnistyessään, joten väärennetty tila jää voimaan. | `naytto`-kanava yksityiseksi: kuuntelu kaikille, lähetys vain moderaattoreille (Realtime Authorization, kuten keynotessa). Lisäksi näyttö tarkistaa tauon tietokannasta 20 s välein, jolloin tietokanta on aina lopullinen totuus. | korjattu (migraatio 0005) |
| 2 | Keskisuuri | `naytto_syke`-funktiota voi kutsua kuka tahansa. Väärennetyllä sykkeellä voi **peittää oikean näytön katkon** (LED-1 näyttää sinistä, vaikka screen on jumissa), tai täyttää moderoinnin yläpalkin keksityillä näytöillä (rivejä voi luoda rajattomasti). | Näytöt rekisteröidään etukäteen, ja syke vaatii näyttökohtaisen avaimen (kuten kioskit). Funktio päivittää vain rekisteröityjä rivejä. | korjattu (migraatio 0005, `npm run nayttoavain`) |
| 3 | Keskisuuri | Sivuilla ei ole `frame-ancestors`- eikä `X-Frame-Options`-otsaketta. Moderointisivun voi upottaa vieraalle sivulle ja houkutella kirjautuneen moderaattorin klikkaamaan Hyväksy (clickjacking). | Otsakkeet `next.config.ts`:ään: `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (kamera ja ruudunjako vain omalle sivustolle). | korjattu |
| 4 | Matala | Lähetysrajan laitetunniste on IP + User-Agent. User-Agentia vaihtamalla saa uuden laskurin. Samanaikaiset pyynnöt voivat myös ohittaa 30 s:n välin. Jokainen lähetys vaatii silti uuden Turnstile-tunnisteen, mikä rajoittaa tätä tehokkaasti. | Lisäksi väljä IP-kohtainen raja (esim. 60/h). Festivaalin Wi-Fissä monella kävijällä on sama IP, joten rajan pitää olla väljä. | harkittava |
| 5 | Matala | `merkitse_naytetyksi`-funktiota voi kutsua kuka tahansa. Näyttökertoja kasvattamalla voi vääristää jonon reiluutta ja tilastoja, mutta ei tuoda mitään screenille. | Sama näyttökohtainen avain kuin sykkeessä (#2). | harkittava |

## Korjausten käyttöönotto (järjestys tärkeä)

1. Aja migraatio `0005_tietoturva.sql`. Vanhan version syke lakkaa toimimasta, mutta näyttö ja komennot toimivat yhä.
2. Julkaise uusi versio (push `main`).
3. `npm run nayttoavain -- --osoite https://www.raapustamo.fi led-1 keynote-lava-1` ja aja tulostettu SQL.
4. Avaa jokaisella näytöllä tulostettu asennusosoite kerran (lisää tarvittavat parametrit, esim. `&skaala=1&silta=…`).
   Avain tallentuu laitteelle ja poistuu osoiteriviltä.
5. Lataa moderointi uudelleen. Tarkista, että syke näkyy ja että hätäpysäytys ja paluu toimivat.

## Tarkistettava hallintapaneeleista

Näitä ei voi tarkistaa koodista:

- [ ] **Supabase → Authentication → Sign In / Providers:** "Allow new users to sign up" pois päältä. Itse luodut tunnukset
      eivät saa RLS:n vuoksi mitään oikeuksia, mutta rekisteröitymiselle ei ole tarvetta.
- [ ] **Supabase → Authentication:** vuotaneiden salasanojen esto (leaked password protection) päälle, jos tasolla on.
- [ ] Moderaattoreilla ja keynote-iPadeilla vahvat, yksilölliset salasanat. Keynote-tunnukset poistetaan festivaalin jälkeen.
- [ ] **Vercel:** `TURNSTILE_SECRET` on tuotannon oma widget, ei testiavain. Tuotannossa testiavain hylkää kaikki lähetykset.
      Tarkista lähettämällä oikea piirros.
- [ ] `npm run keynote-tarkistus`: kaikki ✓ (viisi tarkistusta, migraatioiden 0003–0005 jälkeen).

## Hyväksytyt riskit (suunnittelupäätöksiä)

- **Keynote ei kulje moderoinnin kautta.** Esiintyjä- tai moderaattoritunnuksen joutuminen vääriin käsiin = mitä tahansa
  screenille. Lieventävät tekijät: vain kirjautuneet voivat lähettää (tarkistettu RLS:llä), iPad-kohtaiset tunnukset,
  silmä-nappi ja Resolume-operaattorin ohitus.
- **Keynote-piirrokset ja hyväksytyt piirrokset ovat julkisesti luettavissa.** Ne näkyvät screenillä joka tapauksessa.
- **Resolume-silta** vastaa playout-koneella `127.0.0.1:7400`:ssa kaikille alkuperille (CORS `*`), mutta vain
  GET-pyyntöihin. Muut sivustot voisivat lukea vain sen, onko klippi screenillä.

## Kunnossa

- **Lähetys-API:**
  - koko rajattu (400 kt)
  - rakenne, paletti, koot ja pistemäärät tarkistetaan, ja vain tunnetut kentät tallennetaan
  - Turnstile (hostname, action, testiavain tuotannossa estetty) ja kioskiavain tarkistetaan ennen tallennusta
- **Kioskiavain:** HMAC-SHA256 ja vakioaikainen vertailu. Avain poistetaan osoiteriviltä.
- **RLS:**
  - anonyymit näkevät vain hyväksytyt piirrokset
  - päivitysoikeus on sarakekohtainen ja vain moderaattoreille
  - laitetiivisteet eivät ole luettavissa selaimesta
  - service role -avain on vain palvelimella
- **Keynote:**
  - viivakanavalle saavat lähettää vain esiintyjät ja moderaattorit
  - videokanavaa (lähiverkon osoitteet) eivät näe anonyymit
  - lavan tilaa voivat muuttaa vain esiintyjät ja moderaattorit
- **Tekoäly:** ei voi hyväksyä eikä hylätä. Vastaus validoidaan skeemalla, ja piirroksen teksti on ohjeessa pelkkää sisältöä.
- **Ei XSS-kohtia:** ei `dangerouslySetInnerHTML`:ää eikä `innerHTML`:ää, ja React escapoi tekoälyn syyn.
- **Riippuvuudet:** `npm audit --omit=dev` ei löydä haavoittuvuuksia.
- **Muut:**
  - HSTS ja noindex ovat käytössä
  - lähetys-API vastaa tuotannossa virheelliseen pyyntöön 400, eli ympäristömuuttujat on asetettu
