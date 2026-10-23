// Keynote-editorin ja -näytön yhteys. Tuotannossa Supabase: viivat kulkevat yksityisellä
// Realtime-kanavalla ja lavan tila tallentuu `lavat`-tauluun. Kehityksessä ilman Supabasea
// saman selaimen välilehdet keskustelevat BroadcastChannelilla ja tila tallentuu localStorageen.
import type { SupabaseClient } from "@supabase/supabase-js";
import { lavanKanava, type KeynoteViesti, type TallennettuLava } from "@/lib/keynote";

export type Yhteydentila = "yhdistetaan" | "yhdistetty" | "virhe";

export interface Lavayhteys {
  paikallinen: boolean;
  /** Lähettää viestin, jos kanava on auki. Muuten viesti jätetään pois: näyttö synkronoi tallennetusta tilasta. */
  laheta(viesti: KeynoteViesti): void;
  lataa(): Promise<TallennettuLava | null>;
  /** Tallennetun tilan versio (kevyt tarkistus ennen koko tilan hakua), -1 = ei tallennettu */
  lataaVersio(): Promise<number | null>;
  tallenna(rivi: TallennettuLava): Promise<boolean>;
  sulje(): void;
}

interface Kuuntelijat {
  viesti?: (viesti: KeynoteViesti) => void;
  yhteys?: (tila: Yhteydentila, syy?: string) => void;
}

const TAPAHTUMA = "keynote";
const KENTAT = "tunnus, viivat, suhde, versio, nakyvissa";

export function avaaLava(supabase: SupabaseClient | null, lava: string, kuuntelijat: Kuuntelijat): Lavayhteys {
  return supabase ? supabaseLava(supabase, lava, kuuntelijat) : paikallinenLava(lava, kuuntelijat);
}

function supabaseLava(supabase: SupabaseClient, lava: string, { viesti, yhteys }: Kuuntelijat): Lavayhteys {
  let auki = false;
  let suljettu = false;
  const kanava = supabase.channel(lavanKanava(lava), { config: { private: true, broadcast: { self: false, ack: false } } });
  if (viesti) kanava.on("broadcast", { event: TAPAHTUMA }, ({ payload }) => viesti(payload as KeynoteViesti));

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
    paikallinen: false,
    laheta(v) {
      if (auki) void kanava.send({ type: "broadcast", event: TAPAHTUMA, payload: v });
    },
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
    sulje() {
      suljettu = true;
      void supabase.removeChannel(kanava);
    },
  };
}

function paikallinenLava(lava: string, { viesti, yhteys }: Kuuntelijat): Lavayhteys {
  const kanava = new BroadcastChannel(lavanKanava(lava));
  const avain = `raapustamo:keynote:${lava}`;
  if (viesti) kanava.onmessage = (e) => viesti(e.data as KeynoteViesti);
  queueMicrotask(() => yhteys?.("yhdistetty"));

  const lue = (): TallennettuLava | null => {
    try {
      return JSON.parse(localStorage.getItem(avain) ?? "null");
    } catch {
      return null;
    }
  };

  return {
    paikallinen: true,
    laheta: (v) => kanava.postMessage(v),
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
    sulje: () => kanava.close(),
  };
}
