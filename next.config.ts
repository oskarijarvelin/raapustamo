import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Natiivi .node-binääri, jota ei voi niputtaa: piirrosten PNG-esikatselu tekoälylle.
  serverExternalPackages: ["@resvg/resvg-js"],
  // Raapustamo on työkalu, ei julkinen sivusto: hakukoneet eivät indeksoi mitään sen osoitetta.
  // Otsake kattaa myös API-vastaukset ja kuvat, joihin metatagi ei ulotu. Robots.txt jätetään
  // tarkoituksella pois, koska se estäisi hakukoneita näkemästä noindex-ohjetta.
  headers: async () => [
    { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] },
  ],
  env: {
    // Näytön syke kertoo moderointiin, mikä versio screenillä pyörii.
    NEXT_PUBLIC_VERSIO: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  },
};

export default nextConfig;
