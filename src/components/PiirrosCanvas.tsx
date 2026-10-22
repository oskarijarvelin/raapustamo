"use client";

import { useEffect, useRef } from "react";
import { piirraKokonaan } from "@/lib/piirto";
import type { Viiva } from "@/lib/tyypit";

/** Piirtää piirroksen canvasille ja päivittää sen koon muuttuessa. */
export default function PiirrosCanvas({ piirros, className }: { piirros: { viivat: Viiva[] }; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const havainnoija = new ResizeObserver(() => piirraKokonaan(canvas, piirros));
    havainnoija.observe(canvas);
    return () => havainnoija.disconnect();
  }, [piirros]);

  return <canvas ref={ref} className={className} />;
}
