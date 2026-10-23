# Kestotesti

Tavoite: varmistaa, että LED-näyttö pyörii 12 tuntia ilman muistivuotoja, nykimistä, kaatumisia tai vahtikoiran
uudelleenlatauksia. Kuuluu vaiheeseen 4. Ensimmäinen ajo kannattaa tehdä yön yli ennen screen-testiä.

## Miten testi toimii

- Näyttö ajetaan **demotilassa** (`/naytto?demo=40`):
  - 40 generoitua piirrosta, ilman tietokantaa
  - 30 sekunnin välein uusi "hyväksytty" piirros ja vanhin pois
  - 15 minuutin välein hätäpysäytys ja paluu
  - Näin testi käy läpi samat polut kuin festivaalilla. Demotila ei lähetä sykettä, ei kirjaa näyttökertoja eikä kirjoita
    playout-koneen välimuistiin. Kulmassa näkyy oranssi DEMO-merkki.
- [`scripts/kestotesti.mjs`](../../scripts/kestotesti.mjs) käynnistää Chromen ja mittaa minuutin välein:
  - JS-muisti
  - DOM-solmut ja tapahtumankuuntelijat
  - kuvataajuus
  - renderöinti- ja GPU-prosessin muisti ja suoritinkäyttö
  - uudelleenlataukset, kaatumiset ja konsolin virheet
- Tulokset: `kestotesti-tulokset/<aika>/`
  - `mittaukset.csv`
  - `virheet.log`
  - kuvakaappaukset (5 min, sitten tunnin välein)
  - `yhteenveto.json`
- Lopuksi yhteenveto:
  - **OK**: muistin kasvu alle 5 Mt/h kymmenen ensimmäisen minuutin jälkeen, kuvataajuuden mediaani vähintään 30 fps,
    ei uudelleenlatauksia, kaatumisia eikä virheitä
  - muuten **TARKISTA** ja syyt

## Ajo yön yli (tällä koneella)

```bash
npm run build
```

```bash
npm start
```

Toisessa terminaalissa:

```bash
npm run kestotesti
```

Oletus: 12 h, `http://localhost:3000/naytto?demo=40&skaala=1`, näkymätön Chrome 4032 × 1152. Ctrl+C lopettaa ajon
ja tekee yhteenvedon. Kone ei saa mennä lepotilaan (macOS: `caffeinate -i npm run kestotesti`).

Valitsimet: `--tunnit 12` · `--vali 60` (s) · `--url …` · `--leveys 4032 --korkeus 1152` · `--nakyva` ·
`--chrome <polku>` · `--kansio kestotesti-tulokset`

## Ajo playout-koneella

Näkymätön Chrome renderöi ilman näytönohjainta. Muistivuodot näkyvät sillä luotettavasti, mutta kuvataajuus ei vastaa
playout-konetta. Kuvataajuus mitataan näkyvällä Chromella playout-koneella tai sitä vastaavalla koneella:

```bash
npm run kestotesti -- --nakyva --url "https://www.raapustamo.fi/naytto?demo=40"
```

Lopullinen kestotesti tehdään kenraaliharjoituksen yhteydessä oikealla kuvaputkella (SpoutBrowser tai OBS → Resolume).
Silloin mitataan myös Spoutin/Syphonin ja Resolumen kuorma, mitä tämä skripti ei näe.

## Tulokset

| Päivä | Kone | Kesto | Muistin kasvu | FPS (mediaani / min) | Lataukset / virheet | Tulos |
|---|---|---|---|---|---|---|
| 23.10. | MacBook, näkymätön (savutesti) | 3 min | – (liian lyhyt) | 60 / 59 | 0 / 0 | skripti toimii |
| | | | | | | |
