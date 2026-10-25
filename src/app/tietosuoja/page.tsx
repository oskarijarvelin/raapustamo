import type { Metadata } from "next";
import OikeudellinenSivu from "@/components/oikeudelliset/OikeudellinenSivu";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { kieli } = await searchParams;
  return { title: kieli === "en" ? "Privacy notice – Raapustamo" : "Tietosuojaseloste – Raapustamo" };
}

export default async function Tietosuoja({ searchParams }: Props) {
  const { kieli } = await searchParams;
  return <OikeudellinenSivu sivu="tietosuoja" kieli={kieli === "en" ? "en" : "fi"} />;
}
