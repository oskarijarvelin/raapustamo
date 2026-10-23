"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RealtimeChannel, Session, SupabaseClient } from "@supabase/supabase-js";
import PiirrosCanvas from "@/components/PiirrosCanvas";
import { moderointijono } from "@/lib/jono";
import { kellonaika, piirraPiirros, sovitaCanvas, tunnus } from "@/lib/piirto";
import { NAYTTOKANAVA, selainAsiakas } from "@/lib/supabase/selain";
import { ikaTekstina, sykkeenTila, type NaytonSyke, type SykkeenTila } from "@/lib/syke";
import type { AiArvio, PiirroksenTila, Piirros } from "@/lib/tyypit";
import "./moderointi.css";

const LUOKAT: Record<AiArvio["luokka"], { nimi: string; vari: string }> = {
  ok: { nimi: "OK", vari: "var(--ok)" },
  epailyttava: { nimi: "Epäilyttävä", vari: "var(--varoitus)" },
  sopimaton: { nimi: "Sopimaton", vari: "var(--vaara)" },
};
const LAHTEET: Record<string, string> = { mobiili: "Mobiili" };
const lahteenNimi = (lahde: string) => LAHTEET[lahde] ?? lahde.replace("ipad-", "iPad ");

type Valilehti = "jono" | "hyvaksytty" | "hylatty";

// --- Kirjautuminen ja oikeudet ---

export default function Moderointi() {
  const supabase = useMemo(() => selainAsiakas(), []);
  const [istunto, setIstunto] = useState<Session | null | undefined>(undefined);
  const [oikeus, setOikeus] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setIstunto(data.session));
    const { data } = supabase.auth.onAuthStateChange((_, uusi) => setIstunto(uusi));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !istunto) return setOikeus(null);
    supabase
      .from("moderaattorit")
      .select("kayttaja")
      .eq("kayttaja", istunto.user.id)
      .then(({ data }) => setOikeus(Boolean(data?.length)));
  }, [supabase, istunto]);

  if (!supabase) {
    return (
      <div className="kirjautuminen">
        <p className="hiljainen">Supabase-asetukset puuttuvat. Lisää NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY tiedostoon .env.local.</p>
      </div>
    );
  }
  if (istunto === undefined || (istunto && oikeus === null)) return <div className="kirjautuminen hiljainen">Ladataan…</div>;
  if (!istunto) return <Kirjautuminen supabase={supabase} />;
  if (!oikeus) {
    return (
      <div className="kirjautuminen">
        <form onSubmit={(e) => e.preventDefault()}>
          <h1 className="otsikko">Ei oikeuksia</h1>
          <p className="hiljainen">Tunnuksella {istunto.user.email} ei ole moderointioikeuksia. Pyydä ylläpitäjää lisäämään tunnus moderaattoreihin.</p>
          <button className="nappi nappi--toissijainen" type="button" onClick={() => supabase.auth.signOut()}>
            Kirjaudu ulos
          </button>
        </form>
      </div>
    );
  }
  return <Moderointipaneeli supabase={supabase} />;
}

function Kirjautuminen({ supabase }: { supabase: SupabaseClient }) {
  const [sahkoposti, setSahkoposti] = useState("");
  const [salasana, setSalasana] = useState("");
  const [virhe, setVirhe] = useState<string | null>(null);
  const [odottaa, setOdottaa] = useState(false);

  async function kirjaudu(e: FormEvent) {
    e.preventDefault();
    setOdottaa(true);
    setVirhe(null);
    const { error } = await supabase.auth.signInWithPassword({ email: sahkoposti, password: salasana });
    if (error) setVirhe("Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.");
    setOdottaa(false);
  }

  return (
    <div className="kirjautuminen">
      <form onSubmit={kirjaudu}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-merkki" src="/brand/latf-merkki.png" alt="Lumo Art & Tech Festival" />
        <h1 className="otsikko">Moderointi</h1>
        <label>
          Sähköposti
          <input type="email" autoComplete="username" required value={sahkoposti} onChange={(e) => setSahkoposti(e.target.value)} />
        </label>
        <label>
          Salasana
          <input type="password" autoComplete="current-password" required value={salasana} onChange={(e) => setSalasana(e.target.value)} />
        </label>
        {virhe && (
          <p className="virhe" role="alert">
            {virhe}
          </p>
        )}
        <button className="nappi nappi--ensisijainen nappi--iso" type="submit" disabled={odottaa}>
          {odottaa ? "Kirjaudutaan…" : "Kirjaudu"}
        </button>
      </form>
    </div>
  );
}

