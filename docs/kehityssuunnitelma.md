# Raapustamo – kehityssuunnitelma

**Raapustamo** on selainpohjainen vieraskirja Lumo Art & Tech Festivalille. Kävijät piirtävät terveisen, kuvan tai muun vieraskirjamerkinnän iPadilla tai omalla puhelimellaan, ja moderoidut piirrokset näytetään festivaalin 10,5 m × 3 m LED-screenillä (2,6 mm pikseliväli) osana Resolumella pyöritettävää mainoskarusellia.

> Tila: luonnos · Päivitetty: 2026-10-22

---

## 0. Tehdyt päätökset

| Aihe | Päätös |
|---|---|
| Aikataulu | Festivaaliin on yli 2 kuukautta → kaikki vaiheet 0–5 toteutetaan, myös tekoälyesisuodatus ja verkkogalleria |
| Karuselli | **Resolume**, Raapustamo on yksi karusellin slotti (ks. kohta 4) |
| Slotin pituus ja tiheys | Ei vielä sovittu → näyttö säädettävä URL-parametreilla |
| Moderointi | **Ihminen hyväksyy jokaisen piirroksen**, tekoäly esisuodattaa ja järjestää jonon |
| Hostaus | **Vercel + Supabase**, projektin omat tilit, EU-alue |
| Kioskit | **iPadit + Apple Pencil** |
| Tekstitieto | **Ei tekstikenttiä** – pelkkä piirros, ei nimiä screenillä |
| Jälkikäyttö | **Verkkogalleria** hyväksytyistä piirroksista festivaalin jälkeen |
| Kielet | **Suomi + englanti** (automaattinen tunnistus + vaihtonappi) |
| Visuaalinen ilme | **Lumon brändi-ilme** (logot, fontit, värit tuotannolta) |

---

## 1. Tavoitteet ja rajaus

**Tavoitteet**
- Piirtäminen alkaa alle 10 sekunnissa QR-koodin skannauksesta: ei sovelluksen asennusta eikä kirjautumista.
- Jokainen hyväksytty piirros näkyy isolla screenillä näyttävästi (piirtymisanimaatio) ja päätyy kierrossa näkyviin vähintään kerran.
- Screenille ei päädy mitään sopimatonta: **kaikki piirrokset moderoidaan ihmisen toimesta ennen näyttämistä.**
- Näyttö jatkaa toimintaansa, vaikka verkkoyhteys katkeaisi.
- Festivaalin jälkeen piirrokset elävät verkkogalleriassa.

**Ei kuulu projektiin:** käyttäjätilit, nimet ja tekstikentät, kommentointi/tykkäykset, kuvien lataus kamerasta, tekoälygenerointi, tulostus paperille.

---

## 2. Käyttäjät ja näkymät

| Näkymä | Reitti | Käyttäjä | Laite |
|---|---|---|---|
| Piirtonäkymä | `/` | Festivaalikävijä | Oma puhelin (QR) |
| Kioskitila | `/?kiosk=ipad-1` | Festivaalikävijä | iPad + Apple Pencil telineessä |
| Näyttö | `/naytto` | – (LED-screen) | Playout-kone → Resolume |
| Moderointi | `/moderointi` | Festivaalin henkilökunta | Puhelin / tabletti / läppäri |
| Hallinta | `/admin` | Tuottaja / tekninen vastaava | Läppäri |
| Galleria | `/galleria` | Kuka tahansa | Julkaistaan festivaalin jälkeen |

### Käyttäjäpolku (kävijä)
1. Näkee screenillä tai standilla QR-koodin ja lyhyen osoitteen.
2. Avaa piirtonäkymän → lyhyt ohje ("Piirrä terveiset Lumolle – parhaat päätyvät isolle screenille!").
3. Piirtää: muutama sivellin, kuratoitu väripaletti, kumi, kumoa, tyhjennä.
4. Hyväksyy käyttöehdot (yksi rasti, sisältää julkisen näytön ja gallerian) → **Lähetä**.
5. Kiitosnäkymä: "Piirroksesi on jonossa ja näkyy screenillä moderoinnin jälkeen." + nappi "Piirrä uusi".

