# Raapustamo – kehityssuunnitelma

**Raapustamo** on selainpohjainen vieraskirja Lumo Art & Tech Festivalille. Kävijät piirtävät terveisen, kuvan tai nimikirjoituksen iPadilla tai omalla puhelimellaan, ja moderoidut piirrokset näytetään festivaalin 10,5 m × 3 m LED-screenillä (2,6 mm pikseliväli) osana mainoskarusellia.

> Tila: luonnos · Päivitetty: 2026-10-22

---

## 1. Tavoitteet ja rajaus

**Tavoitteet**
- Piirtäminen alkaa alle 10 sekunnissa QR-koodin skannauksesta: ei sovelluksen asennusta eikä kirjautumista.
- Jokainen hyväksytty piirros näkyy isolla screenillä näyttävästi (piirtymisanimaatio) ja päätyy kierrossa näkyviin vähintään kerran.
- Screenille ei päädy mitään sopimatonta: **kaikki piirrokset moderoidaan ihmisen toimesta ennen näyttämistä.**
- Näyttö jatkaa toimintaansa, vaikka verkkoyhteys katkeaisi.

**MVP:hen ei kuulu** (myöhempiä vaiheita): käyttäjätilit, kommentointi/tykkäykset, kuvien lataus kamerasta, tekoälygenerointi, tulostus paperille.

---

## 2. Käyttäjät ja näkymät

| Näkymä | Reitti | Käyttäjä | Laite |
|---|---|---|---|
| Piirtonäkymä | `/` (tai `/piirra`) | Festivaalikävijä | Oma puhelin (QR) / festivaalin iPad |
| Kioskitila | `/piirra?kiosk=ipad-1` | Festivaalikävijä | iPad telineessä |
| Näyttö | `/naytto` | – (LED-screen) | Playout-PC, Chrome kioskitilassa |
| Moderointi | `/moderointi` | Festivaalin henkilökunta | Puhelin / tabletti / läppäri |
| Hallinta | `/admin` | Tuottaja / tekninen vastaava | Läppäri |

### Käyttäjäpolku (kävijä)
1. Näkee screenillä tai standilla QR-koodin + lyhyen osoitteen (esim. `raapustamo.fi`).
2. Avaa piirtonäkymän → lyhyt ohje ("Piirrä terveiset Lumolle – parhaat päätyvät isolle screenille!").
3. Piirtää: muutama sivellin, kuratoitu väripaletti, kumi, kumoa, tyhjennä.
4. Valinnainen: etunimi / kotipaikka (max ~20 merkkiä, myös moderoidaan).
5. Hyväksyy käyttöehdot (yksi rasti) → **Lähetä**.
6. Kiitosnäkymä: "Piirroksesi on jonossa ja näkyy screenillä moderoinnin jälkeen." + nappi "Piirrä uusi".

---

## 3. LED-screenin tekniset reunaehdot

### Resoluutio
2,6 mm pikseliväli on käytännössä 2,604 mm (500 mm kaappi / 192 px).

- Leveys: 10,5 m → 21 kaappia × 192 px = **4032 px**
- Korkeus: 3,0 m → 6 kaappia × 192 px = **1152 px**
- Kuvasuhde **3,5 : 1**, n. 4,6 megapikseliä

⚠️ **Varmistettava screenin toimittajalta:** kaappikoko, todellinen pikselimäärä, ohjausprosessori (esim. Novastar) ja millä resoluutiolla ja millä mappauksella playout-kone syöttää kuvan (natiivi 4032×1152 custom-resoluutio vai esim. 4K-signaali, josta prosessori leikkaa).

### Layout-ehdotus
Piirrosalusta on **neliö (1:1)**, koska se toimii sekä pystypuhelimessa että vaaka-iPadissa. Screenille mahtuu silloin täydellisesti:

```
|<------------------------------- 4032 px ------------------------------->|
+----------------+----------------+----------------+---------+
|                |                |                |  LOGO   |
|   piirros 1    |   piirros 2    |   piirros 3    |         |  1152 px
|  1152 × 1152   |  1152 × 1152   |  1152 × 1152   |   QR    |
|                |                |                | 576 px  |
+----------------+----------------+----------------+---------+
```

