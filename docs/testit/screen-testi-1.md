# Screen-testi #1

> Päivä: ti 27.10.2026 · Paikka: ________ · Mukana: ________ (Resolume-operaattori, screenin toimittaja?)
> Versio: tarkista Vercelistä tuotannon commit: ________

Tavoite: ensimmäinen testi oikealla 10,5 × 3 m LED-screenillä Resolumen kautta. Testin jälkeen lukitaan paletti,
minimiviivanleveys ja oletuslayout, ja tiedetään, toimivat kuvaputki ja Resolume-silta.

## Selvitettävät tiedot (kirjaa vastaukset)

| Kysymys | Vastaus |
|---|---|
| Screenin todellinen resoluutio (oletus 4032 × 1152) ja kaappikoko | |
| Ohjausprosessori (esim. Novastar) ja sen skaalaus | |
| Playout-kone: Windows vai macOS, näytönohjain | |
| Resolumen versio ja composition-resoluutio | |
| Resolume-operaattori ja yhteystiedot | |
| Miten karuselli etenee: Autopilot vai operaattori? Slotin pituus ja tiheys? | |
| Verkkoyhteys playout-koneelle (kaapeli / Wi-Fi / mobiili) | |

## Etukäteen (ma 26.10.)

- [ ] Moderointiin vähintään 12 hyväksyttyä testipiirrosta, jotka kattavat kaikki värit, siveltimet (tussi, sivellin,
      neon, kumi) ja koot. Piirrä ne puhelimella tai kioskilla osoitteessa www.raapustamo.fi. Nosta kaksi suosikiksi.
- [ ] Yksi piirros pelkillä ohuilla viivoilla ja yksi pelkällä neonilla
- [ ] Playout-koneelle: Chrome, SpoutBrowser (Windows) tai OBS, Node.js 20+, repo tai pelkkä `silta/`-kansio
- [ ] Resolumessa: **Preferences → Webserver → Enable Webserver & REST API**, klipin nimessä sana "Raapustamo"
- [ ] Moderaattoritunnus ja moderointi auki läppärillä
- [ ] Puhelimet QR-testiin (iPhone ja Android) ja puhelin hidastetun videon kuvaamiseen

## 1. Kuvaputki: selain → Resolume → screen

Näytön osoite playout-koneella (1:1-ulostulo):

```
https://www.raapustamo.fi/naytto?skaala=1&tunnus=led-1&silta=http://localhost:7400
```

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 1.1 | Selainlähde 4032 × 1152 (SpoutBrowser tai OBS:n browser source) | Kuva Resolumessa Spout/Syphon-lähteenä | |
| 1.2 | Pikselit 1:1 | Ei skaalausta missään vaiheessa: 1 px:n viiva näkyy terävänä, ei sumeaa reunaa | |
| 1.3 | Kuvataajuus | Liikkuvat piirrokset sujuvia, ei nykimistä. Selaimen FPS / GPU-kuorma: ____ | |
| 1.4 | Sivupalkki ja QR | QR-koodi ja osoite oikeassa reunassa, eivät leikkaudu | |
| 1.5 | Moderoinnin syke | Yläpalkissa LED-1 sininen, versio oikea | |
| 1.6 | Selaimen käynnistys koneen käynnistyessä | Selainlähde ja silta käynnistyvät itse (tai ohje kirjattu) | |

## 2. Värit ja kirkkaus

Katso screeniä 5, 10 ja 20 metrin päästä. Kirjaa jokaisesta värin näkyvyys (hyvä / heikko / katoaa).

| Väri | Hex | 5 m | 10 m | 20 m | Huomio |
|---|---|---|---|---|---|
| Valkoinen | `#FFFFFF` | | | | Häikäiseekö? |
| Hiekka | `#D6D4CA` | | | | |
| Roosa | `#CE8DA7` | | | | |
| Punainen | `#F54653` | | | | |
| Oranssi | `#F47226` | | | | |
| Sininen | `#4D55DC` | | | | Tummin sävy, katoaako? |
| Vihreä | `#3E9E6A` | | | | Vaalennettu Oulu 2026 -metsänvihreästä |
| Taivas | `#3F86D1` | | | | Vaalennettu Oulu 2026 -yönsinisestä |

- [ ] Screenin kirkkaus: ____ % (sopiva yleisölle, ei häikäise)
- [ ] Musta on mustaa (ledit pois), ei harmaata hehkua
- [ ] Neon: hehku näkyy, ei puuroudu

## 3. Viivanleveydet

Piirrokset renderöidään vähintään 8 px:n viivalla (`minPx: 8`, noin 2 cm screenillä). Koot suhteessa 1152 px:n
piirrokseen: ohut ≈ 12 px, keskikokoinen ≈ 25 px, paksu ≈ 52 px. Seinä-layoutissa piirros on 576 px.