---

## 3. LED-screenin tekniset reunaehdot

### Resoluutio
2,6 mm pikseliväli on käytännössä 2,604 mm (500 mm kaappi / 192 px).

- Leveys: 10,5 m → 21 kaappia × 192 px = **4032 px**
- Korkeus: 3,0 m → 6 kaappia × 192 px = **1152 px**
- Kuvasuhde **3,5 : 1**, n. 4,6 megapikseliä

⚠️ **Varmistettava screenin toimittajalta:** kaappikoko, todellinen pikselimäärä, ohjausprosessori (esim. Novastar) sekä Resolumen composition-resoluutio ja output-mappaus.

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

3 × 1152 + 576 = 4032 px. Sivupalkissa Lumo/Raapustamo-logo, QR-koodi ja kehotus "Piirrä sinäkin! / Draw yours!" → screen markkinoi itse itseään.

Vaihtoehtoisia layout-tiloja (valittavissa URL-parametrilla):
- `trio` – 3 piirrosta + sivupalkki (oletus)
- `solo` – yksi piirros suurena keskellä (nostetuille)
- `seina` – 8–12 pientä piirrosta ruudukkona (koosteslotti)

### LED-näytön visuaaliset säännöt
- **Tumma tausta.** Musta = ledit pois päältä → paras kontrasti, pienempi virrankulutus, ei häikäise. Valkoinen täysruutu 30 m²:n LED-screenillä on sokaiseva.
- **Kuratoitu, kirkas väripaletti**, joka sovitetaan Lumon brändiväreihin. Ei tummansinistä, ruskeaa tai tummanharmaata – ne katoavat mustalle taustalle.
- **Piirtonäkymässäkin tumma tausta**, jotta piirtäjä näkee saman kuin screenillä.
- **Minimiviivanleveys** renderöinnissä n. 8 px (≈ 2 cm fyysisesti), jotta ohuet viivat eivät katoa katseluetäisyydeltä.
- Animaatiot pehmeitä ja riittävän hitaita; nopea välkyntä näyttää LED-screenillä ja kameroissa huonolta.
- **Testataan oikealla screenillä mahdollisimman aikaisin** (värit, kirkkaus, viivanleveydet, tekstikoot, näkyykö virkistystaajuus kameroissa).

---

## 4. Integraatio Resolumeen

Resolume Arenassa ei ole sisäänrakennettua selain- tai HTML-lähdettä (asia on Resolumen foorumilla yhä toiveena). Web-sivu tuodaan Resolumeen **videolähteenä samalta koneelta**:

| Tapa | Kuvaus | Huomiot |
|---|---|---|
| **A. Spout (Windows) / Syphon (macOS)** | Selain renderöi sivun ja jakaa kuvan GPU-tekstuurina Resolumelle. Esim. avoimen lähdekoodin **SpoutBrowser** tai OBS:n browser source + Spout/Syphon-lähetin | Pakkaamaton, pieni viive, ei verkkoliikennettä. **Suositus**, jos playout-kone on Windows |
| **B. NDI** | OBS:n browser source → NDI → Resolumen NDI-lähde | Toimii myös eri koneelta. Pakkaus ja 4032×1152-resoluutio rasittavat konetta enemmän |

**Suositus:** Spout (tai macOS:llä Syphon) samalta playout-koneelta. Resolumessa Raapustamo on yksi klippi karusellin muiden klippien joukossa; klipin resoluutio = composition-resoluutio (4032×1152).

