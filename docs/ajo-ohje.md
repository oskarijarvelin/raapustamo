# Ajo-ohje (runbook)

> Runko 23.10.2026. Kohdat, joissa lukee **AVOIN**, täydennetään screen-testin (27.10.) ja avointen kysymysten
> ratkettua. Moderaattoreiden ohje on erikseen: [moderointiohje.md](moderointiohje.md).

## Roolit ja yhteystiedot

| Rooli | Kuka | Puhelin | Vastuu |
|---|---|---|---|
| Raapustamon tekninen vastaava | Oskari Järvelin | | Sovellus, Vercel, Supabase |
| Resolume-operaattori | **AVOIN** | | Karuselli, klipin ohitus hätätilanteessa |
| Moderointivuoron vetäjä | **AVOIN** | | Jono, hätäpysäytys |
| Keynote-tekniikka | **AVOIN** | | iPad, lähetinkone, lavan verkko |
| Tuottaja | **AVOIN** | | Päätökset, viestintä |

## Järjestelmä lyhyesti

| Osa | Osoite / paikka | Huomioita |
|---|---|---|
| Piirtonäkymä | https://www.raapustamo.fi | QR-koodi screenillä ja julisteissa |
| Kioskit | `https://www.raapustamo.fi/?kiosk=ipad-1` | Avain asennetaan kerran (`npm run kioskiavain`) |
| Moderointi | https://www.raapustamo.fi/moderointi | Kirjautuminen, ks. moderointiohje |
| LED-näyttö | playout-kone: `/naytto?skaala=1&tunnus=led-1&silta=http://localhost:7400` | Selainlähde → Spout/Syphon → Resolume |
| Resolume-silta | playout-kone: `node silta/silta.mjs`, tila http://localhost:7400 | Ks. [silta/README.md](../silta/README.md) |
| Keynote-editori | iPad: `/keynote?lava=lava-1&video=1` | Esiintyjätunnus |
| Keynote-näyttö | `/keynote/naytto?lava=lava-1&lapinakyva=1` | Resolumen layer esitysmateriaalin päällä |
| Keynote-lähetin | kaappauskone: `/keynote/lahetin?lava=lava-1` | Kaappauskortti tai ruudunjako |
| Hosting | Vercel (projekti `raapustamo`), Supabase (EU, Irlanti) | Push `main`iin julkaisee tuotantoon |

## Ennen festivaalia (kerran)

- [ ] Ympäristömuuttujat Vercelissä: Supabase, `LAITE_SUOLA`, Turnstile (tuotannon oma widget), `KIOSKI_SALAISUUS`,
      `ANTHROPIC_API_KEY`, tarvittaessa `NEXT_PUBLIC_TURN_*`
- [ ] Moderaattoreiden tunnukset (Supabase → Authentication → Users, sitten `moderaattorit`-tauluun)
- [ ] Esiintyjätunnukset keynote-iPadeille (`esiintyjat`-tauluun)
- [ ] Kioski-iPadit:
  - [ ] Asennusosoite avattu kerran kullakin iPadilla (`npm run kioskiavain -- --osoite https://www.raapustamo.fi ipad-1 ipad-2`)
  - [ ] Guided Access päälle, kotisivu `…/?kiosk=ipad-N`
  - [ ] Automaattinen lukitus pois, ilmoitukset pois, kirkkaus sopiva
  - [ ] Apple Pencil kiinnitetty narulla, varakynät latauksessa
- [ ] Näytöt rekisteröity: `npm run nayttoavain -- --osoite https://www.raapustamo.fi led-1 keynote-lava-1`, SQL ajettu
      ja asennusosoite avattu kerran jokaisen näytön selaimessa (README → Näytöt)
- [ ] Playout-kone: selainlähde ja silta käynnistyvät automaattisesti (**AVOIN**: Windows vai macOS)
- [ ] `npm run keynote-tarkistus`: kaikki ✓
- [ ] Testipiirrokset ja testilavat siivottu
- [ ] Kenraaliharjoitus tehty (vaihe 4)

## Joka päivä ennen ovien avausta

- [ ] Moderointi auki ja kirjauduttu. Yläpalkissa LED-1 sininen (ja keynote-näytöt, jos käytössä)
- [ ] Näyttö "Näyttö live" (ei tauolla)
- [ ] Screenillä Raapustamo-klippi näkyy oikein, QR-koodi skannautuu
- [ ] Silta: http://localhost:7400 näyttää "screenillä" tai "piilossa" Resolumen mukaan, ei "ei yhteyttä"
- [ ] Kioskit: herätä, piirrä ja lähetä testipiirros jokaiselta kioskilta, hylkää se moderoinnissa
- [ ] Apple Pencilit ladattu, varakynät latauksessa
- [ ] Puhelimella QR → piirrä → lähetä toimii
- [ ] Keynote-päivinä: keynote-laitetestin pikaversio (editori, näyttö, video, silmä-nappi)

