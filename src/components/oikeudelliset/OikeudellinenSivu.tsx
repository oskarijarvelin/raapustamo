import type { Kieli } from "@/lib/tyypit";
import { Kayttoehdot, Tietosuojaseloste, type OikeudellinenSivu as Sivu } from "./Oikeudelliset";
import "./oikeudelliset.css";

const OSOITTEET: Record<Sivu, string> = { ehdot: "/ehdot", tietosuoja: "/tietosuoja" };
const osoite = (sivu: Sivu, kieli: Kieli) => (kieli === "fi" ? OSOITTEET[sivu] : `${OSOITTEET[sivu]}?kieli=en`);

/** Käyttöehtojen tai tietosuojaselosteen oma sivu (/ehdot, /tietosuoja). */
export default function OikeudellinenSivu({ sivu, kieli }: { sivu: Sivu; kieli: Kieli }) {
  const toinen = kieli === "fi" ? "en" : "fi";
  return (
    <div className="oikeudellinen-sivu" lang={kieli}>
      <header className="ylapalkki">
        <a className="tuotemerkki" href={kieli === "fi" ? "/" : "/?kieli=en"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-merkki" src="/brand/latf-merkki.png" alt="Lumo Art & Tech Festival" />
          <span className="erotin" aria-hidden="true" />
          <span className="ylaotsikko">Raapustamo</span>
        </a>
        <a className="siru" href={osoite(sivu, toinen)} hrefLang={toinen}>
          {toinen.toUpperCase()}
        </a>
      </header>
      <main>
        {sivu === "ehdot" ? <Kayttoehdot kieli={kieli} /> : <Tietosuojaseloste kieli={kieli} />}
        <nav>
          <a href={osoite("ehdot", kieli)}>{kieli === "fi" ? "Käyttöehdot" : "Terms of use"}</a>
          <a href={osoite("tietosuoja", kieli)}>{kieli === "fi" ? "Tietosuojaseloste" : "Privacy notice"}</a>
          <a href={kieli === "fi" ? "/" : "/?kieli=en"}>{kieli === "fi" ? "Piirtämään" : "Start drawing"}</a>
        </nav>
      </main>
    </div>
  );
}
