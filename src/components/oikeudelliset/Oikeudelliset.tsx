// Käyttöehdot ja tietosuojaseloste (fi/en). Samat sisällöt näytetään omilla sivuillaan (/ehdot,
// /tietosuoja) ja piirtonäkymän ikkunassa, jottei piirros katoa ehtoja luettaessa.
//
// LUONNOS: järjestäjän (ja tarvittaessa lakimiehen) tarkistettava ennen festivaalia. Avoimet kohdat
// näkyvät sivulla korostettuina (<Avoin>):
// - rekisterinpitäjä, Y-tunnus, osoite ja yhteystiedot
// - verkkogallerian kesto ja mitä sen jälkeen tapahtuu
// - hylättyjen piirrosten ja laitetunnisteiden säilytysajat (ehdotus: 30 vrk ja festivaalin loppu)
// - käsittelyperusteet ja EU:n ulkopuolisten siirtojen perusteet (Vercel, Cloudflare, Anthropic)
// - Anthropicin tietojen säilytys ja koulutuskäyttö (tarkistetaan ajantasaisista ehdoista)
// Kun teksti on hyväksytty, korvaa avoimet kohdat ja aseta LUONNOS = false.
import type { ReactNode } from "react";
import type { Kieli } from "@/lib/tyypit";

export const LUONNOS = true;
export const PAIVITETTY = "25.10.2026";

/** Vielä sopimaton kohta: näkyy luonnoksessa korostettuna. */
function Avoin({ children }: { children: ReactNode }) {
  return <mark className="avoin">[{children}]</mark>;
}

function Luonnos({ kieli }: { kieli: Kieli }) {
  if (!LUONNOS) return null;
  return (
    <p className="luonnos">
      {kieli === "fi"
        ? "Luonnos. Korostetut kohdat täydennetään ennen festivaalia."
        : "Draft. Highlighted items will be completed before the festival."}
    </p>
  );
}

export type OikeudellinenSivu = "ehdot" | "tietosuoja";

interface Props {
  kieli: Kieli;
  /** Piirtonäkymän ikkunassa linkki vaihtaa ikkunan sisällön, jottei piirros katoa sivulta poistuttaessa. */
  avaa?: (sivu: OikeudellinenSivu) => void;
}

function Tietosuojalinkki({ kieli, avaa, children }: Props & { children: ReactNode }) {
  if (avaa) {
    return (
      <button type="button" className="linkki" onClick={() => avaa("tietosuoja")}>
        {children}
      </button>
    );
  }
  return <a href={kieli === "fi" ? "/tietosuoja" : "/tietosuoja?kieli=en"}>{children}</a>;
}

