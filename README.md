# Raapustamo

Lumo Art & Tech Festivalin piirrettävä vieraskirja. Kävijät piirtävät puhelimella tai
iPad-kioskilla, moderaattorit hyväksyvät piirrokset, ja hyväksytyt piirrokset näkyvät
10,5 × 3 m LED-screenillä (4032 × 1152 px) osana Resolumen mainoskarusellia.

- Suunnitelma: [docs/kehityssuunnitelma.md](docs/kehityssuunnitelma.md)
- Resolume-silta: [silta/](silta/README.md)
- Ilmeprototyypit: [prototyypit/](prototyypit/README.md)
- Kuvat tuottajalle: [docs/kuvat/](docs/kuvat)

## Näkymät

| Reitti | Kuka | Huomioita |
|---|---|---|
| `/` | Kävijä (QR) | `?kieli=fi\|en` |
| `/?kiosk=ipad-1` | iPad-kioski | Vaatii kioskiavaimen (ks. [Kioskit](#4-kioskit)). Nollautuu käyttämättömyyden jälkeen, kämmenen hylkäys Apple Pencilillä |
| `/moderointi` | Moderaattorit | Kirjautuminen sähköpostilla ja salasanalla |
| `/naytto` | LED-screen (Resolume) | `?layout=avaruus\|trio\|solo\|seina` (oletus avaruus) · `?vaihto=12` · `?maara=6` · `?qr=0` · `?osoite=…` · `?qr-url=…` · `?skaala=1` · `?tunnus=led-1` · `?uudelleenlataus=240` · `?silta=http://localhost:7400` |
| `POST /api/piirrokset` | Piirtonäkymä | Validointi, kioskiavain, Turnstile ja rate limit, tallentaa piirroksen moderointijonoon |

## Käyttöönotto

### 1. Supabase

1. Luo projekti osoitteessa [supabase.com](https://supabase.com) **EU-alueelle** (esim. Frankfurt tai Tukholma).
2. Avaa **SQL Editor** ja aja kansion [`supabase/migrations/`](supabase/migrations) tiedostot numerojärjestyksessä (`0001_…`, `0002_…`).
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
  - Hylkäys, piilotus ja hätäpysäytys tulevat näytölle lisäksi Realtime-broadcastina (`naytto`-kanava), koska RLS piilottaa hylätyt rivit anonyymeiltä.
  - Data tarkistetaan 20 sekunnin välein.
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
- **Piirrokset** tallennetaan vektoreina (`viivat`, koordinaatit 0–1), joten ne skaalautuvat mihin kokoon tahansa ja voivat piirtyä screenille animaationa.

## Seuraavaksi

- Screen-testi oikealla LED-screenillä ja Resolumella
- Verkkogalleria
- Tilastot ja vienti
