"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import Kirjautuminen from "@/components/kirjautuminen/Kirjautuminen";
import { selainAsiakas } from "@/lib/supabase/selain";

/**
 * Keynote-editori ja -lähetin vaativat kirjautumisen ja keynote-oikeuden (esiintyjät ja moderaattorit).
 * Kehityksessä ilman Supabasea sisältö näytetään ilman kirjautumista (`supabase` = null), jolloin
 * saman selaimen välilehdet keskustelevat keskenään.
 */
export default function KeynoteOikeus({ otsikko, children }: { otsikko: string; children: (supabase: SupabaseClient | null) => ReactNode }) {
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
    if (process.env.NODE_ENV !== "production") return children(null);
    return (
      <div className="kirjautuminen">
        <p className="hiljainen">Supabase-asetukset puuttuvat.</p>
      </div>
    );
  }
  if (istunto === undefined || (istunto && oikeus === null)) return <div className="kirjautuminen hiljainen">Ladataan…</div>;
  if (!istunto) return <Kirjautuminen supabase={supabase} otsikko={otsikko} />;
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
  return children(supabase);
}