## Valvonta päivän aikana

- **Moderoinnin yläpalkki:** jokaisen näytön syke
  - sininen = ok
  - oranssi = viive, verkkokatko, virheitä, silta ei vastaa tai keynote-kanava ei auki
  - punainen = näyttö ei vastaa yli 3 minuuttiin
  - Lisätiedot näkyvät merkin päälle vietäessä.
- **Jonon pituus:** jos jono kasvaa yli ____ piirroksen (**AVOIN**), lisää moderaattori vuoroon.
- **Vercel:** Logs (lähetys-API, tekoälyarviot: jokaisesta arviosta rivi). Supabase: Realtime- ja tietokantakäyttö.

## Häiriötilanteet

| Oire | Mitä tehdään heti | Sitten |
|---|---|---|
| **Sopimaton piirros näkyy screenillä** | Moderoinnissa Hyväksytyt → **Piilota heti**, tai **hätäpysäytys** yläpalkista ("Näyttö live · pysäytä"). Resolume-operaattori voi aina ohittaa klipin | Selvitä, miten piirros hyväksyttiin. Kirjaa tapaus |
| Screen musta tai jumissa | Resolume-operaattori ohittaa klipin | Tarkista syke. Lataa selainlähde uudelleen playout-koneella |
| LED-1 punainen moderoinnissa | Tarkista playout-kone: onko selain käynnissä, onko verkko | Näyttö pyörii välimuistista myös ilman verkkoa, mutta ei lähetä sykettä. Jos selaimen tiedot on tyhjennetty, avain puuttuu: avaa asennusosoite uudelleen (konsolissa varoitus "avain puuttuu") |
| LED-1 oranssi, "silta ei vastaa" | Piirrokset kiertävät edelleen (turvallinen tila) | Käynnistä silta uudelleen: `node silta/silta.mjs` |
| Uudet piirrokset eivät tule screenille | Tarkista, että ne on hyväksytty ja että näyttö ei ole tauolla | Data tarkistetaan 20 s välein. Lataa selainlähde uudelleen |
| Kioski: "Kioskia ei ole tunnistettu" | Avaa kioskin asennusosoite uudelleen (tekninen vastaava) | `KIOSKI_SALAISUUS` ei saa muuttua festivaalin aikana |
| Kävijä: "Odota vielä … s ennen seuraavaa piirrosta" | Normaalia: lähetysraja, odota | Kioskeilla oma, väljempi raja |
| Kävijä: "Emme voineet varmistaa, että olet ihminen" | Yritä uudelleen tai lataa sivu | Jos toistuu usein, tarkista Turnstile-widget Cloudflaressa |
| Tekoälyarviot puuttuvat jonosta | Moderointi jatkuu normaalisti ilman arvioita | Tarkista `ANTHROPIC_API_KEY` ja Vercelin lokit |
| Verkkokatko festivaalialueella | Näyttö jatkaa välimuistista. Puhelimet käyttävät mobiilidataa | Kioskit eivät lähetä ennen kuin verkko palaa |
| Keynote: "Ei yhteyttä" iPadilla | Tarkista iPadin Wi-Fi. Piirto jatkuu yhteyden palattua | Näyttö hakee välissä piirretyt viivat |
| Keynote: "Video: yhdistetään…" jää päälle | Puhuja voi piirtää ilman taustaa | Lähettimen kanava auki? Lavan verkko estää laitteiden väliset yhteydet → oma reititin tai TURN |
| Keynote: piirros pitää saada heti pois | Silmä-nappi editorissa (piilota näytöltä) tai Resolume-operaattori ohittaa layerin | |

## Päivän päätteeksi

- [ ] Jono käsitelty tyhjäksi (tai siirretty seuraavalle päivälle)
- [ ] Kioskit lataukseen, Guided Access pysyy päällä
- [ ] Keynote-lavat tyhjennetty tai piilotettu
- [ ] Kirjaa päivän häiriöt ja havainnot

## Festivaalin jälkeen

- [ ] Hätäpysäytys päälle tai Raapustamo-klippi pois karusellista
- [ ] Vienti: hyväksytyt piirrokset PNG + JSON (vaihe 5, **AVOIN**)
- [ ] Hylätyt piirrokset ja laitetiivisteet poistetaan sovitun ajan jälkeen (**AVOIN**)
- [ ] Verkkogallerian julkaisu (vaihe 5)
- [ ] Tilastoraportti ja retrospektiivi