3 × 1152 + 576 = 4032 px. Sivupalkissa Raapustamo-logo, QR-koodi ja kehotus "Piirrä sinäkin!" → screen markkinoi itse itseään.

Vaihtoehtoisia layout-tiloja (valittavissa URL-parametrilla):
- `trio` – 3 piirrosta + sivupalkki (oletus)
- `solo` – yksi piirros suurena keskellä + tekstit (uusille / nostetuille)
- `seina` – 8–12 pientä piirrosta ruudukkona (koosteslotti)

### LED-näytön visuaaliset säännöt
- **Tumma tausta.** Musta = ledit pois päältä → paras kontrasti, pienempi virrankulutus, ei häikäise. Valkoinen täysruutu 30 m²:n LED-screenillä on sokaiseva.
- **Kuratoitu, kirkas väripaletti** (neon/pastelli). Ei tummansinistä, ruskeaa tai tummanharmaata – ne katoavat mustalle taustalle.
- **Piirtonäkymässäkin tumma tausta**, jotta piirtäjä näkee saman kuin screenillä.
- **Minimiviivanleveys** renderöinnissä n. 8 px (≈ 2 cm fyysisesti), jotta ohuet viivat eivät katoa katseluetäisyydeltä.
- Animaatiot pehmeitä ja riittävän hitaita; nopea välkyntä näyttää LED-screenillä ja kameroissa huonolta.
- **Testataan oikealla screenillä mahdollisimman aikaisin** (värit, kirkkaus, viivanleveydet, tekstikoot, näkyykö virkistystaajuus kameroissa).

---

## 4. Integraatio mainoskaruselliin

Tämä on suurin avoin kysymys, ja se ratkaisee näyttönäkymän arkkitehtuurin. Vaihtoehdot:

| Vaihtoehto | Kuvaus | Huomiot |
|---|---|---|
| **A. Karusellisoftan web-slotti** | Karusellisofta (esim. Resolume, Xibo, ViPlex, BrightSign) avaa `/naytto`-URL:n omana slottinaan | Sivun pitää renderöityä heti latauksessa → data välimuistista. Slotin pituus annetaan parametrina. |
| **B. Raapustamo pyörittää koko karusellia** | `/naytto` näyttää myös mainokset (videot/kuvat soittolistasta) | Yksi selain hoitaa kaiken; vastuu mainosten toistosta siirtyy meille. |
| **C. Videokaappaus** | Selain kaapataan (OBS / NDI / HDMI) ja syötetään kuvamikseriin | Joustava, jos tuotannossa on jo mikseri. Lisälaitteita ja vikapisteitä. |

**Suositus:** suunnitellaan näyttö toimimaan vaihtoehdossa A, koska se kattaa myös B:n ja C:n. Näyttönäkymä tukee URL-parametreja:

```
/naytto?layout=trio&kesto=30&vaihto=10&qr=1
```

- `kesto` – slotin kokonaispituus sekunteina (sivu tietää milloin lopettaa / häivyttää)
- `vaihto` – kuinka usein piirrokset vaihtuvat slotin sisällä
- Sivu toimii myös ilman parametreja jatkuvana silmukkana.

### Läpimeno – mitä voidaan luvata kävijälle?
Esimerkki: 30 s slotti joka 3. minuutti, 3 piirrosta / 10 s → 9 piirrosta / slotti → **n. 180 piirrosta tunnissa**. Jos piirroksia tulee enemmän, kaikki eivät ehdi näkyviin heti. Siksi kävijälle **ei luvata tarkkaa aikaa**, ja jonon järjestys painottaa tuoreita mutta takaa kaikille vähintään yhden näyttökerran (ks. kohta 6.3).

---

## 5. Arkkitehtuuri

```
  Puhelin / iPad                Pilvi (EU-alue)                 Festivaalialue
 +---------------+        +--------------------------+       +------------------+
 | Piirtonäkymä  |--POST->|  Web-sovellus (API)      |       | Playout-PC       |
 +---------------+        |  - vastaanotto, validointi|<--WS--| /naytto (Chrome) |
                          |  - rate limit             |       | + paikallinen    |
 +---------------+        +-----------+--------------+       |   välimuisti     |
 | Moderointi    |<--WS-->|  Tietokanta + realtime    |       +------------------+
 +---------------+        |  Tiedostovarasto (PNG)    |
                          +--------------------------+
```

