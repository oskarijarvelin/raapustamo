// Piirrosten vastaanotto: validointi → kioskin avain → Turnstile → rate limit → tallennus moderointijonoon
// → tekoälyesisuodatus vastauksen jälkeen.
import { after, NextResponse } from "next/server";
import { arvioiPiirros } from "@/lib/ai-arvio";
import { onKioskiavain } from "@/lib/kioski";
import { asiakkaanIp, laitetunniste, odotusaika, rajaLahteelle } from "@/lib/rajoitus";
import { palvelinAsiakas } from "@/lib/supabase/palvelin";
import { hostnimet, tarkistaTurnstile } from "@/lib/turnstile";
import { tarkistaLahetys } from "@/lib/validointi";

const MAKSIMIKOKO = 400_000; // tavua
const TURNSTILE_HOSTNIMET = hostnimet(process.env.TURNSTILE_HOSTNAMES);
// Ilman näitä lähetys ei ole käytössä. Lokiin kirjataan vain nimet, ei koskaan arvoja.
const PAKOLLISET = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "LAITE_SUOLA", "TURNSTILE_SECRET"];

const vastaus = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(pyynto: Request) {
  const supabase = palvelinAsiakas();
  const suola = process.env.LAITE_SUOLA;
  const turnstileSalaisuus = process.env.TURNSTILE_SECRET;
  if (!supabase || !suola || !turnstileSalaisuus) {
    const puuttuvat = PAKOLLISET.filter((nimi) => !process.env[nimi]);
    console.error("Lähetys ei ole käytössä, puuttuvat ympäristömuuttujat:", puuttuvat.join(", ") || "ei tiedossa");
    return vastaus(503, { virhe: "palvelu-ei-kaytossa" });
  }

  const raaka = await pyynto.text();
  if (raaka.length > MAKSIMIKOKO) return vastaus(413, { virhe: "liian-suuri" });

  let data: unknown;
  try {
    data = JSON.parse(raaka);
  } catch {
    return vastaus(400, { virhe: "virheellinen-json" });
  }

  const tulos = tarkistaLahetys(data);
  if (!tulos.ok) return vastaus(400, { virhe: "virheellinen-piirros", syy: tulos.virhe });
  const { viivat, lahde, kieli } = tulos.lahetys;
  const { turnstile, kioskiavain } = data as Record<string, unknown>;

  // Kioskin väljempi raja vaatii kioskikohtaisen avaimen, muuten lähde olisi väärennettävissä.
  const kioski = lahde === "mobiili" ? undefined : lahde;
  const kioskiSalaisuus = process.env.KIOSKI_SALAISUUS;
  if (kioski && !(kioskiSalaisuus && onKioskiavain(kioskiSalaisuus, kioski, kioskiavain))) {
    return vastaus(403, { virhe: "kioski-tunnistamaton" });
  }

  const ip = asiakkaanIp(pyynto.headers);
  const ihminen = await tarkistaTurnstile(turnstile, {
    salaisuus: turnstileSalaisuus,
    hostnimet: TURNSTILE_HOSTNIMET,
    tuotanto: process.env.VERCEL_ENV === "production",
    ip,
  });
  if (!ihminen.ok) {
    console.warn("Turnstile hylkäsi lähetyksen:", ihminen.syy);
    return vastaus(403, { virhe: "tarkistus-epaonnistui" });
  }

  const laite = laitetunniste(pyynto.headers, suola, kioski);
  const tuntiSitten = new Date(Date.now() - 3600_000).toISOString();
  const { data: aiemmat, error: hakuvirhe } = await supabase
    .from("lahetykset")
    .select("luotu")
    .eq("laite_hash", laite)
    .gte("luotu", tuntiSitten)
    .order("luotu", { ascending: false });
  if (hakuvirhe) {
    console.error("Rate limit -haku epäonnistui", hakuvirhe);
    return vastaus(500, { virhe: "palvelinvirhe" });
  }

  const odota = odotusaika(
    (aiemmat ?? []).map((r) => Date.parse(r.luotu)),
    rajaLahteelle(lahde),
  );
  if (odota > 0) {
    return NextResponse.json({ virhe: "liian-usein", odota }, { status: 429, headers: { "Retry-After": String(odota) } });
  }

  const { data: piirros, error: lisaysvirhe } = await supabase
    .from("piirrokset")
    .insert({ viivat, lahde, kieli })
    .select("id, nro")
    .single();
  if (lisaysvirhe || !piirros) {
    console.error("Piirroksen tallennus epäonnistui", lisaysvirhe);
    return vastaus(500, { virhe: "palvelinvirhe" });
  }

  const { error: lokivirhe } = await supabase.from("lahetykset").insert({ piirros_id: piirros.id, laite_hash: laite });
  if (lokivirhe) console.error("Lähetyslokin kirjaus epäonnistui", lokivirhe);

  // Tekoälyesisuodatus vastauksen jälkeen, jottei kävijä odota sitä. Moderointi saa arvion Realtimella.
  after(async () => {
    const arvio = await arvioiPiirros(viivat);
    if (!arvio) return;
    const { error } = await supabase.from("piirrokset").update({ ai_arvio: arvio }).eq("id", piirros.id);
    if (error) console.error("Tekoälyarvion tallennus epäonnistui", error);
  });

  return vastaus(201, { id: piirros.id, nro: piirros.nro });
}
