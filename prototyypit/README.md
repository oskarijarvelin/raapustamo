# Raapustamo – ilmeprototyypit

Klikattavat HTML-prototyypit Raapustamon kolmelle näkymälle LA&TF:n brändiohjeistuksen
("Glitch in the Reality") mukaan. Näkymät jakavat demodatan selaimen `localStorage`n ja
`BroadcastChannel`in kautta, joten piirros kulkee piirtonäkymästä moderointiin ja screenille
samassa selaimessa ilman taustapalvelua. Tuotannossa tilalle tulee Supabase (ks.
[kehityssuunnitelma](../docs/kehityssuunnitelma.md)).

## Käynnistys

```bash
python3 -m http.server 5173 --directory prototyypit
```

Avaa <http://localhost:5173/>. ES-moduulit eivät toimi `file://`-osoitteesta.

| Näkymä | Tiedosto | Huomioita |
|---|---|---|
| Piirtäminen | `piirra.html` | Puhelin pystyssä, iPad vaakatasossa (työkalut sivupaneelissa). `?kiosk=ipad-1` = kioskitila |
| Moderointi | `moderointi.html` | `←`/`H` hylkää, `→`/`A` hyväksy, `N` nosta, välilyönti toistaa piirtymisen, pyyhkäisy kosketuksella |
| Näyttö | `naytto.html` | `?layout=trio\|solo\|seina`, `?vaihto=12` (s), `?qr=0`, `?osoite=…`, `?qr-url=…`, `?skaala=1` (natiivi 1:1) |

## Brändi → käyttöliittymä

- **Musta ja valkoinen** ovat pääväreinä. Ensisijainen nappi on valkoinen pill-nappi mustalla tekstillä, kuten brändiohjeen mobiiliesimerkissä.
- **Oulu 2026 -värit** ovat käytössä korostuksina ja piirrosmusteina. Moderoinnissa sininen tarkoittaa OK:ta, oranssi epäilyttävää ja punainen sopimatonta.
- **Typografia:** otsikot ovat Oulu2026 Bold -fontilla versaaleina, leipäteksti Poppinsilla.
- **Supergrafiikka:** logon kirjaimet isona harmaana (#212121) taustalla, kuten brändiohjeen sivuilla.
- **Glitch** näkyy positiivisena efektinä: otsikoissa satunnaisena säröilynä ja näytöllä piirrosten vaihtuessa vaakakaistojen siirtymänä. Valmiissa piirroksissa on lisäksi harvakseltaan pieni mikroglitch.
- **LED-säännöt:** kaikkialla on musta tausta. Viivan vähimmäisleveys screenillä on 8 px. Oulu 2026 -värien tummat sävyt (metsänvihreä #185636 ja yönsininen #002D58) on korvattu piirrosmusteissa vaalennetuilla LED-sävyillä (#3E9E6A ja #3F86D1), koska tummat sävyt katoavat mustaan.

## Väliaikaista – korvataan tuotannon aineistolla

- [ ] **Logot:** `assets/latf-*.png` on irrotettu brändiohjeen PDF:stä esikatselua varten. Ne korvataan alkuperäisillä SVG-tiedostoilla, koska ohjeen mukaan "tunnus tulee aina toisintaa valmiista originaalitiedostosta".
- [ ] **Oulu2026-fontti:** tiedostot puuttuvat, joten otsikoissa näkyy nyt Poppins Bold. Tiedostot lisätään kansioon `assets/fonts/`, ja niiden `url()` lisätään `brand.css`:n `@font-face`-sääntöihin. Jos fontti on asennettu koneelle, se on jo nyt käytössä.
- [ ] **Oulu 2026 -värikoodit** on poimittu PDF:n kuvasta. Viralliset arvot varmistetaan tuotannolta.
- [ ] **Käyttöehdot:** linkki ja teksti puuttuvat vielä.
- [ ] **Kirjastot** ladataan nyt CDN:stä (`perfect-freehand`, `qrcode-generator`). Näytön offline-toimintaa varten ne pitää paketoida sovellukseen.
- [ ] **Väripaletti, viivanleveydet ja tekstikoot** tarkistetaan screen-testissä #1 oikealla LED-screenillä.
