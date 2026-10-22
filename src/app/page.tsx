import type { Viewport } from "next";
import Piirtonakyma from "@/components/piirto/Piirtonakyma";
import { KIOSKI } from "@/lib/kioski";
import type { Kieli } from "@/lib/tyypit";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default async function Etusivu({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { kiosk, kieli } = await searchParams;
  return (
    <Piirtonakyma
      kioski={typeof kiosk === "string" && KIOSKI.test(kiosk) ? kiosk : null}
      kieli={kieli === "fi" || kieli === "en" ? (kieli as Kieli) : null}
    />
  );
}
