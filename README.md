# Raapustamo

Lumo Art & Tech Festivalin piirrettävä vieraskirja. Kävijät piirtävät puhelimella tai
iPad-kioskilla, moderaattorit hyväksyvät piirrokset, ja hyväksytyt piirrokset näkyvät
10,5 × 3 m LED-screenillä (4032 × 1152 px) osana Resolumen mainoskarusellia.

- Suunnitelma: [docs/kehityssuunnitelma.md](docs/kehityssuunnitelma.md)
- Resolume-silta: [silta/](silta/README.md)
- Ilmeprototyypit: [prototyypit/](prototyypit/README.md)
- Kuvat tuottajalle: [docs/kuvat/](docs/kuvat)
- Ajo-ohje: [docs/ajo-ohje.md](docs/ajo-ohje.md) · Moderointiohje: [docs/moderointiohje.md](docs/moderointiohje.md)
- Testien tarkistuslistat: [keynote-laitetesti](docs/testit/keynote-laitetesti.md) · [screen-testi #1](docs/testit/screen-testi-1.md)

## Näkymät

| Reitti | Kuka | Huomioita |
|---|---|---|
| `/` | Kävijä (QR) | `?kieli=fi\|en` |
| `/?kiosk=ipad-1` | iPad-kioski | Vaatii kioskiavaimen (ks. [Kioskit](#4-kioskit)). Nollautuu käyttämättömyyden jälkeen, kämmenen hylkäys Apple Pencilillä |
| `/moderointi` | Moderaattorit | Kirjautuminen sähköpostilla ja salasanalla |
| `/naytto` | LED-screen (Resolume) | `?layout=avaruus\|trio\|solo\|seina` (oletus avaruus) · `?vaihto=12` · `?maara=6` · `?qr=0` · `?osoite=…` · `?qr-url=…` · `?skaala=1` · `?tunnus=led-1` · `?uudelleenlataus=240` · `?silta=http://localhost:7400` · `?avain=…` (kerran, ks. [Näytöt](#6-näytöt)) |
| `/keynote` | Keynote-puhuja (iPad + Apple Pencil) | Kirjautuminen (esiintyjät ja moderaattorit). `?lava=lava-1` · `?suhde=16:9` (oletus: koko ruutu) · `?video=1` (esitysmateriaali taustaksi) · `?kieli=fi\|en`. Ks. [Keynote](#5-keynote) |
| `/keynote/naytto` | Keynote-näyttö (projektori, screen tai Resolumen layer) | `?lava=lava-1` · `?tila=1` (yhteyden tila kulmassa) · `?lapinakyva=1` (läpinäkyvä tausta) |
| `/keynote/lahetin` | Kaappauskone | Kirjautuminen. Esitysmateriaali kaappauslaitteelta tai ruudunjaosta editorin taustaksi. `?lava=lava-1` |
| `POST /api/piirrokset` | Piirtonäkymä | Validointi, kioskiavain, Turnstile ja rate limit, tallentaa piirroksen moderointijonoon |

## Käyttöönotto

### 1. Supabase

1. Luo projekti osoitteessa [supabase.com](https://supabase.com) **EU-alueelle** (esim. Frankfurt tai Tukholma).
2. Avaa **SQL Editor** ja aja kansion [`supabase/migrations/`](supabase/migrations) tiedostot numerojärjestyksessä (`0001_…` – `0005_…`).
3. Luo moderaattorit kohdassa **Authentication → Users → Add user** (sähköposti ja salasana, "Auto Confirm User").
4. Anna käyttäjille moderointioikeus SQL-editorissa:

   ```sql
   insert into public.moderaattorit (kayttaja, nimi)
   select id, 'Etunimi' from auth.users where email = 'moderaattori@example.com';
   ```

### 2. Ympäristömuuttujat

Kopioi `.env.example` tiedostoksi `.env.local` ja täytä arvot. Supabasen arvot löytyvät kohdasta **Project Settings → API**:

| Muuttuja | Mistä |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` / secret key. **Vain palvelimelle, ei koskaan selaimeen tai repoon.** |
| `LAITE_SUOLA` | Oma satunnainen merkkijono, esim. `openssl rand -hex 32` |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY` | Turnstile-widgetin sitekey. Kehityksessä Cloudflaren testiavain `1x00000000000000000000AA` |
| `TURNSTILE_SECRET` | Turnstile-widgetin secret key. Kehityksessä testiavain `1x0000000000000000000000000000000AA`. **Vain palvelimelle.** |
| `TURNSTILE_HOSTNAMES` | Piirtonäkymän hostnimet pilkuilla eroteltuina. Testiavaimilla `example.com`, tuotannossa oma domain (ei localhostia) |
| `KIOSKI_SALAISUUS` | Oma satunnainen merkkijono, josta kioskiavaimet lasketaan. **Vain palvelimelle.** |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys. Tekoälyesisuodatus. Ilman sitä piirrokset menevät jonoon ilman arviota. **Vain palvelimelle.** |

Ilman Turnstile-muuttujia lähetys-API vastaa `503` (tarkistus ei koskaan aukea itsestään).
Vercelin tuotannossa (`VERCEL_ENV=production`) testiavainten tuloksia ei hyväksytä, joten tuotantoon tarvitaan
oma widget: **Cloudflare dashboard → Turnstile → Add widget**, tila *Managed*, domainiksi tuotantodomain.

### 3. Kehitys

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # yksikkötestit (validointi, jonologiikka, rate limit)
npm run typecheck
```

### 4. Kioskit

Kioskin väljempi rate limit (150 lähetystä tunnissa) vaatii kioskikohtaisen avaimen, jottei kuka tahansa
voi lähettää `lahde: "ipad-1"` ja ohittaa puhelimien rajaa. Avain lasketaan `KIOSKI_SALAISUUS`-arvosta,
joten sitä ei tallenneta minnekään.

```bash
npm run kioskiavain -- --osoite https://raapustamo.fi ipad-1 ipad-2
```

Avaa tulostettu asennusosoite kerran kunkin iPadin Safarissa. Avain tallentuu laitteelle ja katoaa
osoiteriviltä, joten Guided Accessin kotisivuksi riittää `…/?kiosk=ipad-1`. Jos avain puuttuu tai on väärä,
kioski näyttää lähetettäessä virheen "Kioskia ei ole tunnistettu". Avaa silloin asennusosoite uudelleen.
`KIOSKI_SALAISUUS`-arvon vaihtaminen mitätöi kaikkien kioskien avaimet.

Tunnistettu kioski saa oman rate limit -laskurinsa. Se ei siis jaa laskuria saman festivaaliverkon puhelinten kanssa.

### 5. Keynote

Keynote-puhuja piirtää iPadilla koko ruudun kokoiselle alustalle, ja viivat piirtyvät keynote-näytölle
reaaliajassa jo vedon aikana. Piirrokset eivät kulje moderoinnin kautta, joten editori vaatii kirjautumisen.

1. Aja migraatio `0003_keynote.sql`.
2. Luo esiintyjälle (tai iPadille) tunnus kohdassa **Authentication → Users → Add user** ja anna sille keynote-oikeus.
   Moderaattoreilla oikeus on jo valmiiksi.

   ```sql
   insert into public.esiintyjat (kayttaja, nimi)
   select id, 'Keynote-iPad' from auth.users where email = 'keynote@example.com';
   ```

3. Avaa näyttökoneella `/keynote/naytto?lava=lava-1` ja iPadilla `/keynote?lava=lava-1`. Kirjaudu iPadilla kerran,
   ja lisää sivu Safarin jakovalikosta **Koti-valikkoon**, jolloin editori aukeaa koko ruudulle ilman Safarin palkkeja.
4. Tarkista oikeudet: `npm run keynote-tarkistus`. Kirjautumaton näyttö saa kuunnella kanavaa, mutta sen
   lähettämät viivat eivät saa päätyä näytölle.

Editorissa:

- Alusta täyttää ruudun, ja näyttö sovittaa sen samaan kuvasuhteeseen (mustat reunat tarvittaessa). Jos näytön
  kuvasuhde on tiedossa, sen voi pakottaa: esim. `?suhde=16:9` tai LED-screenille `?suhde=4032x1152`.
- Tyhjä alusta seuraa iPadin asentoa. Kun alustalle on piirretty, kuvasuhde pysyy, kunnes alusta tyhjennetään.
- Kämmenen hylkäys: kun Apple Pencil on havaittu, sormet eivät piirrä. ⌘Z / ⇧⌘Z toimivat näppäimistöllä.
- Silmä-napista piirroksen saa piilotettua näytöltä (näyttö häivyttää sen pois). Piilotettuna editorin reunat ovat oranssit.
- Tyhjennys vaatii toisen napautuksen, ja senkin voi kumota.
- Vasemmassa alakulmassa näkyy yhteyden tila (punainen piste = näytöllä) ja keynote-näytön syke.
- Paletissa on LED-värien lisäksi musta, yönsininen ja metsänvihreä vaaleiden diojen päälle piirtämiseen.

#### Piirtäminen esitysmateriaalin päälle

Yleisön kuva yhdistetään Resolumessa, ja esitysmateriaali näkyy iPadilla vain piirtäjälle:

```
Esityskone / Resolume ──HDMI──► kaappauskortti ──USB──► kaappauskone (Chrome: /keynote/lahetin)
                                                          │ WebRTC suoraan lähiverkossa
                                                          ▼
                                          iPad (Wi-Fi): /keynote?video=1 – video alustan alla
Resolume: esitysmateriaali + /keynote/naytto?lapinakyva=1 läpinäkyvänä layerina päällä
```

1. Aja migraatio `0004_keynote_video.sql` (videon yhteydenmuodostuksen kanava, vain esiintyjät ja moderaattorit).
2. Kaappauskoneella: avaa `/keynote/lahetin?lava=lava-1`, kirjaudu ja valitse lähde. Kaappauskortti näkyy kamerana
   (nimet tulevat näkyviin napista *Näytä laitteiden nimet*). Vaihtoehtoisesti *Jaa ruutu tai ikkuna*, jolloin esityskone
   voi itse toimia lähettimenä. *Testikuva* (ruudukko ja kello) tarkistaa yhteyden, kohdistuksen ja viiveen ilman
   kaappauslaitetta: kuvaa lähettimen ja iPadin kellot samaan kuvaan.
3. iPadilla: `/keynote?lava=lava-1&video=1`. Tyhjä alusta ottaa videon kuvasuhteen (ennen videon tuloa 16:9), jolloin
   piirros osuu Resolumessa samaan kohtaan. Jos alustalle on jo piirretty eri kuvasuhteella, editori pyytää tyhjentämään sen.
4. Resolumessa keynote-näyttö layeriksi esitysmateriaalin päälle: `/keynote/naytto?lava=lava-1&lapinakyva=1`
   selainlähteestä, joka välittää alfakanavan (OBS:n browser source → Spout/Syphon/NDI, tai SpoutBrowser). Jos alfa
   katoaa matkalla, käytä mustaa taustaa (ilman `?lapinakyva`) ja Add/Screen-sekoitusta: silloin vaaleilla dioilla
   tummat ja vaaleat viivat eivät kuitenkaan erotu oikein.

Verkko: lavalle oma 5 GHz:n Wi-Fi (jossa on internet Supabasea varten) ja kaappauskone siihen kaapelilla.
Festivaalin yleisessä verkossa laitteiden välinen eristys (client isolation) estää suoran yhteyden. Silloin tarvitaan
TURN-palvelin (esim. coturn kaappauskoneella): `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_KAYTTAJA` ja
`NEXT_PUBLIC_TURN_SALASANA`. Lähettimen *Editorit*-listassa näkyvät yhdistetyt iPadit, bittinopeus ja viive.

### 6. Näytöt

Näyttöjen syke vaatii näyttökohtaisen avaimen, jottei kukaan muu voi lähettää sykettä näytön nimissä.

```bash
npm run nayttoavain -- --osoite https://www.raapustamo.fi led-1 keynote-lava-1
```

Skripti tulostaa jokaiselle näytölle asennusosoitteen ja rekisteröinnin SQL:n. Aja SQL Supabasen SQL-editorissa ja avaa
asennusosoite kerran näytön selaimessa (lisää muut parametrit, esim. `&skaala=1&silta=…`). Avain tallentuu laitteelle ja
poistuu osoiteriviltä. Uusi ajo luo uudet avaimet, ja vanhat lakkaavat toimimasta.

## Arkkitehtuuri lyhyesti

- **Next.js** (App Router), hostaus **Vercel**. Funktiot ajetaan Dublinissa (`dub1`, [vercel.json](vercel.json)) Supabase-projektin (`eu-west-1`, Irlanti) vieressä. Jos Supabase-projekti vaihtuu toiselle alueelle, vaihda myös tämä.
- **Supabase**: Postgres, RLS, Auth ja Realtime.
  - Uudet piirrokset kulkevat vain API-reitin kautta (service role).
  - Anonyymit käyttäjät näkevät vain hyväksytyt piirrokset.
  - Vain `moderaattorit`-taulun käyttäjät voivat moderoida.
- **Näyttö**:
  - Oletuslayout on **avaruus** ([src/components/naytto/avaruus.ts](src/components/naytto/avaruus.ts), laskenta [src/lib/avaruus.ts](src/lib/avaruus.ts)): `?maara=6` piirrosta ajelehtii tähtikentässä eri kokoisina ja syvyyksissä. Uusi piirros syntyy `vaihto / 3` sekunnin välein vapaimpaan kohtaan, ja se glitchaa pois kuljettuaan oman matkansa (noin `maara × vaihto / 3` sekuntia). Nostetut ovat isompia, eli lähempänä. Kun näyttö on tauolla tai klippi ei ole screenillä, aika pysähtyy.
  - Hätäpysäytys tulee voimaan heti. Paluu animoidaan: taukoruutu glitchaa, sulkeutuu valoviivaksi ja sammuu, tähdet syöksyvät hyperavaruusefektinä ja piirrokset piirtyvät uudelleen esiin. Kehityksessä tauon voi kokeilla konsolista: `raapustamo.tauko(true)`.
  - Hyväksytyt piirrokset tulevat Realtime-muutoksina.
  - Hylkäys, piilotus ja hätäpysäytys tulevat näytölle lisäksi Realtime-broadcastina, koska RLS piilottaa hylätyt rivit anonyymeiltä. `naytto`-kanava on yksityinen: näytöt saavat kuunnella, mutta vain moderaattorit lähettää.
  - Data ja hätäpysäytyksen tila tarkistetaan tietokannasta 20 sekunnin välein, joten saamatta jäänyt komento korjaantuu viimeistään silloin.
  - Hyväksytyt piirrokset tallennetaan selaimen välimuistiin, ja Service Worker (`public/naytto-sw.js`, vain tuotannossa) tallentaa sivun ja sen tiedostot. Näyttö käynnistyy siis uudelleen myös ilman verkkoa.
  - Näyttö lähettää 30 sekunnin välein sykkeen, joka näkyy moderoinnin yläpalkissa: sininen = ok, oranssi = viive, verkkokatko tai virheitä, punainen = ei vastaa.
  - Näyttö palautuu itse: jos animaatio jumittuu yli 30 sekunniksi tai virheitä tulee yli 20 minuutissa, sivu ladataan uudelleen.
  - Resolume-silta ([silta/](silta/README.md)) tahdistaa kierron karuselliin. Piirrokset vaihtuvat ja näyttökerrat kirjataan vain, kun Raapustamo-klippi on screenillä.
- **Lähetykset**: palvelin tarkistaa piirroksen rakenteen, kioskin avaimen ja Cloudflare Turnstile -tunnisteen (siteverify: `success`, action `piirros` ja hostname) ennen rate limitiä. Widget on vahvistusdialogissa ja näkyy vain, jos Cloudflare vaatii vuorovaikutusta.
- **Tekoälyesisuodatus** ([src/lib/ai-arvio.ts](src/lib/ai-arvio.ts)):
  - Lähetyksen jälkeen (`after()`, kävijä ei odota) palvelin piirtää vektoreista 768 × 768 px:n PNG-kuvan ([src/lib/esikatselu.ts](src/lib/esikatselu.ts), resvg).
  - Claude Haiku 5.5 luokittelee kuvan: `ok`, `epailyttava` tai `sopimaton`, varmuus ja lyhyt syy suomeksi. Arvio tallentuu kenttään `ai_arvio`, ja moderointi saa sen Realtimella.
  - Moderoinnissa epäilyttävät ja sopimattomat näkyvät jonossa ensin, ja sopimattomat sumennetaan. **Tekoäly ei koskaan hyväksy eikä hylkää itse.**
  - Jos tekoäly ei vastaa tai avain puuttuu, piirros menee jonoon ilman arviota. Mallin kieltäytyminen merkitään epäilyttäväksi.
  - Kustannus noin 0,2–0,3 $ tuhatta piirrosta kohden. Piirroksen kuva lähetetään Anthropicille (Yhdysvallat), mikä pitää mainita tietosuojaselosteessa.
- **Keynote** ([src/lib/keynote.ts](src/lib/keynote.ts), [src/components/keynote/](src/components/keynote)):
  - Viivat kulkevat Realtime-broadcastina yksityisellä kanavalla `keynote:<lava>`: alku, uudet pisteet noin 25 kertaa sekunnissa ja valmis viiva kokonaisena. Realtime Authorization -politiikat (`realtime.messages`) sallivat kuuntelun kaikille mutta lähettämisen vain esiintyjille ja moderaattoreille. Samanniminen julkinen kanava on eri kanava.
  - Editori tallentaa lavan tilan `lavat`-tauluun muutosten jälkeen (enintään 0,7 s viiveellä), joten editori ja näyttö palautuvat uudelleenlatauksesta.
  - Valmiit muutokset (viiva, kumoaminen, tyhjennys, piilotus) ovat versioituja. Jos näytöltä puuttuu versioita, se hakee tallennetun tilan. Tallennuksen jälkeen editori lähettää versionumeron, ja näyttö tarkistaa version lisäksi 20 sekunnin välein.
  - Keynote-näyttö lähettää sykkeen tunnuksella `keynote-<lava>`. Syke näkyy moderoinnin yläpalkissa ja editorissa.
  - Esitysmateriaalin video ([src/components/keynote/video.ts](src/components/keynote/video.ts)) kulkee WebRTC:llä suoraan lähettimeltä iPadille. Yhteydenmuodostus (tarjous, vastaus ja ICE-ehdokkaat) kulkee yksityisellä kanavalla `keynote-video:<lava>`, jota anonyymit eivät näe, koska viesteissä on lähiverkon osoitteita. Selain ei saa hakea paikallisesta http-osoitteesta HTTPS-sivulla, joten erillistä mediapalvelinta ei käytetä. Video: H.264 ensin (iPadin rautapurku), enintään 6 Mbit/s ja 30 fps, `contentHint: detail` ja `maintain-resolution`, jotta diojen teksti pysyy terävänä.
  - Kehityksessä ilman Supabasea editori, näyttö ja lähetin toimivat saman selaimen välilehdissä (BroadcastChannel ja localStorage).
- **Piirrokset** tallennetaan vektoreina (`viivat`, koordinaatit 0–1), joten ne skaalautuvat mihin kokoon tahansa ja voivat piirtyä screenille animaationa.

## Seuraavaksi

- Screen-testi oikealla LED-screenillä ja Resolumella
- Verkkogalleria
- Tilastot ja vienti