### Teknologiasuositus

| Osa | Valinta | Perustelu |
|---|---|---|
| Frontend + API | **Next.js (TypeScript)**, hostaus **Vercel** (EU-region) | Yksi koodikanta kaikille näkymille, helppo julkaisu, skaalautuu ruuhkassa |
| Tietokanta, realtime, auth, tallennus | **Supabase** (Postgres + Realtime + Auth + Storage), EU-region | Moderointi- ja näyttönäkymät saavat muutokset reaaliajassa ilman omaa WebSocket-palvelinta; moderaattorien kirjautuminen valmiina |
| Piirtäminen | Pointer Events + Canvas 2D + **[perfect-freehand](https://github.com/steveruiz/perfect-freehand)** | Kauniit, painoherkät viivat (Apple Pencil); sama algoritmi piirtäjällä ja screenillä |
| Näytön offline-tuki | Service Worker + IndexedDB | Hyväksytyt piirrokset välimuistiin; silmukka jatkuu verkkokatkosta huolimatta |
| Kioski-iPadit | iPadOS Guided Access + Safari / PWA koko näytöllä | Ei pääsyä muualle laitteella |

Vaihtoehto: kevyt Node.js + SQLite -palvelin festivaalialueen koneella. Toimii ilman nettiä, mutta puhelimet tarvitsevat joka tapauksessa julkisen osoitteen, joten pilvi on yksinkertaisempi. Päätetään vaiheessa 0.

### Piirrosten tallennusmuoto
Piirros tallennetaan **vektorimuodossa** (viivat pisteinä), ei pelkkänä kuvana:
- skaalautuu terävästi 1152 px:n ruutuun riippumatta piirtolaitteen resoluutiosta
- mahdollistaa **piirtymisanimaation** screenillä (viivat piirtyvät uudelleen esiin)
- pieni koko (pisteiden harvennus, esim. Ramer–Douglas–Peucker)

Lisäksi tallennetaan PNG-esikatselu moderointia ja arkistointia varten.

```jsonc
// strokes (koordinaatit normalisoitu 0..1, jolloin laitteen koko ei vaikuta)
{
  "versio": 1,
  "tausta": "#000000",
  "viivat": [
    { "vari": "#FF4FD8", "koko": 0.012, "sivellin": "tussi",
      "pisteet": [[0.21, 0.34, 0.5, 0], [0.22, 0.35, 0.6, 16]] } // x, y, paine, t(ms)
  ]
}
```

### Tietomalli (luonnos)

**`piirrokset`**

| Kenttä | Tyyppi | Kuvaus |
|---|---|---|
| `id` | uuid | |
| `luotu` | timestamptz | |
| `viivat` | jsonb | vektoridata (max ~200 kt) |
| `esikatselu_url` | text | PNG Storage-palvelussa |
| `nimi` | text, null | valinnainen etunimi / paikkakunta |
| `lahde` | text | `mobiili` / `ipad-1` / … |
| `tila` | enum | `jonossa` / `hyvaksytty` / `hylatty` / `piilotettu` |
| `nostettu` | bool | moderaattorin "suosikki" → näytetään useammin / `solo`-tilassa |
| `moderoija`, `moderoitu` | | kuka ja milloin |
| `nayttokerrat`, `viimeksi_naytetty` | int, timestamptz | jonon reiluutta varten |
| `laite_hash` | text | anonyymi tunniste rate limitiin ja estoihin (ei IP:tä selkokielisenä) |

**`asetukset`** – näytön layout, vaihtoväli, tauko/hätäpysäytys, tervetuloteksti.
**`naytot`** – näyttöjen heartbeat (viimeksi nähty, versio) valvontaa varten.

---

## 6. Toiminnalliset vaatimukset

### 6.1 Piirtonäkymä
- Neliön muotoinen piirtoalue, joka skaalautuu näyttöön (pysty/vaaka).
- 3–4 sivellintä (esim. tussi, sivellin, neon-hehku, kumi) ja 2–3 kokoa.
- 10–12 värin kuratoitu paletti (LED-testattu).
- Kumoa / tee uudelleen, tyhjennä (varmistuksella).
- Painoherkkyys Apple Pencilillä, kosketus ja hiiri toimivat myös.
- Sivun scrollaus, zoomaus ja "pull to refresh" estetty piirtoalueella.
- Tyhjää tai lähes tyhjää piirrosta ei voi lähettää.
- Valinnainen nimikenttä, käyttöehtojen hyväksyntä.
- Kieliversiot: **suomi ja englanti** (festivaalilla kansainvälisiä vieraita).
- Saavutettavuus: riittävät kosketusalueet (≥ 44 px), kontrastit, toimii myös vasenkätisille.

### 6.2 Kioskitila (iPad)
- Automaattinen nollaus esim. 60 s käyttämättömyyden jälkeen ("Jatketaanko?" -laskuri).
- Lähetyksen jälkeen palaa aloitusnäkymään.
- Lähde tunnistetaan URL-parametrista (`?kiosk=ipad-1`).
- Ohjeet laitteiden lukitukseen (Guided Access, automaattinen lukitus pois, kirkkaus, lataus telineessä).

### 6.3 Näyttö
- Layout-tilat `trio`, `solo`, `seina` (kohta 3).
- Piirtymisanimaatio: jokainen piirros piirtyy esiin 3–6 sekunnissa riippumatta alkuperäisestä piirtoajasta, sitten pysyy hetken paikallaan.
- Nimi/paikkakunta piirroksen alla isolla, luettavalla fontilla.
- **Jonologiikka:**
  1. Uudet, vielä näyttämättömät hyväksytyt piirrokset ensin (vanhin ensin).
  2. Nostetut piirrokset useammin.
  3. Muuten vähiten / pisimpään sitten näytetyt.
- Realtime-päivitys: uusi hyväksyntä tai poisto näkyy heti; **piilotettu piirros katoaa screeniltä välittömästi**.
- Offline: välimuistissa olevat piirrokset pyörivät; yhteyden palattua synkronoidaan.
- Hätäpysäytys administa: näyttö siirtyy pelkkään logo-/QR-tilaan.
- Heartbeat palvelimelle 30 s välein → admin näkee, onko näyttö elossa.
- Ei kursoria, ei scrollbareja, ei selaimen ilmoituksia; automaattinen uudelleenlataus virhetilanteessa.

### 6.4 Moderointi
- Kirjautuminen (Supabase Auth, sähköpostilinkki tai salasana) vain henkilökunnalle.
- Jonon esikatselu isona, **pyyhkäisy oikealle = hyväksy, vasemmalle = hylkää** (+ näppäinoikotiet läppärillä).
- Useampi moderaattori samanaikaisesti ilman päällekkäisyyttä (piirros "lukitaan" käsittelijälle).
- Jo hyväksytyn piirroksen piilotus heti (myös screeniltä).
- Nosto suosikiksi.
- Laitteen esto (rate limit -tunnisteen perusteella) toistuvalle häiriköinnille.
- Ilmoitus / äänimerkki, kun jonossa on odottavia; jonon pituus ja odotusaika näkyvissä.
- **Valinnainen tekoälyesisuodatus:** kuva-analyysi (esim. Claude Haiku 5.5) merkitsee todennäköisesti sopimattomat piirrokset ja järjestää jonoa, mutta **ihminen tekee aina lopullisen päätöksen**.

### 6.5 Hallinta
- Näytön asetukset (layout, vaihtoväli, tekstit), hätäpysäytys.
- Näyttöjen ja kioskien tila (heartbeat).
- Tilastot: lähetetyt / hyväksytyt / hylätyt, piirroksia tunneittain, lähteittäin.
- Vienti: kaikki hyväksytyt piirrokset PNG + JSON -pakettina festivaalin jälkeen.

### 6.6 Väärinkäytösten esto
- Rate limit: esim. 1 lähetys / 30 s ja 10 / tunti per laite.
- Kevyt botintorjunta (esim. Cloudflare Turnstile näkymättömänä) julkiselle lähetykselle.
- Palvelinpään validointi: viivadatan rakenne, koko, pisteiden määrä.
- Nimikentän kirosanasuodatin (fi/en) ennen moderointia.

---

## 7. Tietosuoja ja käyttöehdot

- Piirrokset ovat anonyymejä; nimikenttä on vapaaehtoinen. Kehotetaan käyttämään vain etunimeä.
- Käyttöehdot ja tietosuojaseloste (lyhyt, fi/en): piirros voidaan näyttää julkisesti screenillä, festivaalin kanavissa ja jälkikäteen festivaalin arkistossa/galleriassa.
- Ei evästeitä seurantaan. Rate limit -tunniste on hash, jota säilytetään vain festivaalin ajan.
- Data EU-alueella. Säilytysaika sovitaan (esim. hylätyt poistetaan 30 vrk kuluttua, hyväksytyt arkistoidaan).
- Alaikäiset: ei kerätä henkilötietoja, joten huoltajan suostumusta ei tarvita – varmistetaan festivaalin juristilta / tietosuojavastaavalta.
- Rekisterinpitäjä: festivaalin järjestäjä (sovitaan).

---

## 8. Vaiheistus

Aikataulu on esitetty suhteessa festivaalin alkuun (**F**). Jos festivaali on jo marraskuussa 2026, aikaa on vain muutama viikko → toteutetaan vaiheet 0–3 tiiviinä ja jätetään kaikki "jos ehditään" -kohdat pois.

### Vaihe 0 – Selvitykset (F − 6 vk, 2–3 päivää)
- [ ] Screenin tarkat tekniset tiedot ja ohjausprosessori (kohta 3)
- [ ] Mainoskarusellin ohjelmisto ja integraatiotapa (A/B/C, kohta 4)
- [ ] Slotin pituus ja toistotiheys → läpimenolaskelma
- [ ] Verkko: festivaalialueen WiFi, playout-PC:n yhteys, mobiiliverkon kattavuus
- [ ] Moderointivastuut ja vuorot (kuka valvoo jonoa mihinkin aikaan)
- [ ] Lumon brändi-ilme, logot, fontit, värit
- [ ] Domain (esim. `raapustamo.fi` / alidomain festivaalin sivustolta)
- [ ] Tietosuoja- ja käyttöehtotekstit, rekisterinpitäjä
- [ ] iPadien määrä, telineet, sijoitus

### Vaihe 1 – Prototyypit ja screen-testi (F − 5 vk, 1 viikko)
- [ ] Projektipohja: Next.js + Supabase + Vercel, CI, ympäristöt (dev / prod)
- [ ] Piirtoalusta-prototyyppi (perfect-freehand, paletti, kumoa) iPadilla ja puhelimilla (iOS Safari, Android Chrome)
- [ ] Näyttöprototyyppi 4032×1152: staattiset testipiirrokset, `trio`-layout, piirtymisanimaatio
- [ ] **Testi oikealla LED-screenillä**: värit, viivanleveydet, tekstikoot, kirkkaus, kameratesti → paletin ja minimikokojen lukitus

### Vaihe 2 – MVP päästä päähän (F − 4 vk, 1,5 viikkoa)
- [ ] Tietomalli, RLS-säännöt, Storage
- [ ] Lähetys-API: validointi, rate limit, PNG-esikatselu
- [ ] Moderointinäkymä: kirjautuminen, jono, hyväksy/hylkää/piilota/nosta, realtime
- [ ] Näyttö: realtime-päivitys, jonologiikka, URL-parametrit, QR-sivupalkki
- [ ] Kiitosnäkymä, kieliversiot fi/en, käyttöehdot
- [ ] Kioskitila ja automaattinen nollaus

### Vaihe 3 – Kovetus ja testaus (F − 2 vk, 1 viikko)
- [ ] Näytön offline-tuki (Service Worker + IndexedDB) ja automaattinen palautuminen
- [ ] Heartbeatit ja admin-tilasivu, hätäpysäytys
- [ ] Kuormitustesti: esim. 500 samanaikaista piirtäjää, 50 lähetystä/min
- [ ] 12 tunnin kestotesti näytölle (muistivuodot, animaatioiden sujuvuus)
- [ ] Laitetestaus: vanhat iPhonet/Androidit, iPad + Pencil, hidas mobiiliyhteys
- [ ] Valinnainen tekoälyesisuodatus moderointiin
- [ ] Tietoturvakatselmointi (avoimet API:t, RLS, moderointiosoitteen suojaus)
- [ ] Kenraaliharjoitus oikealla screenillä ja karusellilla

### Vaihe 4 – Festivaali (F)
- [ ] Ajo-ohje (runbook): käynnistys, hätäpysäytys, näytön uudelleenlataus, kioskien nollaus, kenelle soitetaan
- [ ] Moderointivuorot ja moderointiohje (mikä hyväksytään, mikä ei)
- [ ] Valvonta: Vercelin ja Supabasen lokit, admin-tilasivu
- [ ] Varasuunnitelma: jos verkko kaatuu, näyttö pyörii välimuistista; jos screen-PC kaatuu, karuselli ohittaa slotin
- [ ] Viestintä: QR-koodijulisteet, somepostaukset, ohjeistus juontajille

### Vaihe 5 – Jälkeen (F + 1–2 vk)
- [ ] Piirrosten vienti ja arkistointi
- [ ] Verkkogalleria / timelapse-video kaikista piirroksista festivaalin viestintään
- [ ] Tilastoraportti (määrät, huippuajat, lähteet)
- [ ] Datan säilytys / poisto sovitun mukaisesti
- [ ] Retrospektiivi: mikä toimi, mitä seuraavalle vuodelle

---

## 9. Riskit

| Riski | Todennäköisyys | Vaikutus | Hallinta |
|---|---|---|---|
| Sopimaton piirros päätyy screenille | Keskisuuri | Erittäin suuri | Pakollinen ennakkomoderointi, välitön piilotus, hätäpysäytys |
| Moderointi ei pysy perässä ruuhkassa | Suuri | Keskisuuri | Vuorolista, mobiilimoderointi, tekoälyesisuodatus, screen kierrättää jo hyväksyttyjä |
| Integraatio karuselliin selviää myöhään | Keskisuuri | Suuri | Selvitys vaiheessa 0, näyttö tukee kaikkia vaihtoehtoja A–C |
| Värit / viivat näyttävät screenillä huonolta | Suuri | Keskisuuri | Screen-testi vaiheessa 1 ennen ulkoasun lukitsemista |
| Verkkokatkos festivaalialueella | Keskisuuri | Keskisuuri | Offline-välimuisti näytöllä, puhelimet käyttävät omaa mobiilidataa |
| Ruuhkapiikki (esim. juontaja mainostaa) | Keskisuuri | Keskisuuri | Kuormitustesti, skaalautuvat palvelut, rate limit |
| Piirtäminen takkuaa vanhoilla puhelimilla | Keskisuuri | Pieni | Laitetestaus, kevyt renderöinti, ei raskaita kirjastoja |
| Aikataulu liian tiukka | Suuri | Suuri | Tiukka MVP-rajaus, "jos ehditään" -lista erikseen |

---

## 10. Avoimet kysymykset

1. Mikä on festivaalin päivämäärä ja kesto (päivät, aukioloajat)?
2. Mikä ohjelmisto pyörittää mainoskarusellia, ja voiko siihen lisätä web-sivun slotiksi?
3. Slotin pituus ja kuinka usein Raapustamo-slotti toistuu?
4. Screenin tarkka resoluutio, ohjausprosessori ja playout-koneen tiedot?
5. Kuka moderoi, ja minä aikoina? Hyväksytäänkö se, että screenillä näkyy viiveellä?
6. Montako iPadia ja missä? Onko Apple Pencilit?
7. Saako piirroksissa näkyä nimi? Entä paikkakunta?
8. Halutaanko piirrokset jälkikäyttöön (galleria, video, näyttely)? → vaikuttaa käyttöehtoihin.
9. Onko Lumolla valmiit pilvitilit (Vercel/Supabase tms.) vai hankitaanko projektille omat?
10. Budjetti: palveluiden kulut ovat todennäköisesti pienet (ilmais- tai pienimmät maksulliset tasot riittävät), mutta tekoälymoderointi ja domain maksavat jonkin verran.