export function Kayttoehdot({ kieli, avaa }: Props) {
  return kieli === "fi" ? (
    <article className="oikeudellinen">
      <h1 className="otsikko">Käyttöehdot</h1>
      <Luonnos kieli={kieli} />
      <p className="hiljainen">Päivitetty {PAIVITETTY}</p>
      <p>
        Raapustamo on Lumo Art &amp; Tech Festivalin piirrettävä vieraskirja. Palvelun tarjoaa <Avoin>järjestäjän nimi</Avoin>.
        Lähettämällä piirroksen hyväksyt nämä ehdot.
      </p>

      <h2>Mitä piirroksellesi tapahtuu</h2>
      <ul>
        <li>Jokainen piirros tarkistetaan ennen kuin se näytetään. Ihminen hyväksyy tai hylkää piirroksen, ja tekoäly auttaa järjestämään tarkistusjonoa.</li>
        <li>
          Hyväksytty piirros voidaan näyttää festivaalin LED-screenillä, festivaalin viestinnässä (esimerkiksi tapahtumasta otetuissa kuvissa,
          videoissa ja somessa) sekä festivaalin jälkeen verkkogalleriassa <Avoin>kuinka kauan</Avoin>.
        </li>
        <li>Emme lupaa, että piirros näytetään, emmekä sitä, milloin se näkyy.</li>
      </ul>

      <h2>Oikeudet piirrokseen</h2>
      <p>
        Piirros on sinun. Annat <Avoin>järjestäjälle</Avoin> maksuttoman ja ei-yksinomaisen oikeuden näyttää, tallentaa ja julkaista piirroksen
        edellä kuvatuissa käyttötarkoituksissa, myös muokattuna (esimerkiksi animaationa tai osana koostetta). Tekijää ei mainita, koska palvelu ei
        kysy nimiä.
      </p>

      <h2>Mitä ei saa piirtää</h2>
      <ul>
        <li>nimiä, puhelinnumeroita, osoitteita, somekäyttäjänimiä, verkko-osoitteita tai muita yhteystietoja</li>
        <li>mainoksia</li>
        <li>seksuaalista, väkivaltaista, vihaa lietsovaa tai muita loukkaavaa sisältöä</li>
        <li>toisten tekemiä teoksia, logoja tai tavaramerkkejä</li>
      </ul>
      <p>Moderaattori voi hylätä tai poistaa minkä tahansa piirroksen perustelematta.</p>

      <h2>Piirroksen poistaminen</h2>
      <p>
        Lähetyksen jälkeen saat tunnuksen (esimerkiksi #0042). Jos haluat piirroksesi pois screeniltä tai galleriasta, lähetä tunnus osoitteeseen{" "}
        <Avoin>sähköposti</Avoin>. Ilman tunnusta poistoa voi pyytää kuvailemalla piirroksen.
      </p>

      <h2>Palvelun käyttö</h2>
      <ul>
        <li>Palvelua ei saa kuormittaa automaattisesti eikä häiritä. Lähetysten määrää rajoitetaan.</li>
        <li>Palvelu tarjotaan sellaisenaan, ja se voi olla ajoittain poissa käytöstä.</li>
      </ul>

      <h2>Henkilötiedot</h2>
      <p>
        Henkilötietojen käsittelystä kerrotaan{" "}
        <Tietosuojalinkki kieli={kieli} avaa={avaa}>
          tietosuojaselosteessa
        </Tietosuojalinkki>
        .
      </p>

      <h2>Yhteystiedot</h2>
      <p>
        <Avoin>järjestäjän nimi, sähköposti</Avoin>
      </p>
    </article>
  ) : (
    <article className="oikeudellinen">
      <h1 className="otsikko">Terms of use</h1>
      <Luonnos kieli={kieli} />
      <p className="hiljainen">Updated {PAIVITETTY}</p>
      <p>
        Raapustamo is the drawable guestbook of Lumo Art &amp; Tech Festival, provided by <Avoin>organiser</Avoin>. By sending a drawing you accept
        these terms.
      </p>

      <h2>What happens to your drawing</h2>
      <ul>
        <li>Every drawing is reviewed before it is shown. A person approves or rejects it, and AI helps to order the review queue.</li>
        <li>
          An approved drawing may be shown on the festival LED screen, in the festival&apos;s communications (for example photos, videos and social media
          from the event) and, after the festival, in an online gallery for <Avoin>how long</Avoin>.
        </li>
        <li>We do not promise that your drawing will be shown, or when.</li>
      </ul>

      <h2>Rights to your drawing</h2>
      <p>
        Your drawing is yours. You grant <Avoin>the organiser</Avoin> a free, non-exclusive right to show, store and publish it for the purposes above,
        including in modified form (for example as an animation or part of a compilation). The author is not credited, as the service does not ask for
        names.
      </p>

      <h2>What not to draw</h2>
      <ul>
        <li>names, phone numbers, addresses, social media handles, web addresses or other contact details</li>
        <li>advertising</li>
        <li>sexual, violent, hateful or otherwise offensive content</li>
        <li>other people&apos;s works, logos or trademarks</li>
      </ul>
      <p>Moderators may reject or remove any drawing without giving a reason.</p>

      <h2>Removing your drawing</h2>
      <p>
        After sending, you get an ID (for example #0042). To have your drawing removed from the screen or the gallery, send the ID to <Avoin>email</Avoin>.
        Without the ID, you can request removal by describing the drawing.
      </p>

      <h2>Using the service</h2>
      <ul>
        <li>Do not overload the service with automated requests or disrupt it. The number of submissions is limited.</li>
        <li>The service is provided as is and may occasionally be unavailable.</li>
      </ul>

      <h2>Personal data</h2>
      <p>
        See the{" "}
        <Tietosuojalinkki kieli={kieli} avaa={avaa}>
          privacy notice
        </Tietosuojalinkki>
        .
      </p>

      <h2>Contact</h2>
      <p>
        <Avoin>organiser, email</Avoin>
      </p>
    </article>
  );
}

export function Tietosuojaseloste({ kieli }: Props) {
  return kieli === "fi" ? (
    <article className="oikeudellinen">
      <h1 className="otsikko">Tietosuojaseloste</h1>
      <Luonnos kieli={kieli} />
      <p className="hiljainen">Päivitetty {PAIVITETTY} · EU:n yleinen tietosuoja-asetus (2016/679), artiklat 13 ja 14</p>

      <h2>1. Rekisterinpitäjä</h2>
      <p>
        <Avoin>nimi, Y-tunnus, osoite</Avoin>, yhteyshenkilö <Avoin>nimi, sähköposti</Avoin>
      </p>

      <h2>2. Mitä tietoja käsitellään</h2>
      <p>Raapustamossa ei luoda käyttäjätiliä, eikä sinulta kysytä nimeä tai yhteystietoja.</p>
      <ul>
        <li>
          <strong>Piirros:</strong> viivat koordinaatteina, lähetysaika, lähde (oma laite tai festivaalin iPad) ja käyttöliittymän kieli. Piirroksessa
          on henkilötietoja vain, jos piirrät niitä itse. Siksi tällaiset piirrokset hylätään.
        </li>
        <li>
          <strong>Laitetunniste:</strong> IP-osoitteesta ja selaimen tunnisteesta salaisella avaimella laskettu tiiviste. Itse IP-osoitetta ei
          tallenneta. Tunnistetta käytetään vain lähetysten määrän rajoittamiseen.
        </li>
        <li>
          <strong>Botintorjunta:</strong> Cloudflare Turnstile tarkistaa lähetettäessä, että lähettäjä on ihminen. Cloudflare käsittelee tällöin
          muun muassa IP-osoitetta ja selaimen tietoja.
        </li>
        <li>
          <strong>Tekniset lokit:</strong> palvelimen lokeihin tallentuu tavanomaisia tietoja (esimerkiksi IP-osoite, aika ja selain) ylläpitoa ja
          tietoturvaa varten.
        </li>
        <li>
          <strong>Henkilökunta:</strong> moderaattoreiden ja esiintyjien sähköpostiosoite ja nimi kirjautumista varten.
        </li>
      </ul>
      <p>
        Palvelu ei käytä seuranta- eikä mainosevästeitä. Selaimeen tallennetaan vain palvelun toimintaan tarvittavia tietoja (esimerkiksi
        henkilökunnan kirjautuminen sekä kioskien ja näyttöjen avaimet).
      </p>

      <h2>3. Käsittelyn tarkoitukset ja perusteet</h2>
      <ul>
        <li>
          Piirrosten näyttäminen screenillä, festivaalin viestinnässä ja verkkogalleriassa käyttöehtojen mukaisesti <Avoin>peruste, esim. sopimus, art. 6.1 b</Avoin>.
        </li>
        <li>
          Moderointi, tekoälyesisuodatus, väärinkäytösten estäminen ja tietoturva: rekisterinpitäjän oikeutettu etu varmistaa, ettei julkiselle
          screenille päädy sopimatonta sisältöä ja että palvelu toimii (art. 6.1 f).
        </li>
      </ul>

      <h2>4. Vastaanottajat ja käsittelijät</h2>
      <ul>
        <li>Supabase: tietokanta (EU, Irlanti)</li>
        <li>Vercel: palvelimet ja sisällönjakelu (palvelimet Irlannissa, yhtiö Yhdysvalloissa)</li>
        <li>Cloudflare: botintorjunta (Turnstile)</li>
        <li>
          Anthropic: tekoälyesisuodatus (Yhdysvallat). Jokaisesta piirroksesta lähetetään kuva luokiteltavaksi. Kuvaan ei liitetä tunnistetietoja.{" "}
          <Avoin>säilytysaika ja koulutuskäyttö Anthropicin ehtojen mukaan</Avoin>
        </li>
        <li>Hyväksytyt piirrokset ovat julkisia: ne näkyvät screenillä ja verkkogalleriassa.</li>
      </ul>

      <h2>5. Siirrot EU:n ja ETA:n ulkopuolelle</h2>
      <p>
        Vercel, Cloudflare ja Anthropic ovat yhdysvaltalaisia yhtiöitä. Siirrot perustuvat <Avoin>EU–USA-tietosuojakehys tai vakiosopimuslausekkeet</Avoin>.
      </p>

      <h2>6. Säilytysajat</h2>
      <ul>
        <li>
          Hylätyt piirrokset poistetaan <Avoin>30 vuorokauden</Avoin> kuluessa.
        </li>
        <li>
          Laitetunnisteet poistetaan <Avoin>festivaalin päätyttyä</Avoin>.
        </li>
        <li>
          Hyväksytyt piirrokset säilytetään verkkogalleriassa <Avoin>kuinka kauan</Avoin>, minkä jälkeen ne <Avoin>arkistoidaan tai poistetaan</Avoin>.
        </li>
        <li>Tekniset lokit säilyvät palveluntarjoajien käytäntöjen mukaisesti.</li>
      </ul>

      <h2>7. Oikeutesi</h2>
      <p>
        Sinulla on oikeus saada tietoa käsittelystä, päästä tietoihisi sekä pyytää niiden oikaisua tai poistamista, rajoittaa käsittelyä ja vastustaa
        sitä. Piirrosta ei voi yhdistää sinuun ilman tunnusta, joten säilytä lähetyksen jälkeen näkyvä tunnus (esimerkiksi #0042). Pyynnöt:{" "}
        <Avoin>sähköposti</Avoin>.
      </p>
      <p>
        Voit tehdä valituksen tietosuojavaltuutetun toimistolle (<a href="https://tietosuoja.fi" target="_blank" rel="noreferrer">tietosuoja.fi</a>).
      </p>

      <h2>8. Muutokset</h2>
      <p>Selostetta päivitetään tarvittaessa. Päivityspäivä näkyy alussa.</p>
    </article>
  ) : (
    <article className="oikeudellinen">
      <h1 className="otsikko">Privacy notice</h1>
      <Luonnos kieli={kieli} />
      <p className="hiljainen">Updated {PAIVITETTY} · EU General Data Protection Regulation (2016/679), Articles 13 and 14</p>

      <h2>1. Controller</h2>
      <p>
        <Avoin>name, business ID, address</Avoin>, contact person <Avoin>name, email</Avoin>
      </p>

      <h2>2. What data is processed</h2>
      <p>Raapustamo has no user accounts and does not ask for your name or contact details.</p>
      <ul>
        <li>
          <strong>Drawing:</strong> the strokes as coordinates, the time of sending, the source (your own device or a festival iPad) and the interface
          language. A drawing only contains personal data if you draw it yourself, which is why such drawings are rejected.
        </li>
        <li>
          <strong>Device identifier:</strong> a hash calculated with a secret key from your IP address and browser identifier. The IP address itself is
          not stored. The identifier is only used to limit the number of submissions.
        </li>
        <li>
          <strong>Bot protection:</strong> Cloudflare Turnstile checks that the sender is human. Cloudflare processes data such as your IP address and
          browser information for this.
        </li>
        <li>
          <strong>Technical logs:</strong> server logs contain standard data (for example IP address, time and browser) for operation and security.
        </li>
        <li>
          <strong>Staff:</strong> the email address and name of moderators and performers for signing in.
        </li>
      </ul>
      <p>
        The service uses no tracking or advertising cookies. Only data needed for the service to work is stored in the browser (for example staff sign-in
        and kiosk and display keys).
      </p>

      <h2>3. Purposes and legal bases</h2>
      <ul>
        <li>
          Showing drawings on the screen, in festival communications and in the online gallery under the terms of use <Avoin>legal basis, e.g. contract, Art. 6(1)(b)</Avoin>.
        </li>
        <li>
          Moderation, AI pre-screening, preventing misuse and security: the controller&apos;s legitimate interest in keeping inappropriate content off a
          public screen and keeping the service running (Art. 6(1)(f)).
        </li>
      </ul>

      <h2>4. Recipients and processors</h2>
      <ul>
        <li>Supabase: database (EU, Ireland)</li>
        <li>Vercel: servers and content delivery (servers in Ireland, company in the United States)</li>
        <li>Cloudflare: bot protection (Turnstile)</li>
        <li>
          Anthropic: AI pre-screening (United States). An image of each drawing is sent for classification, with no identifying data attached.{" "}
          <Avoin>retention and training use according to Anthropic&apos;s terms</Avoin>
        </li>
        <li>Approved drawings are public: they are shown on the screen and in the online gallery.</li>
      </ul>

      <h2>5. Transfers outside the EU/EEA</h2>
      <p>
        Vercel, Cloudflare and Anthropic are US companies. Transfers are based on <Avoin>EU–US Data Privacy Framework or standard contractual clauses</Avoin>.
      </p>

      <h2>6. Retention</h2>
      <ul>
        <li>
          Rejected drawings are deleted within <Avoin>30 days</Avoin>.
        </li>
        <li>
          Device identifiers are deleted <Avoin>after the festival</Avoin>.
        </li>
        <li>
          Approved drawings are kept in the online gallery for <Avoin>how long</Avoin>, after which they are <Avoin>archived or deleted</Avoin>.
        </li>
        <li>Technical logs are kept according to the service providers&apos; policies.</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>
        You have the right to information, access, rectification and erasure, and to restrict or object to processing. A drawing cannot be linked to you
        without its ID, so keep the ID shown after sending (for example #0042). Requests: <Avoin>email</Avoin>.
      </p>
      <p>
        You can lodge a complaint with the Office of the Data Protection Ombudsman in Finland (<a href="https://tietosuoja.fi/en" target="_blank" rel="noreferrer">tietosuoja.fi</a>).
      </p>

      <h2>8. Changes</h2>
      <p>This notice is updated when needed. The date of the latest update is shown at the top.</p>
    </article>
  );
}
