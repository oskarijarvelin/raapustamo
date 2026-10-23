"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import "./kirjautuminen.css";

/** Sähköposti- ja salasanakirjautuminen (Supabase Auth): moderointi ja keynote-editori. */
export default function Kirjautuminen({ supabase, otsikko }: { supabase: SupabaseClient; otsikko: string }) {
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
        <h1 className="otsikko">{otsikko}</h1>
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
