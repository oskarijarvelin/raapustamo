# Keynote-laitetesti

> Päivä: la 24.10.2026 · Paikka: ________ · Testaajat: ________
> Versio: tarkista Vercelistä, että tuotannossa on vähintään `c981cb1`.

Tavoite: varmistaa, että keynote-editori, -näyttö ja videotausta toimivat oikeilla laitteilla ja oikeassa verkossa
ennen kuin niitä käytetään lavalla. Kirjaa jokaisesta kohdasta tulos ja havainnot. ✗-kohdat siirretään korjattaviksi.

## Tarvikkeet

- [ ] iPad (USB-C, iPadOS 17 tai uudempi), Apple Pencil, laturi
- [ ] Läppäri lähettimeksi (Chrome), laturi
- [ ] Toinen kone tai näyttö keynote-näytölle (Chrome), mieluiten myös OBS alfakanavan testiin
- [ ] HDMI-lähde (esim. kolmas läppäri tai esityskone) ja HDMI–USB-kaappauskortti
- [ ] Oma Wi-Fi-reititin (jos saatavilla), Ethernet-kaapeli lähettimelle
- [ ] Puhelin, jolla voi kuvata hidastettua videota ja kahden ruudun kelloja samaan kuvaan

## 0. Valmistelu (ennen testiä)

- [ ] Esiintyjätunnus luotu ja lisätty `esiintyjat`-tauluun (README → Keynote), tai käytössä moderaattoritunnus
- [ ] `npm run keynote-tarkistus` koneella, jolla on `.env.local`: kaikki ✓
  - Kirjautumaton näyttö voi kuunnella yksityistä kanavaa
  - Kirjautumattoman viestit eivät päädy näytölle
  - Kirjautumaton ei pääse videokanavalle
  - (migraation 0005 jälkeen) näyttö voi kuunnella `naytto`-kanavaa, eivätkä kirjautumattoman komennot tavoita sitä
- [ ] Jos migraatio 0005 on ajettu ja uusi versio julkaistu: rekisteröi testinäyttö
      `npm run nayttoavain -- --osoite https://www.raapustamo.fi keynote-testi`, aja SQL ja avaa näyttö tulostetulla
      osoitteella (lisää `&tila=1`). Ilman avainta syke ei näy, mutta kaikki muu toimii.
- [ ] Moderointi auki toisessa ikkunassa, jotta näyttöjen syke näkyy yläpalkissa

## 1. Editori ja näyttö ilman videota

Osoitteet: iPadilla `https://www.raapustamo.fi/keynote?lava=testi`, näyttökoneella
`https://www.raapustamo.fi/keynote/naytto?lava=testi&tila=1`.

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 1.1 | Kirjautuminen iPadilla | Editori aukeaa, alakulmassa "Näytöllä" ja punainen piste | |
| 1.2 | Lisää Koti-valikkoon ja avaa sieltä | Aukeaa koko ruudulle ilman Safarin palkkeja, kirjautuminen säilyy | |
| 1.3 | Piirrä kynällä | Viiva näkyy näytöllä jo vedon aikana. Arvioi viive (hidastettu video): ____ ms | |
| 1.4 | Paine | Sivellin ohenee ja paksunee painon mukaan myös näytöllä | |
| 1.5 | Kämmenen hylkäys | Kun kynää on käytetty, kämmen tai sormi ei piirrä | |
| 1.6 | Kaikki siveltimet, koot ja värit | Näkyvät näytöllä samoin kuin iPadilla. Tummat värit eivät näy mustalla pohjalla (odotettua) | |
| 1.7 | Kumi | Pyyhkii jo vedon aikana iPadilla ja näytöllä | |
| 1.8 | Kumoa, tee uudelleen, tyhjennä (2 napautusta), kumoa tyhjennys | Näyttö seuraa kaikkia. Tyhjennyksen kumoaminen palauttaa kaiken | |
| 1.9 | Silmä-nappi | Näyttö häivyttää piirroksen pois, iPadin reunat oranssit. Takaisin näkyviin toimii | |
| 1.10 | iPadin kääntö tyhjällä alustalla | Alusta seuraa asentoa. Kun piirretty, kuvasuhde pysyy | |
| 1.11 | Lataa näyttö uudelleen kesken piirroksen | Piirros palautuu muutamassa sekunnissa | |
| 1.12 | Sulje ja avaa editori | Piirros palautuu, piirtämistä voi jatkaa | |
| 1.13 | Verkkokatko: iPad lentotilaan 10 s, piirrä, verkko takaisin | Alakulmassa "Ei yhteyttä". Palattua näyttö saa katkon aikana piirretyt viivat | |
| 1.14 | Syke | Editorissa "Näyttö ok", moderoinnissa KEYNOTE-TESTI sininen | |
| 1.15 | Näppäimistö (jos on) | ⌘Z kumoaa, ⇧⌘Z tekee uudelleen | |

## 2. Videotausta testikuvalla

Lähetin: `https://www.raapustamo.fi/keynote/lahetin?lava=testi` → Lähde: Testikuva → Aloita lähetys.
iPad: `https://www.raapustamo.fi/keynote?lava=testi&video=1`.

