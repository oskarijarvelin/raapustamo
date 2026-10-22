// Piirrosten vastaanotto: validointi → rate limit → tallennus moderointijonoon.
import { NextResponse } from "next/server";
import { laitetunniste, odotusaika, rajaLahteelle } from "@/lib/rajoitus";
import { palvelinAsiakas } from "@/lib/supabase/palvelin";
import { tarkistaLahetys } from "@/lib/validointi";

const MAKSIMIKOKO = 400_000; // tavua

const vastaus = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(pyynto: Request) {
  const supabase = palvelinAsiakas();
  const suola = process.env.LAITE_SUOLA;
  if (!supabase || !suola) return vastaus(503, { virhe: "palvelu-ei-kaytossa" });

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

  const laite = laitetunniste(pyynto.headers, suola);
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

  return vastaus(201, { id: piirros.id, nro: piirros.nro });
}
