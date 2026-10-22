"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let asiakas: SupabaseClient | null = null;

/** Selaimen Supabase-asiakas (anon-avain). Näkee vain sen, minkä RLS sallii. */
export function selainAsiakas(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const avain = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !avain) return null;
  asiakas ??= createBrowserClient(url, avain);
  return asiakas;
}

/** Realtime-kanava, jolla moderointi lähettää näytölle välittömät komennot. */
export const NAYTTOKANAVA = "naytto";
