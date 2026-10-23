"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import Kirjautuminen from "@/components/kirjautuminen/Kirjautuminen";
import {
  LAVAN_KOOT,
  OLETUSSUHDE,
  lavanNaytto,
  sallittuSuhde,
  sovitaAlusta,
  sovitaSuhteeseen,
  viivanId,
  type KeynoteViesti,
  type LavanViiva,
} from "@/lib/keynote";
import { KUMIN_VARI, MUSTEET, SIVELTIMET, piirraViiva } from "@/lib/piirto";
import { selainAsiakas } from "@/lib/supabase/selain";
import { sykkeenTila, type NaytonSyke } from "@/lib/syke";
import type { Kieli, KokoId, SivellinId } from "@/lib/tyypit";
import { avaaLava, type Lavayhteys, type Yhteydentila } from "./lavayhteys";
import "./keynote.css";

interface Props {
  /** Lavan tunniste (`?lava=lava-1`): sama editorissa ja näytössä */
  lava: string;
  /** Pakotettu kuvasuhde (`?suhde=16:9`), muuten alusta täyttää koko ruudun */
  suhde: number | null;
  kieli: Kieli | null;
}

const TEKSTIT = {
  fi: {
    naytolla: "Näytöllä",
    piilotettu: "Piilotettu",
    yhdistetaan: "Yhdistetään…",
    eiYhteytta: "Ei yhteyttä",
    paikallinen: "Testitila",
    nayttoOk: "Näyttö ok",
    nayttoViive: "Näyttö viiveellä",
    nayttoPoissa: "Näyttö ei vastaa",
    eiNayttoa: "Ei näyttöä",
    tallennusVirhe: "Tallennus epäonnistui",
    piilota: "Piilota näytöltä",
    nayta: "Näytä näytöllä",
    kumoa: "Kumoa",
    uudelleen: "Tee uudelleen",
    tyhjenna: "Tyhjennä alusta",
    varmista: "Tyhjennä koko alusta? Napauta uudelleen",
    tyokalut: "Työkalut",
    piilotaTyokalut: "Piilota työkalut",
    kokoNaytto: "Koko näyttö",
    piilotettuOhje: "Piilotettu näytöltä",
    latausvirhe: "Lavan lataus epäonnistui. Tarkista verkkoyhteys.",
    yritaUudelleen: "Yritä uudelleen",
    s: "Ohut",
    m: "Keskikokoinen",
    l: "Paksu",
  },
  en: {
    naytolla: "On screen",
    piilotettu: "Hidden",
    yhdistetaan: "Connecting…",
    eiYhteytta: "Offline",
    paikallinen: "Test mode",
    nayttoOk: "Display ok",
    nayttoViive: "Display lagging",
    nayttoPoissa: "Display not responding",
    eiNayttoa: "No display",
    tallennusVirhe: "Saving failed",
    piilota: "Hide from screen",
    nayta: "Show on screen",
    kumoa: "Undo",
    uudelleen: "Redo",
    tyhjenna: "Clear canvas",
    varmista: "Clear everything? Tap again",
    tyokalut: "Tools",
    piilotaTyokalut: "Hide tools",
    kokoNaytto: "Full screen",
    piilotettuOhje: "Hidden from screen",
    latausvirhe: "Loading the stage failed. Check the network connection.",
    yritaUudelleen: "Try again",
    s: "Thin",
    m: "Medium",
    l: "Thick",
  },
};

const HALKAISIJAT: Record<KokoId, number> = { s: 6, m: 11, l: 19 };
/** Kesken olevan viivan uudet pisteet lähetetään näin usein (ms). */
const JATKOVALI = 40;
/** Muutokset tallennetaan viimeistään näin pian ensimmäisestä muutoksesta (ms). */
const TALLENNUSVIIVE = 700;

// --- Kirjautuminen ja oikeudet ---

