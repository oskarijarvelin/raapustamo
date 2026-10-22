# Raapustamo

Lumo Art & Tech Festivalin piirrettävä vieraskirja. Kävijät piirtävät puhelimella tai
iPad-kioskilla, moderaattorit hyväksyvät piirrokset, ja hyväksytyt piirrokset näkyvät
10,5 × 3 m LED-screenillä (4032 × 1152 px) osana Resolumen mainoskarusellia.

- Suunnitelma: [docs/kehityssuunnitelma.md](docs/kehityssuunnitelma.md)
- Ilmeprototyypit: [prototyypit/](prototyypit/README.md)
- Kuvat tuottajalle: [docs/kuvat/](docs/kuvat)

## Näkymät

| Reitti | Kuka | Huomioita |
|---|---|---|
| `/` | Kävijä (QR) | `?kieli=fi\|en` |
| `/?kiosk=ipad-1` | iPad-kioski | Nollautuu käyttämättömyyden jälkeen, kämmenen hylkäys Apple Pencilillä |
| `/moderointi` | Moderaattorit | Kirjautuminen sähköpostilla ja salasanalla |
| `/naytto` | LED-screen (Resolume) | `?layout=trio\|solo\|seina` · `?vaihto=12` · `?qr=0` · `?osoite=…` · `?qr-url=…` · `?skaala=1` · `?tunnus=led-1` · `?uudelleenlataus=240` |
| `POST /api/piirrokset` | Piirtonäkymä | Validointi ja rate limit, tallentaa piirroksen moderointijonoon |

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

Kopioi `.env.example` tiedostoksi `.env.local` ja täytä arvot. Ne löytyvät Supabasen kohdasta **Project Settings → API**:

| Muuttuja | Mistä |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` / secret key. **Vain palvelimelle, ei koskaan selaimeen tai repoon.** |
| `LAITE_SUOLA` | Oma satunnainen merkkijono, esim. `openssl rand -hex 32` |

### 3. Kehitys

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # yksikkötestit (validointi, jonologiikka, rate limit)
npm run typecheck
```

## Arkkitehtuuri lyhyesti

- **Next.js** (App Router), hostaus **Vercel** EU-alueella.
- **Supabase**: Postgres, RLS, Auth ja Realtime.
  - Uudet piirrokset kulkevat vain API-reitin kautta (service role).
  - Anonyymit käyttäjät näkevät vain hyväksytyt piirrokset.
  - Vain `moderaattorit`-taulun käyttäjät voivat moderoida.
- **Näyttö**:
  - Hyväksytyt piirrokset tulevat Realtime-muutoksina.
  - Hylkäys, piilotus ja hätäpysäytys tulevat näytölle lisäksi Realtime-broadcastina (`naytto`-kanava), koska RLS piilottaa hylätyt rivit anonyymeiltä.
  - Data tarkistetaan 20 sekunnin välein.
  - Hyväksytyt piirrokset tallennetaan selaimen välimuistiin, ja Service Worker (`public/naytto-sw.js`, vain tuotannossa) tallentaa sivun ja sen tiedostot. Näyttö käynnistyy siis uudelleen myös ilman verkkoa.
  - Näyttö lähettää 30 sekunnin välein sykkeen, joka näkyy moderoinnin yläpalkissa: sininen = ok, oranssi = viive, verkkokatko tai virheitä, punainen = ei vastaa.
  - Näyttö palautuu itse: jos animaatio jumittuu yli 30 sekunniksi tai virheitä tulee yli 20 minuutissa, sivu ladataan uudelleen.
- **Piirrokset** tallennetaan vektoreina (`viivat`, koordinaatit 0–1), joten ne skaalautuvat mihin kokoon tahansa ja voivat piirtyä screenille animaationa.

## Seuraavaksi (vaihe 3)

- Tekoälyesisuodatus moderointiin (`ai_arvio`)
- Resolume-silta (OSC/REST → WebSocket)
- Kioskien oma tunniste (nyt `?kiosk=` antaa väljemmän rate limitin)
- Botintorjunta (Turnstile)
- Verkkogalleria