| # | Testi | Tulos |
|---|---|---|
| 3.1 | Ohut viiva trio-layoutissa 10 ja 20 m päästä | |
| 3.2 | Ohut viiva seinä-layoutissa (pienet piirrokset) | |
| 3.3 | Avaruus-layoutin pienimmät (kaukaisimmat) piirrokset | |
| 3.4 | Päätös: minimiviivanleveys ____ px | |

## 4. Layoutit ja ajoitukset

Vaihda osoitteen `layout`-parametria. Katso jokaista vähintään 2 minuuttia.

| Layout | Osoitteen lisä | Arvio (näyttävyys, luettavuus) |
|---|---|---|
| avaruus (oletus) | `&layout=avaruus&maara=6` | |
| avaruus, enemmän piirroksia | `&layout=avaruus&maara=9` | |
| trio | `&layout=trio` | |
| solo | `&layout=solo` | |
| seinä | `&layout=seina` | |

- [ ] Vaihtoväli (`&vaihto=12`): sopiva slotin pituuteen? Päätös: ____ s
- [ ] Piirtymisanimaatio ja glitch: rauhallisia, eivät välky
- [ ] Kameratesti: kuvaa screeniä puhelimella (myös hidastettuna). Näkyykö virkistystaajuus juovina? Välkkyvätkö glitchit?
- [ ] Päätös oletuslayoutista: ____

## 5. QR-koodi

| # | Testi | Tulos |
|---|---|---|
| 5.1 | Skannaus iPhonella 5 / 10 / 20 m päästä | |
| 5.2 | Skannaus Androidilla 5 / 10 / 20 m päästä | |
| 5.3 | Skannauksesta piirtämiseen alle 10 s | |
| 5.4 | Lähetä piirros, hyväksy moderoinnissa: aika screenille ____ s | |

## 6. Resolume-silta

Käynnistä playout-koneella `node silta/silta.mjs`. Tila näkyy osoitteessa <http://localhost:7400>.

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 6.1 | REST: Raapustamo-klippi screenille | Silta: "screenillä", piirrokset piirtyvät esiin alusta | |
| 6.2 | REST: mainosklippi screenille | Silta: "piilossa", piirrokset eivät vaihdu | |
| 6.3 | Paluu Raapustamo-klippiin | Kierros jatkuu, näyttökerrat kirjautuvat (moderoinnin hyväksytyt-välilehti) | |
| 6.4 | Resolumen `Connected`-arvot | Kirjaa REST-vastauksen arvo klipin ollessa päällä: ____ / pois: ____ | |
| 6.5 | OSC-tila (`--tila osc --osc-osoite …`) | Sama kuin REST. OSC-arvo päällä: ____ | |
| 6.6 | Paikallisverkon käyttölupa | Selainlähde (SpoutBrowser/OBS) saa yhteyden `localhost:7400`:aan. Kysyikö lupaa? | |
| 6.7 | Silta sammutetaan | Piirrokset kiertävät jatkuvasti, moderoinnissa "silta ei vastaa" | |
| 6.8 | Kerroksen bypass | Klippiä ei lasketa näkyväksi | |

## 7. Moderointi ja vikatilanteet screenillä

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 7.1 | Hätäpysäytys moderoinnista | Screenillä logo ja QR heti. Viive: ____ s | |
| 7.2 | Paluu tauolta | Paluuanimaatio (glitch, valoviiva, tähdet) näyttää hyvältä screenillä | |
| 7.3 | Hyväksytyn piirroksen piilotus | Katoaa screeniltä heti | |
| 7.4 | Verkko irti playout-koneelta 2 min | Piirrokset jatkavat välimuistista, syke oranssi. Palattua normaali | |
| 7.5 | Selainlähteen uudelleenlataus ilman verkkoa | Näyttö käynnistyy välimuistista (Service Worker) | |

## 8. Keynote screenillä (jos keynote näkyy LED-screenillä)

- [ ] Editori `?suhde=4032x1152` ja näyttö 1:1 screenillä: viivat sopivan paksuja?
- [ ] Läpinäkyvä keynote-näyttö (`?lapinakyva=1`) layerina Resolumessa: alfa säilyy Spoutin/Syphonin/NDI:n läpi?

## 9. Siivous testin jälkeen

- [ ] Testipiirrokset piilotetaan tai hylätään moderoinnissa, jotteivät ne näy festivaalilla
- [ ] Testilavat (`lava=testi`) tyhjennetään keynote-editorista

## Päätökset

| Aihe | Päätös |
|---|---|
| Paletti (muutettavat sävyt) | |
| Minimiviivanleveys | |
| Oletuslayout ja `maara` | |
| Vaihtoväli | |
| Kuvaputki (SpoutBrowser / OBS / Syphon) | |
| Silta: REST vai OSC | |
| Screenin kirkkaus | |

## Havainnot ja korjattavat

| Havainto | Vakavuus | Korjaus / päätös |
|---|---|---|
| | | |