// --- Moderointipaneeli ---

function Moderointipaneeli({ supabase }: { supabase: SupabaseClient }) {
  const [piirrokset, setPiirrokset] = useState<Map<string, Piirros>>(new Map());
  const [tauko, setTauko] = useState(false);
  const [valilehti, setValilehti] = useState<Valilehti>("jono");
  const [valittuId, setValittuId] = useState<string | null>(null);
  const [paljastetut, setPaljastetut] = useState<Set<string>>(new Set());
  const [ilmoitus, setIlmoitus] = useState<{ teksti: string; peru?: () => void } | null>(null);
  const [naytot, setNaytot] = useState<Map<string, NaytonSyke>>(new Map());
  const nayttokanava = useRef<RealtimeChannel | null>(null);

  // Lataus ja reaaliaikaiset muutokset
  useEffect(() => {
    let peruttu = false;
    supabase
      .from("piirrokset")
      .select("*")
      .order("luotu", { ascending: false })
      .limit(2000)
      .then(({ data, error }) => {
        if (peruttu) return;
        if (error) return setIlmoitus({ teksti: "Piirrosten lataus epäonnistui" });
        setPiirrokset(new Map((data as Piirros[]).map((p) => [p.id, p])));
      });
    supabase
      .from("asetukset")
      .select("arvo")
      .eq("avain", "naytto")
      .single()
      .then(({ data }) => !peruttu && setTauko(Boolean(data?.arvo?.tauko)));
    supabase
      .from("naytot")
      .select("*")
      .then(({ data }) => !peruttu && data && setNaytot(new Map((data as NaytonSyke[]).map((n) => [n.tunnus, n]))));

    const muutokset = supabase
      .channel("moderointi")
      .on("postgres_changes", { event: "*", schema: "public", table: "piirrokset" }, (muutos) => {
        setPiirrokset((vanhat) => {
          const uudet = new Map(vanhat);
          if (muutos.eventType === "DELETE") uudet.delete((muutos.old as Piirros).id);
          else uudet.set((muutos.new as Piirros).id, muutos.new as Piirros);
          return uudet;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "asetukset" }, (muutos) => {
        const rivi = muutos.new as { avain: string; arvo: { tauko?: boolean } };
        if (rivi.avain === "naytto") setTauko(Boolean(rivi.arvo.tauko));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "naytot" }, (muutos) => {
        const syke = muutos.new as NaytonSyke;
        if (syke.tunnus) setNaytot((vanhat) => new Map(vanhat).set(syke.tunnus, syke));
      })
      .subscribe();
    nayttokanava.current = supabase.channel(NAYTTOKANAVA).subscribe();

    return () => {
      peruttu = true;
      supabase.removeChannel(muutokset);
      if (nayttokanava.current) supabase.removeChannel(nayttokanava.current);
    };
  }, [supabase]);

  useEffect(() => {
    if (!ilmoitus) return;
    const ajastin = setTimeout(() => setIlmoitus(null), 5000);
    return () => clearTimeout(ajastin);
  }, [ilmoitus]);

  const lista = useMemo(() => [...piirrokset.values()], [piirrokset]);
  const jono = useMemo(() => moderointijono(lista), [lista]);
  const valittu = jono.find((p) => p.id === valittuId) ?? jono[0];
  // Näkyvä piirros pysyy paikallaan, vaikka tekoälyarvio nostaisi toisen jonon kärkeen kesken
  // tarkastelun. Muuten pyyhkäisy tai pikanäppäin voisi osua eri piirrokseen kuin moderaattori katsoi.
  useEffect(() => {
    if (valittu && valittu.id !== valittuId) setValittuId(valittu.id);
  }, [valittu, valittuId]);
  const maarat = {
    jono: jono.length,
    hyvaksytty: lista.filter((p) => p.tila === "hyvaksytty").length,
    hylatty: lista.filter((p) => p.tila === "hylatty" || p.tila === "piilotettu").length,
  };

  async function paivita(p: Piirros, muutos: Partial<Pick<Piirros, "tila" | "nostettu">>) {
    setPiirrokset((vanhat) => new Map(vanhat).set(p.id, { ...p, ...muutos }));
    const { error } = await supabase.from("piirrokset").update(muutos).eq("id", p.id);
    if (error) {
      setPiirrokset((vanhat) => new Map(vanhat).set(p.id, p));
      setIlmoitus({ teksti: `Tallennus epäonnistui: ${tunnus(p.nro)}` });
      return false;
    }
    // Hyväksytyltä poistettu piirros katoaa screeniltä heti
    if (p.tila === "hyvaksytty" && muutos.tila && muutos.tila !== "hyvaksytty") {
      nayttokanava.current?.send({ type: "broadcast", event: "piilota", payload: { id: p.id } });
    }
    return true;
  }

  async function asetaTila(p: Piirros, tila: PiirroksenTila, viesti: string) {
    if (!(await paivita(p, { tila }))) return;
    setIlmoitus({ teksti: `${tunnus(p.nro)} ${viesti}`, peru: () => paivita({ ...p, tila }, { tila: p.tila }) });
  }

  async function vaihdaTauko() {
    const uusi = !tauko;
    setTauko(uusi);
    const { error } = await supabase.from("asetukset").update({ arvo: { tauko: uusi }, paivitetty: new Date().toISOString() }).eq("avain", "naytto");
    if (error) {
      setTauko(!uusi);
      return setIlmoitus({ teksti: "Näytön tilan muutos epäonnistui" });
    }
    nayttokanava.current?.send({ type: "broadcast", event: "tauko", payload: { tauko: uusi } });
    setIlmoitus({ teksti: uusi ? "Näyttö pysäytetty" : "Näyttö palautettu" });
  }

  // Pikanäppäimet
  const toimintoRef = useRef<(avain: string) => void>(() => {});
  toimintoRef.current = (avain) => {
    if (valilehti !== "jono" || !valittu) return;
    if (avain === "arrowright" || avain === "a") asetaTila(valittu, "hyvaksytty", "hyväksytty");
    else if (avain === "arrowleft" || avain === "h") asetaTila(valittu, "hylatty", "hylätty");
    else if (avain === "n") paivita(valittu, { nostettu: !valittu.nostettu });
    else if (avain === "arrowdown" || avain === "arrowup") {
      const i = jono.indexOf(valittu);
      const uusi = jono[Math.max(0, Math.min(jono.length - 1, i + (avain === "arrowdown" ? 1 : -1)))];
      if (uusi) setValittuId(uusi.id);
    }
  };
  useEffect(() => {
    const kuuntelija = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea")) return;
      const avain = e.key.toLowerCase();
      if (["arrowup", "arrowdown"].includes(avain)) e.preventDefault();
      toimintoRef.current(avain);
    };
    addEventListener("keydown", kuuntelija);
    return () => removeEventListener("keydown", kuuntelija);
  }, []);

  return (
    <div className="moderointisivu">
      <header className="ylapalkki">
        <div className="tuotemerkki">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-merkki" src="/brand/latf-merkki.png" alt="Lumo Art & Tech Festival" />
          <span className="erotin" aria-hidden="true" />
          <span className="ylaotsikko">
            Raapustamo <span className="hiljainen tuote-ala">/ Moderointi</span>
          </span>
        </div>
        <div className="yla-oikea">
          <Naytot naytot={[...naytot.values()]} />
          <button
            className="siru naytto-tila"
            type="button"
            data-tila={tauko ? "tauko" : "live"}
            title={tauko ? "Palauta piirrokset LED-screenille" : "Hätäpysäytys: screenillä näkyy vain logo ja QR-koodi"}
            onClick={vaihdaTauko}
          >
            <span className="piste" />
            {tauko ? "Näyttö tauolla" : "Näyttö live"}
            <span className="toiminto">&nbsp;· {tauko ? "jatka" : "pysäytä"}</span>
          </button>
          <button className="siru kirjaudu-ulos" type="button" onClick={() => supabase.auth.signOut()}>
            Ulos
          </button>
        </div>
      </header>

      <nav className="valilehdet" role="tablist" aria-label="Näkymä">
        {(
          [
            ["jono", "Jono", null],
            ["hyvaksytty", "Hyväksytyt", null],
            ["hylatty", "Hylätyt", " & piilotetut"],
          ] as const
        ).map(([id, nimi, lisa]) => (
          <button key={id} role="tab" aria-selected={valilehti === id} onClick={() => setValilehti(id)}>
            {nimi}
            {lisa && <span className="pitka">{lisa}</span>} <span className="lukumaara">{maarat[id]}</span>
          </button>
        ))}
      </nav>

      <main>
        {valilehti === "jono" ? (
          valittu ? (
            <section className="jono">
              <Kasittely
                key={valittu.id}
                piirros={valittu}
                paljastettu={paljastetut.has(valittu.id)}
                onPaljasta={() => setPaljastetut((s) => new Set(s).add(valittu.id))}
                onHyvaksy={() => asetaTila(valittu, "hyvaksytty", "hyväksytty")}
                onHylkaa={() => asetaTila(valittu, "hylatty", "hylätty")}
                onNosta={() => paivita(valittu, { nostettu: !valittu.nostettu })}
              />
              <aside className="jonolista" aria-label="Jono">
                <h2 className="ylaotsikko hiljainen">Jonossa {jono.length}</h2>
                {jono.map((p) => (
                  <button key={p.id} type="button" className="rivi" aria-current={p.id === valittu.id} onClick={() => setValittuId(p.id)}>
                    <PiirrosCanvas piirros={p} className={p.ai_arvio?.luokka === "sopimaton" && !paljastetut.has(p.id) ? "sumea" : undefined} />
                    <span className="rivi-teksti">
                      <strong>{tunnus(p.nro)}</strong>
                      <span className="hiljainen">
                        {lahteenNimi(p.lahde)} · klo {kellonaika(p.luotu)}
                      </span>
                    </span>
                    <span className="piste" style={{ background: p.ai_arvio ? LUOKAT[p.ai_arvio.luokka].vari : "var(--teksti-3)" }} />
                  </button>
                ))}
              </aside>
            </section>
          ) : (
            <div className="tyhja">
              <h2 className="otsikko glitch" data-teksti="Jono on tyhjä">
                Jono on tyhjä
              </h2>
              <p className="hiljainen">Uudet piirrokset ilmestyvät tänne automaattisesti.</p>
            </div>
          )
        ) : (
          <Galleria
            piirrokset={lista
              .filter((p) => (valilehti === "hyvaksytty" ? p.tila === "hyvaksytty" : p.tila === "hylatty" || p.tila === "piilotettu"))
              .sort((a, b) => Date.parse(b.moderoitu ?? b.luotu) - Date.parse(a.moderoitu ?? a.luotu))}
            hyvaksytyt={valilehti === "hyvaksytty"}
            onNosta={(p) => paivita(p, { nostettu: !p.nostettu })}
            onPiilota={(p) => asetaTila(p, "piilotettu", "piilotettu")}
            onPalauta={(p) => asetaTila(p, "jonossa", "palautettu jonoon")}
          />
        )}
      </main>

      {ilmoitus && (
        <div className={`ilmoitus${ilmoitus.peru ? "" : " ilman-perua"}`} role="status">
          <span>{ilmoitus.teksti}</span>
          {ilmoitus.peru && (
            <button
              className="nappi"
              type="button"
              onClick={() => {
                ilmoitus.peru?.();
                setIlmoitus(null);
              }}
            >
              Peru
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Näyttöjen syke ---

const SYKEVARIT: Record<SykkeenTila, string> = { ok: "var(--ok)", viive: "var(--varoitus)", poissa: "var(--vaara)" };

function Naytot({ naytot }: { naytot: NaytonSyke[] }) {
  // Päivittää "nähty X s sitten" -tekstit, vaikka uutta sykettä ei tulisi.
  const [nyt, setNyt] = useState(() => Date.now());
  useEffect(() => {
    const ajastin = setInterval(() => setNyt(Date.now()), 5000);
    return () => clearInterval(ajastin);
  }, []);

  if (!naytot.length) {
    return (
      <span className="siru naytto-syke" title="Yksikään näyttö ei ole vielä lähettänyt sykettä">
        <span className="piste" style={{ background: "var(--teksti-3)" }} />
        Ei näyttöjä
      </span>
    );
  }
  return (
    <>
      {naytot
        .sort((a, b) => a.tunnus.localeCompare(b.tunnus))
        .map((n) => {
          const tila = sykkeenTila(n, nyt);
          const t = n.tiedot;
          const kuvaus = [
            `Nähty ${ikaTekstina(n.viimeksi_nahty, nyt)} sitten`,
            t.verkossa === false && "ei verkkoyhteyttä – pyörii välimuistista",
            t.virheita_min ? `${t.virheita_min} virhettä viimeisen minuutin aikana` : null,
            t.silta &&
              (t.silta.yhteys
                ? `Resolume: Raapustamo-klippi ${t.silta.nakyvissa ? "screenillä" : "piilossa"}`
                : "Resolume-silta ei vastaa – piirrokset kiertävät ilman tahdistusta"),
            t.naytolla?.length ? `Screenillä: ${t.naytolla.map(tunnus).join(", ")}` : null,
            `Piirroksia muistissa: ${t.piirroksia ?? "?"}`,
            `Layout ${t.layout ?? "?"} · versio ${t.versio ?? "?"} · käynnissä ${t.kaynnissa_min ?? "?"} min`,
          ]
            .filter(Boolean)
            .join("\n");
          return (
            <span key={n.tunnus} className="siru naytto-syke" data-tila={tila} title={kuvaus}>
              <span className="piste" style={{ background: SYKEVARIT[tila] }} />
              {n.tunnus.toUpperCase()}
              <span className="hiljainen toiminto">&nbsp;· {ikaTekstina(n.viimeksi_nahty, nyt)}</span>
            </span>
          );
        })}
    </>
  );
}

// --- Yksittäisen piirroksen käsittely ---

interface KasittelyProps {
  piirros: Piirros;
  paljastettu: boolean;
  onPaljasta: () => void;
  onHyvaksy: () => void;
  onHylkaa: () => void;
  onNosta: () => void;
}

function Kasittely({ piirros, paljastettu, onPaljasta, onHyvaksy, onHylkaa, onNosta }: KasittelyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animaatio = useRef(0);
  const [dx, setDx] = useState(0);
  const [vetaa, setVetaa] = useState(false);
  const alkuX = useRef<number | null>(null);
  const piilotettu = piirros.ai_arvio?.luokka === "sopimaton" && !paljastettu;

  // Piirtymisen toisto paljastaa viivojen järjestyksen (esim. piilotetun tekstin)
  function toista() {
    cancelAnimationFrame(animaatio.current);
    const canvas = canvasRef.current;
    if (!canvas?.clientWidth) return;
    const px = sovitaCanvas(canvas, canvas.clientWidth);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const alku = performance.now();
    const askel = (nyt: number) => {
      const t = Math.min(1, (nyt - alku) / 1600);
      ctx.clearRect(0, 0, px, px);
      piirraPiirros(ctx, piirros, px, { edistyminen: 1 - (1 - t) ** 2 });
      if (t < 1) animaatio.current = requestAnimationFrame(askel);
    };
    animaatio.current = requestAnimationFrame(askel);
  }

  const toistaRef = useRef(toista);
  toistaRef.current = toista;
  useEffect(() => {
    toistaRef.current();
    const kuuntelija = (e: KeyboardEvent) => {
      if (e.key === " " && !(e.target as HTMLElement).closest("button, input")) {
        e.preventDefault();
        toistaRef.current();
      }
    };
    addEventListener("keydown", kuuntelija);
    return () => {
      removeEventListener("keydown", kuuntelija);
      cancelAnimationFrame(animaatio.current);
    };
  }, []);

  function lopetaVeto() {
    if (alkuX.current === null) return;
    alkuX.current = null;
    setVetaa(false);
    if (dx > 120) onHyvaksy();
    else if (dx < -120) onHylkaa();
    else setDx(0);
  }

  const arvio = piirros.ai_arvio;

  return (
    <div className="kasittely">
      <div
        className={`kortti${vetaa ? " vetaa" : ""}${piilotettu ? " sumea" : ""}`}
        style={{ transform: dx ? `translateX(${dx}px) rotate(${dx * 0.04}deg)` : undefined }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          alkuX.current = e.clientX;
          setVetaa(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        }}
        onPointerMove={(e) => alkuX.current !== null && setDx(e.clientX - alkuX.current)}
        onPointerUp={lopetaVeto}
        onPointerCancel={lopetaVeto}
      >
        <canvas ref={canvasRef} />
        <div className="kortti-yla">
          <span className="siru">
            <span className="piste" style={{ background: arvio ? LUOKAT[arvio.luokka].vari : "var(--teksti-3)" }} />
            {arvio ? `AI: ${LUOKAT[arvio.luokka].nimi} ${Math.round(arvio.varmuus * 100)} %` : "Ei tekoälyarviota"}
          </span>
          {piirros.nostettu && <span className="siru siru--valkoinen">★ Nostettu</span>}
        </div>
        {piilotettu && (
          <div className="paljasta">
            <span className="ylaotsikko">Tekoäly piilotti esikatselun</span>
            <button className="nappi nappi--toissijainen" type="button" onClick={onPaljasta}>
              Näytä piirros
            </button>
          </div>
        )}
        <span className="pyyhkaisy pyyhkaisy--hyvaksy" style={{ opacity: Math.max(0, Math.min(1, dx / 120)) }}>
          Hyväksy
        </span>
        <span className="pyyhkaisy pyyhkaisy--hylkaa" style={{ opacity: Math.max(0, Math.min(1, -dx / 120)) }}>
          Hylkää
        </span>
      </div>

      <div className="tiedot">
        <span className="siru">{tunnus(piirros.nro)}</span>
        <span className="siru">{lahteenNimi(piirros.lahde)}</span>
        <span className="siru">klo {kellonaika(piirros.luotu)}</span>
        <span className="siru">{piirros.kieli.toUpperCase()}</span>
        <span className="siru">{piirros.viivat.length} viivaa</span>
      </div>
      <p className="arvio">
        <strong>Tekoälyn arvio:</strong>{" "}
        {arvio ? `${arvio.syy} Tekoäly ei koskaan hyväksy piirrosta itse.` : "Tekoälyesisuodatus otetaan käyttöön myöhemmin. Tarkista piirros itse."}
      </p>
      <div className="paatokset">
        <button className="nappi nappi--vaara nappi--iso" type="button" onClick={onHylkaa}>
          ✕ Hylkää
        </button>
        <button className="ikoninappi" type="button" aria-label="Toista piirtyminen" title="Toista piirtyminen (välilyönti)" onClick={toista}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <button className="ikoninappi" type="button" aria-label="Nosta suosikiksi" title="Nosta suosikiksi (N)" aria-pressed={piirros.nostettu} onClick={onNosta}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
          </svg>
        </button>
        <button className="nappi nappi--ensisijainen nappi--iso" type="button" onClick={onHyvaksy}>
          ✓ Hyväksy
        </button>
      </div>
      <span className="pikanappaimet">
        <kbd>←</kbd> / <kbd>H</kbd> hylkää · <kbd>→</kbd> / <kbd>A</kbd> hyväksy · <kbd>N</kbd> nosta · <kbd>välilyönti</kbd> toista · <kbd>↑</kbd>
        <kbd>↓</kbd> selaa
      </span>
    </div>
  );
}

// --- Hyväksytyt / hylätyt ---

interface GalleriaProps {
  piirrokset: Piirros[];
  hyvaksytyt: boolean;
  onNosta: (p: Piirros) => void;
  onPiilota: (p: Piirros) => void;
  onPalauta: (p: Piirros) => void;
}

function Galleria({ piirrokset, hyvaksytyt, onNosta, onPiilota, onPalauta }: GalleriaProps) {
  if (!piirrokset.length) {
    return (
      <div className="tyhja">
        <h2 className="otsikko">Ei piirroksia</h2>
      </div>
    );
  }
  return (
    <section className="galleria">
      {piirrokset.map((p) => (
        <article key={p.id} className="galleriakortti">
          <PiirrosCanvas piirros={p} />
          <div className="ala">
            <div className="tiedot">
              <strong>{tunnus(p.nro)}</strong>
              {hyvaksytyt ? (
                <span className="hiljainen">Näytetty {p.nayttokerrat}×</span>
              ) : (
                <span className="siru">{p.tila === "piilotettu" ? "Piilotettu" : "Hylätty"}</span>
              )}
            </div>
            <div className="toiminnot">
              {hyvaksytyt ? (
                <>
                  <button
                    className="ikoninappi"
                    type="button"
                    title={p.nostettu ? "Poista nosto" : "Nosta suosikiksi"}
                    aria-label={p.nostettu ? "Poista nosto" : "Nosta suosikiksi"}
                    aria-pressed={p.nostettu}
                    onClick={() => onNosta(p)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
                    </svg>
                  </button>
                  <button className="nappi nappi--vaara" type="button" title="Poistaa piirroksen screeniltä ja galleriasta välittömästi" onClick={() => onPiilota(p)}>
                    Piilota heti
                  </button>
                </>
              ) : (
                <button className="nappi nappi--toissijainen" type="button" onClick={() => onPalauta(p)}>
                  Palauta jonoon
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
