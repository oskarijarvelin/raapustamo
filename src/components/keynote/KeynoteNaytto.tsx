"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  kasitteleViesti,
  lavanNaytto,
  sovitaAlusta,
  sovitaSuhteeseen,
  tyhjaLava,
  yhdistaTallennettu,
  type KeynoteViesti,
  type LavanViiva,
} from "@/lib/keynote";
import { piirraViiva } from "@/lib/piirto";
import { selainAsiakas } from "@/lib/supabase/selain";
import { avaaLava, type Yhteydentila } from "./lavayhteys";
import "./keynote.css";

interface Props {
  lava: string;
  /** `?tila=1`: yhteyden tila näytön kulmassa (asennus ja testaus) */
  naytaTila: boolean;
}

/** Tallennetun tilan versio tarkistetaan näin usein siltä varalta, että viestejä on kadonnut. */
const TARKISTUSVALI = 20_000;
const SYKEVALI = 30_000;

export default function KeynoteNaytto({ lava, naytaTila }: Props) {
  const supabase = useMemo(() => selainAsiakas(), []);
  const juuriRef = useRef<HTMLDivElement>(null);
  const alustaRef = useRef<HTMLDivElement>(null);
  const kerrosRef = useRef<HTMLCanvasElement>(null);
  const pintaRef = useRef<HTMLCanvasElement>(null);
  const [nakyvissa, setNakyvissa] = useState(true);
  const [yhteydenTila, setYhteydenTila] = useState<Yhteydentila>("yhdistetaan");
  const [versio, setVersio] = useState(0);

  useEffect(() => {
    const juuri = juuriRef.current;
    const alusta = alustaRef.current;
    const kerros = kerrosRef.current;
    const pinta = pintaRef.current;
    const kctx = kerros?.getContext("2d");
    const pctx = pinta?.getContext("2d");
    if (!juuri || !alusta || !kerros || !pinta || !kctx || !pctx) return;

    const tila = tyhjaLava();
    let px = 0;
    let mitoitettuSuhde = 0;
    let kaikki = true;
    let kesken = true;
    let lisatyt: LavanViiva[] = [];
    let kehys = 0;
    let kanavaAuki = false;

    function mitoita() {
      if (!juuri!.clientWidth) return;
      mitoitettuSuhde = tila.suhde;
      const { leveys, korkeus } = sovitaSuhteeseen(juuri!.clientWidth, juuri!.clientHeight, tila.suhde);
      alusta!.style.width = `${leveys}px`;
      alusta!.style.height = `${korkeus}px`;
      px = sovitaAlusta(kerros!, leveys, korkeus);
      sovitaAlusta(pinta!, leveys, korkeus);
      kaikki = kesken = true;
    }

    function piirra() {
      kehys = 0;
      if (tila.suhde !== mitoitettuSuhde) mitoita();
      if (kaikki) {
        kctx!.clearRect(0, 0, kerros!.width, kerros!.height);
        for (const viiva of tila.viivat) piirraViiva(kctx!, viiva, px);
      } else {
        for (const viiva of lisatyt) piirraViiva(kctx!, viiva, px);
      }
      if (kesken) {
        pctx!.clearRect(0, 0, pinta!.width, pinta!.height);
        for (const viiva of tila.kesken.values()) piirraViiva(pctx!, viiva, px, { kumiNakyvana: true });
      }
      kaikki = kesken = false;
      lisatyt = [];
    }

    const pyyda = () => {
      kehys ||= requestAnimationFrame(piirra);
    };

    const paivitaNakyma = () => {
      setNakyvissa(tila.nakyvissa);
      setVersio(tila.versio);
    };

    // --- Tallennetun tilan haku ---
    let synkataan = false;
    let synkkaaUudestaan = false;
    async function synkronoi() {
      if (synkataan) {
        synkkaaUudestaan = true;
        return;
      }
      synkataan = true;
      try {
        const rivi = await yhteys.lataa();
        if (rivi && yhdistaTallennettu(tila, rivi)) {
          kaikki = kesken = true;
          paivitaNakyma();
          pyyda();
        }
      } catch (virhe) {
        console.warn("Lavan haku epäonnistui", virhe);
      }
      synkataan = false;
      if (synkkaaUudestaan) {
        synkkaaUudestaan = false;
        void synkronoi();
      }
    }

    function kasittele(viesti: KeynoteViesti) {
      const { piirra: piirrettava, synkkaa } = kasitteleViesti(tila, viesti);
      if (piirrettava === "kesken") kesken = true;
      else if (piirrettava === "lisatty") {
        lisatyt.push(tila.viivat[tila.viivat.length - 1]);
        kesken = true;
      } else if (piirrettava === "kaikki") kaikki = kesken = true;
      if (piirrettava !== "ei" && piirrettava !== "kesken") paivitaNakyma();
      if (synkkaa) void synkronoi();
      pyyda();
    }

    const yhteys = avaaLava(supabase, lava, {
      viesti: kasittele,
      yhteys: (uusi, syy) => {
        kanavaAuki = uusi === "yhdistetty";
        setYhteydenTila(uusi);
        if (uusi === "virhe") console.warn("Keynote-kanava:", syy);
        // Yhdistettäessä (myös katkon jälkeen) haetaan tila, jottei välissä tulleita muutoksia puutu.
        if (kanavaAuki) void synkronoi();
      },
    });
    void synkronoi();

    const havainnoija = new ResizeObserver(() => {
      mitoita();
      pyyda();
    });
    havainnoija.observe(juuri);

    const tarkistus = setInterval(async () => {
      const tallennettu = await yhteys.lataaVersio();
      if (tallennettu !== null && tallennettu > tila.versio) void synkronoi();
    }, TARKISTUSVALI);

    // Syke: moderointi ja editori näkevät, että keynote-näyttö on elossa.
    const kaynnistetty = Date.now();
    const syke = () =>
      supabase
        ?.rpc("naytto_syke", {
          naytto: lavanNaytto(lava),
          syke_tiedot: {
            versio: process.env.NEXT_PUBLIC_VERSIO ?? "dev",
            layout: "keynote",
            tauko: !tila.nakyvissa,
            verkossa: navigator.onLine,
            kanava: kanavaAuki,
            kaynnissa_min: Math.round((Date.now() - kaynnistetty) / 60_000),
          },
        })
        .then(({ error }) => error && console.warn("Syke epäonnistui", error.message));
    void syke();
    const sykkeet = setInterval(syke, SYKEVALI);

    return () => {
      yhteys.sulje();
      havainnoija.disconnect();
      clearInterval(tarkistus);
      clearInterval(sykkeet);
      cancelAnimationFrame(kehys);
    };
  }, [supabase, lava]);

  return (
    <div className="keynote-naytto" ref={juuriRef} data-nakyvissa={nakyvissa}>
      <div className="alusta" ref={alustaRef}>
        <canvas ref={kerrosRef} />
        <canvas ref={pintaRef} />
      </div>
      {naytaTila && (
        <div className="tila" data-tila={yhteydenTila}>
          <span className="siru">
            <span className="piste" />
            {lava} · {supabase ? yhteydenTila : "paikallinen"} · v{versio}
            {!nakyvissa && " · piilotettu"}
          </span>
        </div>
      )}
    </div>
  );
}
