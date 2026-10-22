# Resolume-silta

Silta kertoo LED-näytölle, milloin Raapustamo-klippi on screenillä Resolumen mainoskarusellissa.

- **Kun klippi tulee screenille**, piirrokset piirtyvät esiin alusta ja kierros alkaa.
- **Kun klippi on piilossa**, piirrokset eivät vaihdu eikä näyttökertoja kirjata. Mainosten aikana ei siis "kulu" piirroksia, joita kukaan ei näe.

Silta ajetaan **playout-koneella** Resolumen rinnalla. Se on yksi tiedosto, joka ei tarvitse asennuksia, vain [Node.js](https://nodejs.org) 20:n tai uudemman.

```
Resolume ──(REST tai OSC)──▶ silta.mjs :7400 ──(Server-Sent Events)──▶ /naytto?silta=http://localhost:7400
```

## Käynnistys

```bash
node silta/silta.mjs
```

Näytön osoitteeseen lisätään `silta`-parametri, esimerkiksi:

```
https://<raapustamo-osoite>/naytto?tunnus=led-1&silta=http://localhost:7400
```

Sillan tilan näet selaimella osoitteesta <http://localhost:7400>: screenillä, piilossa tai ei yhteyttä. Moderoinnin yläpalkin näyttömerkin lisätiedoissa näkyy myös, onko silta yhteydessä.

## Tunnistustavat

### REST (oletus, suositus)

Silta kysyy Resolumelta puolen sekunnin välein, onko klippi kytketty. Klippi tunnistetaan **nimestä**, joten sen paikka karusellissa voi muuttua.

1. Resolumessa: **Preferences → Webserver → Enable Webserver & REST API** (oletusportti 8080).
2. Nimeä Raapustamo-klippi niin, että nimessä on sana **Raapustamo**.
3. `node silta/silta.mjs` (tai `--klippi "Oma nimi"` ja `--resolume http://127.0.0.1:8080`).

Rajoitukset:
- Resolume palauttaa vain aktiivisen deckin klipit.
- Jos kerros on ohitettu (bypass), klippiä ei lasketa näkyväksi.

### OSC

Resolume lähettää tilamuutokset itse, joten tunnistus on nopeampi. Klippi tunnistetaan sen paikasta (kerros ja sarake).

1. Resolumessa: **Preferences → OSC → OSC Output**, osoite `127.0.0.1` ja portti `7001`.
2. `node silta/silta.mjs --tila osc --osc-osoite /composition/layers/2/clips/4/connected`.
   Tähti vastaa mitä tahansa osaa, esimerkiksi `/composition/layers/2/clips/*/connected`.

### Simulointi (testaus ilman Resolumea)

```bash
node silta/silta.mjs --tila simuloi --simuloi-nakyvissa 30 --simuloi-piilossa 60
```

## Vikatilanteet

- **Silta ei vastaa tai on sammunut**: näyttö toimii kuten ilman siltaa, eli piirrokset kiertävät koko ajan. Selain yhdistää siltaan automaattisesti uudelleen, kun se käynnistyy.
- **Resolumeen ei saada yhteyttä**: silta ilmoittaa näytölle "näkyvissä", jotta kierto ei pysähdy. Konsolissa näkyy varoitus.
- **Klippiä ei löydy**: konsolissa näkyy varoitus. Tarkista klipin nimi ja aktiivinen deck.

## Huomioitavaa playout-koneella

- **Paikallisverkon käyttölupa:** julkiselta https-sivulta yhdistäminen `localhost`-osoitteeseen voi Chromessa vaatia luvan ("Local network access"). Jos selain kysyy lupaa, salli se kerran. Silta lähettää tarvittavat CORS- ja `Access-Control-Allow-Private-Network`-otsakkeet.
  - **Tarkistetaan screen-testissä:** toimiiko tämä myös selaimessa, joka välittää kuvan Resolumelle (SpoutBrowser tai OBS:n browser source).
- **Automaattinen käynnistys:**
  - Windowsissa pikakuvake `node C:\raapustamo\silta\silta.mjs` Käynnistys-kansioon (`shell:startup`).
  - macOSissa LaunchAgent tai Login Items.
- **Resolumen yhteystilojen arvot** (`Connected` / OSC-arvo 3) on päätelty foorumeilta ja Resolumen REST-rajapinnasta. Ne varmistetaan screen-testissä oikealla Resolumen versiolla.