### Mitä tämä tarkoittaa näyttösivulle
- **Sivu pyörii jatkuvasti taustalla**, vaikka Resolume näyttää sitä vain slotin ajan. Sivu ei siis lataudu uudelleen jokaisen slotin alussa, mikä on hyvä: data on aina valmiina.
- **Sivu ei tiedä, milloin se on näkyvissä.** Ilman lisäratkaisua piirrokset vaihtuvat myös silloin, kun screenillä pyörii mainos, ja "näyttökerta" on epätarkka. Ratkaisuvaihtoehdot:
  1. **Resolume-silta (suositus, vaihe 3):** pieni paikallinen Node.js-skripti kuuntelee Resolumen OSC-viestejä tai REST API:a (Resolume 7.8+) ja kertoo näyttösivulle WebSocketilla, kun Raapustamo-klippi kytkeytyy päälle. Sivu aloittaa silloin uuden kierroksen piirtymisanimaatioineen ja laskee näyttökerrat oikein.
  2. **Yksinkertainen tila (MVP):** sivu kierrättää piirroksia tasaisesti, ja jonologiikka nojaa aikaan eikä tarkkoihin näyttökertoihin.
- **Ei läpinäkyvyyttä tarvita**, koska slotti täyttää koko screenin. Spout/SpoutBrowser tukisi läpinäkyvää taustaa, jos Raapustamoa halutaan myöhemmin kerrostaa muun sisällön päälle.

### URL-parametrit
Slotin pituutta ja tiheyttä ei ole vielä sovittu, joten kaikki ajoitukset ovat säädettäviä:

```
/naytto?layout=trio&vaihto=10&qr=1&silta=ws://localhost:7400
```

- `layout` – `trio` / `solo` / `seina`
- `vaihto` – kuinka usein piirrokset vaihtuvat (s)
- `qr` – sivupalkki päälle/pois
- `silta` – Resolume-sillan osoite (jos käytössä)

### Läpimeno – mitä voidaan luvata kävijälle?
Esimerkki: 30 s slotti joka 3. minuutti, 3 piirrosta / 10 s → 9 piirrosta / slotti → **n. 180 piirrosta tunnissa**. 60 s slotti 5 min välein → n. 216 / h. Jos piirroksia tulee enemmän, kaikki eivät ehdi näkyviin heti. Siksi kävijälle **ei luvata tarkkaa aikaa**, ja jonon järjestys painottaa tuoreita mutta takaa kaikille vähintään yhden näyttökerran (ks. kohta 6.3).

---

## 5. Arkkitehtuuri

```
  Puhelin / iPad               Pilvi (Vercel + Supabase, EU)          Playout-kone (festivaali)
 +---------------+        +-------------------------------+       +-----------------------------+
 | Piirtonäkymä  |--POST->|  Next.js-sovellus (API)       |       | SpoutBrowser / OBS          |
 +---------------+        |  - vastaanotto, validointi    |<-WS---|   /naytto + välimuisti      |
                          |  - rate limit                 |       |        | Spout/Syphon       |
 +---------------+        |  - tekoälyesisuodatus         |       |        v                    |
 | Moderointi    |<--WS-->+-------------------------------+       | Resolume Arena --> LED      |
 +---------------+        |  Postgres + Realtime + Auth   |       |   ^ OSC / REST              |
                          |  Storage (PNG-esikatselut)    |       | Resolume-silta (Node, WS)   |
 +---------------+        +-------------------------------+       +-----------------------------+
 | Galleria      |
 +---------------+
```

### Teknologiavalinnat