export default function KeynoteEditori(props: Props) {
  const supabase = useMemo(() => selainAsiakas(), []);
  const [istunto, setIstunto] = useState<Session | null | undefined>(undefined);
  const [oikeus, setOikeus] = useState<boolean | "virhe" | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setIstunto(data.session));
    const { data } = supabase.auth.onAuthStateChange((_, uusi) => setIstunto(uusi));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !istunto) return setOikeus(null);
    supabase.rpc("voi_piirtaa_lavalle").then(({ data, error }) => setOikeus(error ? "virhe" : data === true));
  }, [supabase, istunto]);

  if (!supabase) {
    // Kehityksessä ilman Supabasea editori ja näyttö toimivat saman selaimen välilehdissä.
    if (process.env.NODE_ENV !== "production") return <Editori supabase={null} {...props} />;
    return (
      <div className="kirjautuminen">
        <p className="hiljainen">Supabase-asetukset puuttuvat.</p>
      </div>
    );
  }
  if (istunto === undefined || (istunto && oikeus === null)) return <div className="kirjautuminen hiljainen">Ladataan…</div>;
  if (!istunto) return <Kirjautuminen supabase={supabase} otsikko="Keynote" />;
  if (oikeus !== true) {
    return (
      <div className="kirjautuminen">
        <form onSubmit={(e) => e.preventDefault()}>
          <h1 className="otsikko">Ei oikeuksia</h1>
          <p className="hiljainen">
            {oikeus === "virhe"
              ? "Keynote-oikeuksia ei voitu tarkistaa. Onko migraatio 0003_keynote.sql ajettu?"
              : `Tunnuksella ${istunto.user.email} ei ole keynote-oikeuksia. Pyydä ylläpitäjää lisäämään tunnus esiintyjiin.`}
          </p>
          <button className="nappi nappi--toissijainen" type="button" onClick={() => supabase.auth.signOut()}>
            Kirjaudu ulos
          </button>
        </form>
      </div>
    );
  }
  return <Editori supabase={supabase} {...props} />;
}

// --- Editori ---

/** Kumottava toiminto: yksi viiva tai koko alustan tyhjennys */
type Toiminto = { tyyppi: "viiva"; viiva: LavanViiva } | { tyyppi: "tyhjennys"; viivat: LavanViiva[]; suhde: number };

interface KeskenOlevaViiva {
  pointerId: number;
  viiva: LavanViiva;
  alue: DOMRect;
  alku: number;
  /** Montako pistettä on jo lähetetty näytölle */
  lahetetty: number;
}