**Pidä lähettimen välilehti edessä.** Chrome hidastaa taustavälilehden testikuvan noin kehykseen sekunnissa.
Kaappauskortilla tätä ongelmaa ei ole.

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 2.1 | Yhdistäminen | iPadilla "Video ok" alle 5 sekunnissa, lähettimen listalla iPad "Yhdistetty" | |
| 2.2 | Viive | Kuvaa lähettimen ja iPadin kellot samaan kuvaan, laske ero: ____ ms (tavoite alle 200 ms) | |
| 2.3 | Bittinopeus ja viive lähettimessä | ____ Mbit/s · ____ ms | |
| 2.4 | Kuvasuhde | Tyhjä alusta on 16:9 ja sama kuin video (ei varoitusta) | |
| 2.5 | Kohdistus | Piirrä keskiristin ja reunat iPadilla. Näytöllä ne osuvat samaan kohtaan (ks. kohta 6) | |
| 2.6 | Tekstin terävyys | Testikuvan otsikko on terävä iPadilla | |
| 2.7 | Lopeta ja aloita lähetys | iPadilla "Video: odottaa lähetintä", sitten "Video ok" uudelleen | |
| 2.8 | Lataa iPadin editori uudelleen | Video palaa. Lähettimen listalla vain yksi iPad (vanha poistuu) | |
| 2.9 | Lähettimen Wi-Fi pois 10 s | iPad: "Video katkesi", palaa itsestään yhteyden palattua | |
| 2.10 | Kaksi iPadia (jos on) | Molemmat saavat videon | |

## 3. Kaappauskortti

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 3.1 | Kortti listalla | "Näytä laitteiden nimet" → kortti näkyy omalla nimellään | |
| 3.2 | Kuvan tiedot | Esikatselussa 1920 × 1080 · 30 fps (tai lähteen mukainen) | |
| 3.3 | Dia ja video kortin kautta | Teksti luettava iPadilla, ei mustia reunoja (overscan pois lähteestä) | |
| 3.4 | Viive kortin kanssa | ____ ms (kello lähteen ruudulla ja iPad samaan kuvaan) | |
| 3.5 | Kortin irrotus ja kiinnitys | Lähetys katkeaa, uudelleen aloitus toimii | |

## 4. Ruudunjako

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 4.1 | Lähde: Jaa ruutu tai ikkuna → esityskoneen koko ruutu | Kuva iPadille | |
| 4.2 | Esitysohjelma (Keynote/PowerPoint) koko ruudun tilassa | Jaettu ruutu näyttää dian, ei esittäjänäkymää | |
| 4.3 | Lopeta jako selaimen palkista | Lähetys loppuu siististi | |

## 5. Verkko

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 5.1 | Paikan Wi-Fi (sama verkko kuin festivaalilla, jos mahdollista) | Video yhdistyy. Jos jää tilaan "Video: yhdistetään…", verkossa on laitteiden välinen eristys | |
| 5.2 | Oma reititin, lähetin kaapelilla | Video yhdistyy, viive ____ ms | |
| 5.3 | iPad 15 m päässä reitittimestä / seinän takana | Kuva ja piirto pysyvät sujuvina | |
| 5.4 | Mobiilidata iPadille (jos Wi-Fi ei toimi) | Piirto toimii, video ei (odotettua ilman TURN-palvelinta) | |

## 6. Läpinäkyvä näyttö (Resolume-valmistelu OBS:llä)

1. OBS: kohtaus, alimmaksi kuva diasta (valkoinen tausta), päälle **Browser Source**:
   `https://www.raapustamo.fi/keynote/naytto?lava=testi&lapinakyva=1`, leveys 1920, korkeus 1080.

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 6.1 | Läpinäkyvyys | Dia näkyy läpi, vain viivat päällä | |
| 6.2 | Tummat värit vaalealla dialla | Musta, yönsininen ja metsänvihreä erottuvat | |
| 6.3 | Neon vaalealla dialla | Hehku näyttää hyvältä (vai rumalta?) | |
| 6.4 | Kumi | Pyyhkii vedon aikana, ei mustaa jälkeä | |
| 6.5 | Kohdistus | iPadilla videon päälle piirretty ympyrä osuu OBS:ssä samaan kohtaan diaa | |
| 6.6 | OBS → Spout/Syphon/NDI | Alfa säilyy vastaanottimessa (testataan tiistaina Resolumessa) | |

## 7. Kesto ja laitteet

| # | Testi | Odotettu tulos | Tulos |
|---|---|---|---|
| 7.1 | 30 minuutin jatkuva käyttö videon kanssa | Ei hidastumista. iPadin akku: ____ % → ____ % | |
| 7.2 | iPadin lämpeneminen | Ei kuumene haitallisesti | |
| 7.3 | Automaattinen lukitus | Pois päältä tai riittävän pitkä (Asetukset → Näyttö ja kirkkaus) | |
| 7.4 | Lähetinkone ei mene lepoon | Näyttö pysyy päällä lähetyksen ajan | |

## Havainnot ja korjattavat

| Havainto | Vakavuus | Korjaus / päätös |
|---|---|---|
| | | |

## Päätökset testin jälkeen

- [ ] Tarvitaanko lavalle oma reititin vai riittääkö paikan verkko?
- [ ] Tarvitaanko TURN-palvelin?
- [ ] Kaappauskortti vai ruudunjako?
- [ ] Viivakoot (ohut / keskikokoinen / paksu) sopivia?