| Osa | Valinta | Perustelu |
|---|---|---|
| Frontend + API | **Next.js (TypeScript)**, hostaus **Vercel** (EU-region) | Yksi koodikanta kaikille näkymille, helppo julkaisu, skaalautuu ruuhkassa |
| Tietokanta, realtime, auth, tallennus | **Supabase** (Postgres + Realtime + Auth + Storage), EU-region | Moderointi- ja näyttönäkymät saavat muutokset reaaliajassa ilman omaa WebSocket-palvelinta; moderaattorien kirjautuminen valmiina |
| Piirtäminen | Pointer Events + Canvas 2D + **[perfect-freehand](https://github.com/steveruiz/perfect-freehand)** | Kauniit, painoherkät viivat Apple Pencilillä; sama algoritmi piirtäjällä, screenillä ja galleriassa |
| Tekoälyesisuodatus | Claude-mallin kuva-analyysi palvelinpäässä (esim. Haiku-luokan malli) | Nopea ja edullinen luokittelu; ei koskaan hyväksy itse |
| Näytön offline-tuki | Service Worker + IndexedDB | Hyväksytyt piirrokset välimuistiin; silmukka jatkuu verkkokatkosta huolimatta |
| Resolume-yhteys | Spout/Syphon + Node.js-silta (OSC/REST → WebSocket) | Ks. kohta 4 |
| Kioski-iPadit | iPadOS Guided Access + Safari / PWA koko näytöllä | Ei pääsyä muualle laitteella |

### Piirrosten tallennusmuoto
Piirros tallennetaan **vektorimuodossa** (viivat pisteinä), ei pelkkänä kuvana:
- skaalautuu terävästi 1152 px:n ruutuun riippumatta piirtolaitteen resoluutiosta
- mahdollistaa **piirtymisanimaation** screenillä ja galleriassa
- pieni koko (pisteiden harvennus, esim. Ramer–Douglas–Peucker)

Lisäksi tallennetaan PNG-esikatselu moderointia, tekoälyluokittelua ja gallerian pikkukuvia varten.

```jsonc
// viivat (koordinaatit normalisoitu 0..1, jolloin laitteen koko ei vaikuta)
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
| `lahde` | text | `mobiili` / `ipad-1` / … |
| `kieli` | text | `fi` / `en` (tilastointiin) |
| `tila` | enum | `jonossa` / `hyvaksytty` / `hylatty` / `piilotettu` |
| `ai_arvio` | jsonb, null | tekoälyn luokitus ja varmuus (`ok` / `epailyttava` / `sopimaton`) |
| `nostettu` | bool | moderaattorin suosikki → näytetään useammin / `solo`-tilassa |
| `galleriaan` | bool | oletuksena `true` hyväksytyille; voidaan jättää pois galleriasta |
| `moderoija`, `moderoitu` | | kuka ja milloin |
| `nayttokerrat`, `viimeksi_naytetty` | int, timestamptz | jonon reiluutta varten |
| `laite_hash` | text | anonyymi tunniste rate limitiin ja estoihin (ei IP:tä selkokielisenä) |

**`asetukset`** – näytön layout, vaihtoväli, tauko/hätäpysäytys.
**`naytot`** – näyttöjen ja kioskien heartbeat (viimeksi nähty, versio) valvontaa varten.

---

## 6. Toiminnalliset vaatimukset

### 6.1 Piirtonäkymä
- Neliön muotoinen piirtoalue, joka skaalautuu näyttöön (pysty/vaaka).
- 3–4 sivellintä (esim. tussi, sivellin, neon-hehku, kumi) ja 2–3 kokoa.
- 10–12 värin kuratoitu paletti (Lumon väreistä johdettu, LED-testattu).
- Kumoa / tee uudelleen, tyhjennä (varmistuksella).
- Painoherkkyys Apple Pencilillä; kosketus ja hiiri toimivat myös. Kioskissa kämmenen hylkäys (vain kynä piirtää, kun kynä on havaittu).
- Sivun scrollaus, zoomaus ja "pull to refresh" estetty piirtoalueella.
- Tyhjää tai lähes tyhjää piirrosta ei voi lähettää.
- Ei tekstikenttiä. Käyttöehtojen hyväksyntä yhdellä rastilla.
- Kieliversiot **suomi ja englanti**: automaattinen tunnistus selaimen kielestä + vaihtonappi.
- Saavutettavuus: riittävät kosketusalueet (≥ 44 px), kontrastit, toimii myös vasenkätisille.

### 6.2 Kioskitila (iPad + Apple Pencil)
- Automaattinen nollaus esim. 60 s käyttämättömyyden jälkeen ("Jatketaanko?" -laskuri).
- Lähetyksen jälkeen palaa aloitusnäkymään.
- Lähde tunnistetaan URL-parametrista (`?kiosk=ipad-1`).
- Laitteet: lukittava teline, **kynän kiinnitys narulla/pidikkeellä**, kynien lataussuunnitelma (varakynät latauksessa, vaihto päivän mittaan), iPadin lataus telineessä.
- Ohjeet laitteiden lukitukseen: Guided Access, automaattinen lukitus pois, kirkkaus, ilmoitukset pois.
- Kioski lähettää heartbeatin → admin näkee, jos iPad on jumissa tai sammunut.

### 6.3 Näyttö
- Layout-tilat `trio`, `solo`, `seina` (kohta 3), Lumon brändi-ilme.
- 4032×1152-renderöinti, `devicePixelRatio` huomioitu, ei skaalausta selaimessa.
- Piirtymisanimaatio: jokainen piirros piirtyy esiin 3–6 sekunnissa riippumatta alkuperäisestä piirtoajasta, sitten pysyy hetken paikallaan.
- **Jonologiikka:**
  1. Uudet, vielä näyttämättömät hyväksytyt piirrokset ensin (vanhin ensin).
  2. Nostetut piirrokset useammin.
  3. Muuten vähiten / pisimpään sitten näytetyt.
- Resolume-silta käytössä → uusi kierros alkaa, kun klippi kytkeytyy päälle; muuten tasainen kierto.
- Realtime-päivitys: uusi hyväksyntä tai poisto näkyy heti; **piilotettu piirros katoaa screeniltä välittömästi**.
- Offline: välimuistissa olevat piirrokset pyörivät; yhteyden palattua synkronoidaan.
- Hätäpysäytys administa: näyttö siirtyy pelkkään logo-/QR-tilaan. (Resolumessa operaattori voi lisäksi aina ohittaa klipin.)
- Heartbeat palvelimelle 30 s välein → admin näkee, onko näyttö elossa.
- Ei kursoria, ei scrollbareja, ei selaimen ilmoituksia; automaattinen uudelleenlataus virhetilanteessa.

### 6.4 Moderointi
- Kirjautuminen (Supabase Auth) vain henkilökunnalle.
- Jonon esikatselu isona, **pyyhkäisy oikealle = hyväksy, vasemmalle = hylkää** (+ näppäinoikotiet läppärillä).
- **Tekoälyesisuodatus:** jokainen lähetys luokitellaan heti (`ok` / `epailyttava` / `sopimaton`). Moderaattori näkee arvion ja syyn; epäilyttävät nostetaan jonossa ensimmäisiksi tarkasteltaviksi, selvästi sopimattomat voidaan hylätä yhdellä napilla. **Tekoäly ei koskaan hyväksy itse.** Jos tekoälypalvelu ei vastaa, piirros menee jonoon normaalisti.
- Useampi moderaattori samanaikaisesti ilman päällekkäisyyttä (piirros "lukitaan" käsittelijälle).
- Jo hyväksytyn piirroksen piilotus heti (myös screeniltä ja galleriasta).
- Nosto suosikiksi.
- Laitteen esto (rate limit -tunnisteen perusteella) toistuvalle häiriköinnille.
- Ilmoitus / äänimerkki, kun jonossa on odottavia; jonon pituus ja odotusaika näkyvissä.
- Moderointiohje: mikä hyväksytään, mikä ei (esim. ei tekstiä, joka sisältää nimiä, puhelinnumeroita tai somekahvoja).

### 6.5 Hallinta
- Näytön asetukset (layout, vaihtoväli), hätäpysäytys.
- Näyttöjen, kioskien ja Resolume-sillan tila (heartbeat).
- Tilastot: lähetetyt / hyväksytyt / hylätyt, piirroksia tunneittain, lähteittäin, kielittäin; tekoälyarvion osuvuus vs. ihmisen päätös.
- Vienti: kaikki hyväksytyt piirrokset PNG + JSON -pakettina.

### 6.6 Väärinkäytösten esto
- Rate limit: esim. 1 lähetys / 30 s ja 10 / tunti per laite (kioskeilla väljempi).
- Kevyt botintorjunta (esim. Cloudflare Turnstile näkymättömänä) julkiselle lähetykselle.
- Palvelinpään validointi: viivadatan rakenne, koko, pisteiden määrä.

### 6.7 Verkkogalleria
- Kaikki hyväksytyt piirrokset (joissa `galleriaan = true`) selattavana ruudukkona.
- Piirros avautuu isoksi ja piirtyy esiin animaationa.
- Suodatus festivaalipäivän mukaan, satunnainen järjestys -nappi.
- Kevyt ja nopea: pikkukuvat PNG:nä, vektorit vasta avattaessa; staattisesti generoitu sivu.
- Suomi + englanti, Lumon ilme, jaettava linkki yksittäiseen piirrokseen.
- Rakennetaan jo ennen festivaalia (piilotettuna), julkaistaan festivaalin jälkeen.

---

## 7. Tietosuoja ja käyttöehdot

- **Piirrokset ovat anonyymejä** – tekstikenttiä ei ole, joten henkilötietoja ei kerätä. Riskinä on vain itse piirrokseen kirjoitettu teksti (nimet, numerot), joka hoidetaan moderoinnissa.
- Käyttöehdot (lyhyt, fi/en): piirros voidaan näyttää julkisesti screenillä, festivaalin kanavissa ja **festivaalin jälkeen verkkogalleriassa**. Piirtäjä luovuttaa festivaalille oikeuden näihin käyttöihin.
- Poistopyyntö: koska piirroksia ei voi yhdistää henkilöön, ohjeistetaan ottamaan yhteyttä ja kuvailemaan piirros (tai kiitosnäkymässä näytetään lyhyt piirroskoodi, jolla poiston voi pyytää).
- Ei evästeitä seurantaan. Rate limit -tunniste on hash, joka poistetaan festivaalin jälkeen.
- Tekoälyesisuodatus: piirroksen kuva lähetetään luokiteltavaksi tekoälypalveluun – mainitaan tietosuojaselosteessa.
- Data EU-alueella. Hylätyt poistetaan esim. 30 vrk kuluttua, hyväksytyt säilyvät galleriassa sovitun ajan.
- Rekisterinpitäjä: festivaalin järjestäjä (sovitaan).

---

## 8. Vaiheistus

Aikataulu on esitetty suhteessa festivaalin alkuun (**F**). Aikaa on yli 2 kuukautta, joten vaiheiden väliin jää puskuria ja ennen festivaalia ehditään tehdä kaksi testikierrosta oikealla screenillä.

### Vaihe 0 – Selvitykset (F − 10 vk, 1 viikko)
- [ ] Screenin tarkat tekniset tiedot ja ohjausprosessori (kohta 3)
- [ ] Playout-kone: käyttöjärjestelmä (Windows → Spout, macOS → Syphon), GPU, Resolumen versio
- [ ] Resolumen karusellin rakenne: miten slotit vaihtuvat (automaattinen kierto, OSC, operaattori)
- [ ] Slotin pituus ja toistotiheys → läpimenolaskelma
- [ ] Verkko: festivaalialueen WiFi, playout-koneen yhteys, mobiiliverkon kattavuus
- [ ] Moderointivastuut ja vuorot
- [ ] Lumon brändimateriaalit: logot, fontit, värit, käyttöohjeet
- [ ] Domain (oma vai alidomain festivaalin sivustolta)
- [ ] Tietosuoja- ja käyttöehtotekstit, rekisterinpitäjä
- [ ] iPadien määrä, Apple Pencilit, telineet, sijoitus
- [ ] Vercel- ja Supabase-tilit (EU-region), maksutasot

### Vaihe 1 – Prototyypit ja screen-testi #1 (F − 9 vk, 2 viikkoa)
- [ ] Projektipohja: Next.js + Supabase + Vercel, CI, ympäristöt (dev / prod), i18n-runko
- [ ] Piirtoalusta-prototyyppi (perfect-freehand, paletti, kumoa) iPadilla + Pencilillä ja puhelimilla (iOS Safari, Android Chrome)
- [ ] Näyttöprototyyppi 4032×1152: staattiset testipiirrokset, `trio`-layout, piirtymisanimaatio
- [ ] Spout/Syphon-putki playout-koneelle: SpoutBrowser tai OBS → Resolume, suorituskyky 4032×1152 @ 60 fps
- [ ] **Screen-testi #1 oikealla LED-screenillä Resolumen kautta**: värit, viivanleveydet, tekstikoot, kirkkaus, kameratesti → paletin ja minimikokojen lukitus

### Vaihe 2 – MVP päästä päähän (F − 7 vk, 2 viikkoa)
- [ ] Tietomalli, RLS-säännöt, Storage
- [ ] Lähetys-API: validointi, rate limit, PNG-esikatselu
- [ ] Moderointinäkymä: kirjautuminen, jono, hyväksy/hylkää/piilota/nosta, realtime
- [ ] Näyttö: realtime-päivitys, jonologiikka, URL-parametrit, QR-sivupalkki
- [ ] Kiitosnäkymä, kieliversiot fi/en, käyttöehdot
- [ ] Kioskitila ja automaattinen nollaus
- [ ] Lumon brändi-ilme kaikkiin näkymiin

### Vaihe 3 – Laajennukset ja kovetus (F − 5 vk, 2 viikkoa)
- [ ] Tekoälyesisuodatus moderointiin + virhetilanteiden käsittely
- [ ] Resolume-silta (OSC/REST → WebSocket), näyttökertojen tarkka laskenta
- [ ] Näytön offline-tuki (Service Worker + IndexedDB) ja automaattinen palautuminen
- [ ] Heartbeatit (näyttö, kioskit, silta) ja admin-tilasivu, hätäpysäytys
- [ ] Verkkogalleria (piilotettuna)
- [ ] Tilastot ja vienti

### Vaihe 4 – Testaus ja screen-testi #2 (F − 3 vk, 2 viikkoa)
- [ ] Kuormitustesti: esim. 500 samanaikaista piirtäjää, 50 lähetystä/min
- [ ] 12 tunnin kestotesti näytölle ja Spout-putkelle (muistivuodot, animaatioiden sujuvuus)
- [ ] Laitetestaus: vanhat iPhonet/Androidit, iPad + Pencil, hidas mobiiliyhteys
- [ ] Moderointitesti oikeilla ihmisillä: kuinka nopeasti jono purkautuu, tekoälyarvion osuvuus
- [ ] Tietoturvakatselmointi (avoimet API:t, RLS, moderointiosoitteen suojaus)
- [ ] **Kenraaliharjoitus**: oikea screen, Resolume-karuselli, iPadit, moderaattorit
- [ ] Ajo-ohje (runbook) ja moderointiohje valmiiksi

### Vaihe 5 – Festivaali (F)
- [ ] Laitteiden pystytys ja tarkistuslista joka päivä ennen ovien avausta
- [ ] Moderointivuorot
- [ ] Valvonta: Vercelin ja Supabasen lokit, admin-tilasivu
- [ ] Varasuunnitelma: jos verkko kaatuu, näyttö pyörii välimuistista; jos playout-selain kaatuu, Resolume-operaattori ohittaa klipin
- [ ] Viestintä: QR-koodijulisteet, somepostaukset, ohjeistus juontajille

### Vaihe 6 – Jälkeen (F + 1–2 vk)
- [ ] Verkkogallerian julkaisu
- [ ] Piirrosten vienti ja arkistointi
- [ ] Tilastoraportti (määrät, huippuajat, lähteet, kielet)
- [ ] Datan säilytys / poisto sovitun mukaisesti (hylätyt, laitetunnisteet)
- [ ] Retrospektiivi: mikä toimi, mitä seuraavalle vuodelle

---

## 9. Riskit

| Riski | Todennäköisyys | Vaikutus | Hallinta |
|---|---|---|---|
| Sopimaton piirros päätyy screenille | Keskisuuri | Erittäin suuri | Pakollinen ihmismoderointi, tekoälyesisuodatus, välitön piilotus, hätäpysäytys, Resolume-operaattori voi ohittaa klipin |
| Moderointi ei pysy perässä ruuhkassa | Suuri | Keskisuuri | Vuorolista, mobiilimoderointi, tekoäly järjestää jonon, screen kierrättää jo hyväksyttyjä |
| Spout/NDI-putki 4032×1152-resoluutiolla takkuaa | Keskisuuri | Suuri | Testataan vaiheessa 1 oikealla playout-koneella; varalla NDI tai pienempi renderöintiresoluutio + skaalaus Resolumessa |
| Playout-selain kaatuu tai jumittuu kesken festivaalin | Keskisuuri | Keskisuuri | Kestotesti, automaattinen uudelleenlataus, heartbeat-valvonta |
| Värit / viivat näyttävät screenillä huonolta | Suuri | Keskisuuri | Screen-testi #1 ennen ulkoasun lukitsemista |
| Apple Pencilit katoavat tai tyhjenevät | Suuri | Pieni | Kiinnitys, varakynät, lataussuunnitelma; sormipiirto toimii aina |
| Verkkokatkos festivaalialueella | Keskisuuri | Keskisuuri | Offline-välimuisti näytöllä, puhelimet käyttävät omaa mobiilidataa |
| Ruuhkapiikki (esim. juontaja mainostaa) | Keskisuuri | Keskisuuri | Kuormitustesti, skaalautuvat palvelut, rate limit |
| Piirtäminen takkuaa vanhoilla puhelimilla | Keskisuuri | Pieni | Laitetestaus, kevyt renderöinti, ei raskaita kirjastoja |

---

## 10. Avoimet kysymykset

1. Mikä on festivaalin tarkka päivämäärä ja kesto (päivät, aukioloajat)?
2. Screenin tarkka resoluutio ja ohjausprosessori?
3. Playout-kone: Windows vai macOS, näytönohjain, Resolumen versio? Kuka on Resolume-operaattori?
4. Miten karuselli etenee Resolumessa: automaattinen kierto (esim. Autopilot) vai operaattori? Lähettääkö Resolume OSC-viestejä?
5. Slotin pituus ja toistotiheys?
6. Kuka moderoi ja minä aikoina? Montako moderaattoria ruuhka-aikoina?
7. Montako iPadia ja Apple Penciliä, ja missä kioskit sijaitsevat?
8. Kuinka kauan verkkogalleria pidetään julkisena?
9. Domain: oma (esim. `raapustamo.fi`) vai festivaalin alidomain?
10. Kuka on rekisterinpitäjä ja kuka hyväksyy käyttöehdot / tietosuojaselosteen?

---

## Lähteet

- [Resolume-foorumi: Browser Source -keskustelu (SpoutBrowser, OBS-kierrot)](https://resolume.com/forum/viewtopic.php?p=107478)
- [Resolume 7.8: REST API ja sisäänrakennettu webpalvelin](https://www.toolfarm.com/?p=74381)