function Editori({ supabase, lava, suhde: pakotettuSuhde, kieli: urlKieli }: Props & { supabase: SupabaseClient | null }) {
  const [kieli, setKieli] = useState<Kieli>(urlKieli ?? "fi");
  const T = TEKSTIT[kieli];
  const [vari, setVari] = useState<string>(MUSTEET[0].hex);
  const [sivellin, setSivellin] = useState<SivellinId>("tussi");
  const [koko, setKoko] = useState<KokoId>("m");
  const [, setRenderointi] = useState(0);
  const paivita = () => setRenderointi((v) => v + 1);

  useEffect(() => {
    if (!urlKieli) setKieli(navigator.language.toLowerCase().startsWith("fi") ? "fi" : "en");
  }, [urlKieli]);

  useEffect(() => {
    document.documentElement.lang = kieli;
  }, [kieli]);

  // Lavan tila. Viivat ja historia ovat refeissä, jotta piirtäminen ei renderöi Reactia uudelleen.
  const viivat = useRef<LavanViiva[]>([]);
  const historia = useRef<Toiminto[]>([]);
  const kumotut = useRef<Toiminto[]>([]);
  const versio = useRef(0);
  const suhde = useRef(pakotettuSuhde ?? OLETUSSUHDE);
  const [nakyvissa, setNakyvissa] = useState(true);
  const nakyvissaRef = useRef(true);
  const [ladattu, setLadattu] = useState(false);
  const ladattuRef = useRef(false);
  const [latausvirhe, setLatausvirhe] = useState(false);
  const [yhteydenTila, setYhteydenTila] = useState<Yhteydentila>("yhdistetaan");
  const [tallennusVirhe, setTallennusVirhe] = useState(false);
  const yhteys = useRef<Lavayhteys | null>(null);

  const laheta = (viesti: KeynoteViesti) => yhteys.current?.laheta(viesti);

  // --- Tallennus ---
  // Lavan tila tallennetaan muutosten jälkeen, jotta näyttö ja editori palautuvat uudelleenlatauksesta.
  // Onnistuneen tallennuksen jälkeen näyttö saa synkkaa-viestin: jos siltä puuttuu muutoksia, se hakee tilan.

  const tallennusAjastin = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tallentaa = useRef(false);
  const tallennaUudestaan = useRef(false);

  const tallenna = useCallback(async () => {
    clearTimeout(tallennusAjastin.current);
    tallennusAjastin.current = undefined;
    const y = yhteys.current;
    if (!y || !ladattuRef.current) return;
    if (tallentaa.current) {
      tallennaUudestaan.current = true;
      return;
    }
    tallentaa.current = true;
    const rivi = { tunnus: lava, viivat: viivat.current, suhde: suhde.current, versio: versio.current, nakyvissa: nakyvissaRef.current };
    const ok = await y.tallenna(rivi);
    tallentaa.current = false;
    setTallennusVirhe(!ok);
    if (ok) y.laheta({ tyyppi: "synkkaa", versio: rivi.versio });
    if (tallennaUudestaan.current || !ok) {
      tallennaUudestaan.current = false;
      tallennusAjastin.current = setTimeout(() => void tallenna(), ok ? 0 : 3000);
    }
  }, [lava]);

  const tallennaPian = useCallback(() => {
    tallennusAjastin.current ??= setTimeout(() => void tallenna(), TALLENNUSVIIVE);
  }, [tallenna]);

  // --- Alusta ---

  const juuriRef = useRef<HTMLDivElement>(null);
  const alustaRef = useRef<HTMLDivElement>(null);
  const kerrosRef = useRef<HTMLCanvasElement>(null);
  const pintaRef = useRef<HTMLCanvasElement>(null);
  const px = useRef(0);

  const ruudunSuhde = () => {
    const juuri = juuriRef.current;
    return sallittuSuhde(juuri && juuri.clientHeight ? juuri.clientWidth / juuri.clientHeight : innerWidth / innerHeight);
  };

  const piirraKaikki = useCallback(() => {
    const ctx = kerrosRef.current?.getContext("2d");
    if (!ctx || !kerrosRef.current) return;
    ctx.clearRect(0, 0, kerrosRef.current.width, kerrosRef.current.height);
    for (const viiva of viivat.current) piirraViiva(ctx, viiva, px.current);
  }, []);

  const mitoita = useCallback(() => {
    const juuri = juuriRef.current;
    const alusta = alustaRef.current;
    if (!juuri || !alusta || !kerrosRef.current || !pintaRef.current || !juuri.clientWidth) return;
    const { leveys, korkeus } = sovitaSuhteeseen(juuri.clientWidth, juuri.clientHeight, suhde.current);
    alusta.style.width = `${leveys}px`;
    alusta.style.height = `${korkeus}px`;
    px.current = sovitaAlusta(kerrosRef.current, leveys, korkeus);
    sovitaAlusta(pintaRef.current, leveys, korkeus);
    piirraKaikki();
  }, [piirraKaikki]);

  /** Vaihtaa alustan kuvasuhteen ja tyhjentää näytön (versioitu muutos, ei kumottavissa). */
  const vaihdaSuhde = useCallback(
    (uusi: number) => {
      suhde.current = uusi;
      versio.current += 1;
      laheta({ tyyppi: "tyhjenna", versio: versio.current, suhde: uusi });
      tallennaPian();
      mitoita();
    },
    [mitoita, tallennaPian],
  );

  // Tyhjä alusta seuraa ruudun kokoa (esim. iPadin kääntäminen), kunnes siihen piirretään.
  const suhdeAjastin = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const juuri = juuriRef.current;
    if (!juuri) return;
    const havainnoija = new ResizeObserver(() => {
      mitoita();
      if (pakotettuSuhde || !ladattuRef.current || viivat.current.length) return;
      clearTimeout(suhdeAjastin.current);
      suhdeAjastin.current = setTimeout(() => {
        const uusi = ruudunSuhde();
        if (!viivat.current.length && Math.abs(uusi - suhde.current) > 0.01) vaihdaSuhde(uusi);
      }, 400);
    });
    havainnoija.observe(juuri);
    return () => {
      havainnoija.disconnect();
      clearTimeout(suhdeAjastin.current);
    };
  }, [mitoita, pakotettuSuhde, vaihdaSuhde]);

  // --- Yhteys ja lataus ---

  const [latauskerta, setLatauskerta] = useState(0);
  useEffect(() => {
    let peruttu = false;
    ladattuRef.current = false;
    setLadattu(false);
    setLatausvirhe(false);
    const y = avaaLava(supabase, lava, {
      yhteys: (tila, syy) => {
        if (peruttu) return;
        setYhteydenTila(tila);
        if (tila === "virhe") console.warn("Keynote-kanava:", syy);
        // Yhteyden palattua näyttö saa ajantasaisen tilan tallennuksen jälkeisestä synkkaa-viestistä.
        if (tila === "yhdistetty" && ladattuRef.current) tallennaPian();
      },
    });
    yhteys.current = y;
    y.lataa()
      .then((rivi) => {
        if (peruttu) return;
        if (rivi) {
          viivat.current = Array.isArray(rivi.viivat) ? rivi.viivat : [];
          versio.current = rivi.versio;
          suhde.current = sallittuSuhde(rivi.suhde);
          nakyvissaRef.current = rivi.nakyvissa;
          setNakyvissa(rivi.nakyvissa);
        }
        historia.current = [];
        kumotut.current = [];
        ladattuRef.current = true;
        setLadattu(true);
        // Tyhjä lava saa tämän ruudun (tai ?suhde=) kuvasuhteen. Jos lavalla on jo piirros, sen
        // kuvasuhde säilyy, kunnes alusta tyhjennetään.
        const uusi = pakotettuSuhde ?? ruudunSuhde();
        if (!viivat.current.length && (!rivi || Math.abs(uusi - suhde.current) > 0.001)) vaihdaSuhde(uusi);
        else mitoita();
      })
      .catch((virhe) => {
        console.warn("Lavan lataus epäonnistui", virhe);
        if (!peruttu) setLatausvirhe(true);
      });
    return () => {
      peruttu = true;
      y.sulje();
      clearTimeout(tallennusAjastin.current);
      tallennusAjastin.current = undefined;
    };
    // Lataus tehdään vain lavan vaihtuessa tai uudelleenyrityksessä, ei työkalujen tai koon muuttuessa.
  }, [supabase, lava, latauskerta]);

  // --- Piirtäminen ---

  const nykyinen = useRef<KeskenOlevaViiva | null>(null);
  const kynaHavaittu = useRef(false);
  const piirtopyynto = useRef(0);
  const jatkoAjastin = useRef<ReturnType<typeof setTimeout>>(undefined);

  function lisaaPiste(e: PointerEvent) {
    const n = nykyinen.current;
    if (!n) return;
    // Sekä x että y suhteessa leveyteen, jolloin y on välillä 0 – 1 / suhde.
    const x = Math.min(1, Math.max(0, (e.clientX - n.alue.left) / n.alue.width));
    const y = Math.min(n.alue.height / n.alue.width, Math.max(0, (e.clientY - n.alue.top) / n.alue.width));
    const paine = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5;
    n.viiva.pisteet.push([+x.toFixed(5), +y.toFixed(5), +paine.toFixed(3), Math.round(e.timeStamp - n.alku)]);
  }

  function pyydaPiirto() {
    if (piirtopyynto.current) return;
    piirtopyynto.current = requestAnimationFrame(() => {
      piirtopyynto.current = 0;
      const canvas = pintaRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (nykyinen.current) piirraViiva(ctx, nykyinen.current.viiva, px.current, { kumiNakyvana: true });
    });
  }

  function lahetaJatko() {
    clearTimeout(jatkoAjastin.current);
    jatkoAjastin.current = undefined;
    const n = nykyinen.current;
    if (!n || n.viiva.pisteet.length <= n.lahetetty) return;
    laheta({ tyyppi: "jatko", id: n.viiva.id, alku: n.lahetetty, pisteet: n.viiva.pisteet.slice(n.lahetetty) });
    n.lahetetty = n.viiva.pisteet.length;
  }

  function aloitaViiva(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "pen") kynaHavaittu.current = true;
    // Kämmenen hylkäys: kun kynä on havaittu, sormet eivät piirrä.
    if (!ladattu || nykyinen.current || (kynaHavaittu.current && e.pointerType === "touch")) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synteettisillä tapahtumilla ei ole aktiivista osoitinta.
    }
    nykyinen.current = {
      pointerId: e.pointerId,
      alue: e.currentTarget.getBoundingClientRect(),
      alku: e.timeStamp,
      lahetetty: 0,
      viiva: {
        id: viivanId(),
        vari: sivellin === "kumi" ? KUMIN_VARI : vari,
        koko: LAVAN_KOOT[koko],
        sivellin,
        paine: e.pointerType === "pen",
        pisteet: [],
      },
    };
    lisaaPiste(e.nativeEvent);
    const n = nykyinen.current;
    laheta({ tyyppi: "alku", viiva: { ...n.viiva, pisteet: [...n.viiva.pisteet] } });
    n.lahetetty = n.viiva.pisteet.length;
    pyydaPiirto();
  }

  function jatkaViivaa(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (nykyinen.current?.pointerId !== e.pointerId) return;
    const yhdistetyt = e.nativeEvent.getCoalescedEvents?.();
    for (const tapahtuma of yhdistetyt?.length ? yhdistetyt : [e.nativeEvent]) lisaaPiste(tapahtuma);
    pyydaPiirto();
    jatkoAjastin.current ??= setTimeout(lahetaJatko, JATKOVALI);
  }

  function lopetaViiva(e: ReactPointerEvent<HTMLCanvasElement>) {
    const n = nykyinen.current;
    if (n?.pointerId !== e.pointerId) return;
    nykyinen.current = null;
    clearTimeout(jatkoAjastin.current);
    jatkoAjastin.current = undefined;
    viivat.current.push(n.viiva);
    historia.current.push({ tyyppi: "viiva", viiva: n.viiva });
    kumotut.current = [];
    versio.current += 1;
    laheta({ tyyppi: "valmis", versio: versio.current, viiva: n.viiva });
    tallennaPian();
    const ctx = kerrosRef.current?.getContext("2d");
    if (ctx) piirraViiva(ctx, n.viiva, px.current);
    const pinta = pintaRef.current;
    pinta?.getContext("2d")?.clearRect(0, 0, pinta.width, pinta.height);
    paivita();
  }

  // --- Kumoa / tee uudelleen / tyhjennä / piilota ---

  function peru(toiminto: Toiminto) {
    versio.current += 1;
    if (toiminto.tyyppi === "viiva") {
      viivat.current = viivat.current.filter((v) => v.id !== toiminto.viiva.id);
      laheta({ tyyppi: "poista", versio: versio.current, id: toiminto.viiva.id });
      tallennaPian();
    } else {
      // Tyhjennyksen kumoaminen on liian iso viestiksi: näyttö hakee tilan tallennuksen jälkeen.
      viivat.current = [...toiminto.viivat];
      suhde.current = toiminto.suhde;
      void tallenna();
      mitoita();
    }
    piirraKaikki();
  }

  function toista(toiminto: Toiminto) {
    versio.current += 1;
    if (toiminto.tyyppi === "viiva") {
      viivat.current.push(toiminto.viiva);
      laheta({ tyyppi: "valmis", versio: versio.current, viiva: toiminto.viiva });
    } else {
      viivat.current = [];
      suhde.current = pakotettuSuhde ?? ruudunSuhde();
      laheta({ tyyppi: "tyhjenna", versio: versio.current, suhde: suhde.current });
      mitoita();
    }
    tallennaPian();
    piirraKaikki();
  }

  function kumoa() {
    const toiminto = historia.current.pop();
    if (!toiminto || nykyinen.current) return;
    kumotut.current.push(toiminto);
    peru(toiminto);
    paivita();
  }

  function teeUudelleen() {
    const toiminto = kumotut.current.pop();
    if (!toiminto || nykyinen.current) return;
    historia.current.push(toiminto);
    toista(toiminto);
    paivita();
  }

  const [varmistaTyhjennys, setVarmistaTyhjennys] = useState(false);
  useEffect(() => {
    if (!varmistaTyhjennys) return;
    const ajastin = setTimeout(() => setVarmistaTyhjennys(false), 3000);
    return () => clearTimeout(ajastin);
  }, [varmistaTyhjennys]);

  function tyhjenna() {
    if (!varmistaTyhjennys) return setVarmistaTyhjennys(true);
    setVarmistaTyhjennys(false);
    const toiminto: Toiminto = { tyyppi: "tyhjennys", viivat: viivat.current, suhde: suhde.current };
    historia.current.push(toiminto);
    kumotut.current = [];
    toista(toiminto);
    paivita();
  }

  function vaihdaNakyvyys() {
    const uusi = !nakyvissaRef.current;
    nakyvissaRef.current = uusi;
    setNakyvissa(uusi);
    versio.current += 1;
    laheta({ tyyppi: "nakyvyys", versio: versio.current, nakyvissa: uusi });
    tallennaPian();
  }

  // Näppäimistö (Magic Keyboard): ⌘Z kumoa, ⇧⌘Z tee uudelleen
  const pikanappaimet = useRef({ kumoa, teeUudelleen });
  pikanappaimet.current = { kumoa, teeUudelleen };
  useEffect(() => {
    const kasittele = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) pikanappaimet.current.teeUudelleen();
      else pikanappaimet.current.kumoa();
    };
    addEventListener("keydown", kasittele);
    return () => removeEventListener("keydown", kasittele);
  }, []);

  // --- Keynote-näytön syke ---

  const [naytonSyke, setNaytonSyke] = useState<NaytonSyke | null>(null);
  const [nyt, setNyt] = useState(() => Date.now());
  useEffect(() => {
    if (!supabase) return;
    const tunnus = lavanNaytto(lava);
    supabase
      .from("naytot")
      .select("tunnus, viimeksi_nahty, tiedot")
      .eq("tunnus", tunnus)
      .maybeSingle()
      .then(({ data }) => data && setNaytonSyke(data as NaytonSyke));
    const kanava = supabase
      .channel(`keynote-syke-${lava}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "naytot", filter: `tunnus=eq.${tunnus}` }, (muutos) =>
        setNaytonSyke(muutos.new as NaytonSyke),
      )
      .subscribe();
    const ajastin = setInterval(() => setNyt(Date.now()), 10_000);
    return () => {
      void supabase.removeChannel(kanava);
      clearInterval(ajastin);
    };
  }, [supabase, lava]);

  // --- Koko näyttö ja työkalut ---

  const [tyokalutAuki, setTyokalutAuki] = useState(true);
  const [kokoNayttoTuettu, setKokoNayttoTuettu] = useState(false);
  useEffect(() => setKokoNayttoTuettu(Boolean(document.fullscreenEnabled)), []);
  const vaihdaKokoNaytto = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  // --- Näkymä ---

  const paikallinen = !supabase;
  const yhteysTeksti =
    yhteydenTila === "yhdistetty" ? (nakyvissa ? T.naytolla : T.piilotettu) : yhteydenTila === "yhdistetaan" ? T.yhdistetaan : T.eiYhteytta;
  const yhteysData = yhteydenTila !== "yhdistetty" ? yhteydenTila : nakyvissa ? "live" : "piilotettu";
  const nayttoTila = naytonSyke ? sykkeenTila(naytonSyke, nyt) : null;
  const nayttoTeksti = paikallinen
    ? T.paikallinen
    : nayttoTila === "ok"
      ? T.nayttoOk
      : nayttoTila === "viive"
        ? T.nayttoViive
        : nayttoTila === "poissa"
          ? T.nayttoPoissa
          : T.eiNayttoa;

  return (
    <div className="keynote-editori" ref={juuriRef} data-nakyvissa={nakyvissa}>
      <div className="alusta" ref={alustaRef}>
        <canvas ref={kerrosRef} />
        <canvas
          ref={pintaRef}
          className="pinta"
          onPointerDown={aloitaViiva}
          onPointerMove={jatkaViivaa}
          onPointerUp={lopetaViiva}
          onPointerCancel={lopetaViiva}
        />
      </div>

      {!nakyvissa && <div className="piilotettu-kehys" aria-hidden="true" />}

      <div className="tila-alue" aria-live="polite">
        <span className="siru yhteys" data-tila={yhteysData}>
          <span className="piste" />
          {yhteysTeksti}
        </span>
        <span className="siru naytto" data-tila={paikallinen ? "paikallinen" : (nayttoTila ?? "ei")}>
          {nayttoTeksti}
        </span>
        {tallennusVirhe && <span className="siru virhe">{T.tallennusVirhe}</span>}
        {!ladattu && !latausvirhe && <span className="siru">…</span>}
      </div>

      <button
        className="ikoninappi tyokalunappi"
        type="button"
        aria-label={tyokalutAuki ? T.piilotaTyokalut : T.tyokalut}
        title={tyokalutAuki ? T.piilotaTyokalut : T.tyokalut}
        aria-expanded={tyokalutAuki}
        onClick={() => setTyokalutAuki(!tyokalutAuki)}
      >
        {tyokalutAuki ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 15 6-6 6 6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        )}
      </button>

      {tyokalutAuki && (
        <div className="tyokalut" role="toolbar" aria-label={T.tyokalut}>
          <div className="ryhma varit" role="group">
            {MUSTEET.map((m) => (
              <button
                key={m.id}
                type="button"
                className="vari"
                style={{ "--c": m.hex } as React.CSSProperties}
                aria-label={m[kieli]}
                title={m[kieli]}
                aria-pressed={sivellin !== "kumi" && vari === m.hex}
                onClick={() => {
                  setVari(m.hex);
                  if (sivellin === "kumi") setSivellin("tussi");
                }}
              />
            ))}
          </div>
          <div className="ryhma segmentit" role="group">
            {(Object.keys(SIVELTIMET) as SivellinId[]).map((id) => (
              <button key={id} type="button" aria-pressed={sivellin === id} onClick={() => setSivellin(id)}>
                {SIVELTIMET[id][kieli]}
              </button>
            ))}
          </div>
          <div className="ryhma" role="group">
            {(Object.keys(LAVAN_KOOT) as KokoId[]).map((id) => (
              <button
                key={id}
                type="button"
                className="koko"
                style={{ "--d": `${HALKAISIJAT[id]}px` } as React.CSSProperties}
                aria-label={T[id]}
                title={T[id]}
                aria-pressed={koko === id}
                onClick={() => setKoko(id)}
              />
            ))}
          </div>
          <div className="ryhma">
            <button className="ikoninappi" type="button" aria-label={T.kumoa} title={T.kumoa} disabled={!historia.current.length} onClick={kumoa}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
            </button>
            <button
              className="ikoninappi"
              type="button"
              aria-label={T.uudelleen}
              title={T.uudelleen}
              disabled={!kumotut.current.length}
              onClick={teeUudelleen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 14 5-5-5-5" />
                <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
              </svg>
            </button>
            <button
              className={`ikoninappi${varmistaTyhjennys ? " varmista" : ""}`}
              type="button"
              aria-label={varmistaTyhjennys ? T.varmista : T.tyhjenna}
              title={varmistaTyhjennys ? T.varmista : T.tyhjenna}
              disabled={!viivat.current.length}
              onClick={tyhjenna}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
          <div className="ryhma">
            <button
              className={`ikoninappi nakyvyys${nakyvissa ? "" : " pois"}`}
              type="button"
              aria-label={nakyvissa ? T.piilota : T.nayta}
              title={nakyvissa ? T.piilota : T.nayta}
              aria-pressed={!nakyvissa}
              disabled={!ladattu}
              onClick={vaihdaNakyvyys}
            >
              {nakyvissa ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.7 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.1" />
                  <path d="M6.6 6.6C3.8 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
                  <path d="m2 2 20 20" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              )}
            </button>
            {kokoNayttoTuettu && (
              <button className="ikoninappi" type="button" aria-label={T.kokoNaytto} title={T.kokoNaytto} onClick={vaihdaKokoNaytto}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {!nakyvissa && <div className="piilotettu-ohje ylaotsikko">{T.piilotettuOhje}</div>}

      {latausvirhe && (
        <div className="latausvirhe" role="alert">
          <p>{T.latausvirhe}</p>
          <button className="nappi nappi--ensisijainen" type="button" onClick={() => setLatauskerta((k) => k + 1)}>
            {T.yritaUudelleen}
          </button>
        </div>
      )}
    </div>
  );
}
