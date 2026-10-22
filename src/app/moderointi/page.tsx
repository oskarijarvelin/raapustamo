import type { Metadata } from "next";
import Moderointi from "@/components/moderointi/Moderointi";

export const metadata: Metadata = {
  title: "Moderointi – Raapustamo",
  robots: { index: false, follow: false },
};

export default function Moderointisivu() {
  return <Moderointi />;
}
