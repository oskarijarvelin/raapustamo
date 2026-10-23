// Keynote-editorin ja -näytön yhteys. Tuotannossa Supabase: viivat kulkevat yksityisellä
// Realtime-kanavalla ja lavan tila tallentuu `lavat`-tauluun. Kehityksessä ilman Supabasea
// saman selaimen välilehdet keskustelevat BroadcastChannelilla ja tila tallentuu localStorageen.
import type { SupabaseClient } from "@supabase/supabase-js";
import { lavanKanava, type KeynoteViesti, type TallennettuLava } from "@/lib/keynote";

export type Yhteydentila = "yhdistetaan" | "yhdistetty" | "virhe";

interface Kuuntelijat<T> {
  viesti?: (viesti: T) => void;
  yhteys?: (tila: Yhteydentila, syy?: string) => void;
}

export interface Kanava<T> {
  /** Lähettää viestin, jos kanava on auki. Muuten viesti jätetään pois. */
  laheta(viesti: T): void;
  sulje(): void;
}

/** Yksityinen Realtime-broadcast-kanava, tai kehityksessä ilman Supabasea BroadcastChannel. */
export function avaaKanava<T>(supabase: SupabaseClient | null, nimi: string, tapahtuma: string, kuuntelijat: Kuuntelijat<T>): Kanava<T> {
  return supabase ? supabaseKanava(supabase, nimi, tapahtuma, kuuntelijat) : paikallinenKanava(nimi, kuuntelijat);
}

function supabaseKanava<T>(supabase: SupabaseClient, nimi: string, tapahtuma: string, { viesti, yhteys }: Kuuntelijat<T>): Kanava<T> {
  let auki = false;
  let suljettu = false;
  const kanava = supabase.channel(nimi, { config: { private: true, broadcast: { self: false, ack: false } } });
  if (viesti) kanava.on("broadcast", { event: tapahtuma }, ({ payload }) => viesti(payload as T));

  yhteys?.("yhdistetaan");
  // Yksityinen kanava tarvitsee kirjautuneen käyttäjän tunnisteen (näytöllä anon-avaimen).
  void supabase.realtime.setAuth().then(() => {
    if (suljettu) return;
    kanava.subscribe((tila, virhe) => {
      auki = tila === "SUBSCRIBED";
      if (auki) yhteys?.("yhdistetty");
      else if (tila === "CLOSED") yhteys?.("yhdistetaan");
      else yhteys?.("virhe", virhe?.message ?? tila);
    });
  });

  return {
    laheta(v) {
      if (auki) void kanava.send({ type: "broadcast", event: tapahtuma, payload: v });
    },
    sulje() {
      suljettu = true;
      void supabase.removeChannel(kanava);
    },
  };
}

function paikallinenKanava<T>(nimi: string, { viesti, yhteys }: Kuuntelijat<T>): Kanava<T> {
  const kanava = new BroadcastChannel(nimi);
  let suljettu = false;
  if (viesti) kanava.onmessage = (e) => viesti(e.data as T);
  queueMicrotask(() => !suljettu && yhteys?.("yhdistetty"));
  return {
    laheta: (v) => !suljettu && kanava.postMessage(v),
    sulje: () => {
      suljettu = true;
      kanava.close();
    },
  };
}

// --- Lava: viivat ja tallennettu tila ---

export interface Lavayhteys extends Kanava<KeynoteViesti> {
  lataa(): Promise<TallennettuLava | null>;
  /** Tallennetun tilan versio (kevyt tarkistus ennen koko tilan hakua), -1 = ei tallennettu */
  lataaVersio(): Promise<number | null>;
  tallenna(rivi: TallennettuLava): Promise<boolean>;
}

const TAPAHTUMA = "keynote";
const KENTAT = "tunnus, viivat, suhde, versio, nakyvissa";

export function avaaLava(supabase: SupabaseClient | null, lava: string, kuuntelijat: Kuuntelijat<KeynoteViesti>): Lavayhteys {
  const kanava = avaaKanava(supabase, lavanKanava(lava), TAPAHTUMA, kuuntelijat);
  return { ...kanava, ...(supabase ? supabaseTallennus(supabase, lava) : paikallinenTallennus(lava)) };
}

function supabaseTallennus(supabase: SupabaseClient, lava: string): Omit<Lavayhteys, keyof Kanava<KeynoteViesti>> {
  return {
    async lataa() {
      const { data, error } = await supabase.from("lavat").select(KENTAT).eq("tunnus", lava).maybeSingle();
      if (error) throw error;
      return data as TallennettuLava | null;
    },
    async lataaVersio() {
      const { data, error } = await supabase.from("lavat").select("versio").eq("tunnus", lava).maybeSingle();
      if (error) return null;
      return data ? (data.versio as number) : -1;
    },
    async tallenna(rivi) {
      const { error } = await supabase.from("lavat").upsert({ ...rivi, paivitetty: new Date().toISOString() });
      if (error) console.warn("Lavan tallennus epäonnistui", error.message);
      return !error;
    },
  };
}

function paikallinenTallennus(lava: string): Omit<Lavayhteys, keyof Kanava<KeynoteViesti>> {
  const avain = `raapustamo:keynote:${lava}`;
  const lue = (): TallennettuLava | null => {
    try {
      return JSON.parse(localStorage.getItem(avain) ?? "null");
    } catch {
      return null;
    }
  };
  return {
    lataa: async () => lue(),
    lataaVersio: async () => lue()?.versio ?? -1,
    async tallenna(rivi) {
      try {
        localStorage.setItem(avain, JSON.stringify(rivi));
        return true;
      } catch {
        return false;
      }
    },
  };
}
