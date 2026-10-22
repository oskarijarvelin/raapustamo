// Palvelimen Supabase-asiakas service role -avaimella. Ohittaa RLS:n, joten tätä
// käytetään vain API-reiteissä – älä koskaan tuo tätä tiedostoa client-komponenttiin.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let asiakas: SupabaseClient | null = null;

export function palvelinAsiakas(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const avain = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !avain) return null;
  asiakas ??= createClient(url, avain, { auth: { persistSession: false, autoRefreshToken: false } });
  return asiakas;
}
