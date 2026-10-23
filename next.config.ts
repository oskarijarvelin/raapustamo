import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Natiivi .node-binääri, jota ei voi niputtaa: piirrosten PNG-esikatselu tekoälylle.
  serverExternalPackages: ["@resvg/resvg-js"],
  // Raapustamo on työkalu, ei julkinen sivusto: hakukoneet eivät indeksoi mitään sen osoitetta.
  // Otsake kattaa myös API-vastaukset ja kuvat, joihin metatagi ei ulotu. Robots.txt jätetään
  // tarkoituksella pois, koska se estäisi hakukoneita näkemästä noindex-ohjetta.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        // Sivuja ei saa upottaa vieraille sivuille: estää esim. moderoinnin klikkausten kaappaamisen
        // (clickjacking). Näytöt avataan selainlähteissä (OBS, SpoutBrowser) suoraan, ei iframessa.
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Kamera ja ruudunjako vain omalle sivustolle (keynote-lähetin), muut laiteoikeudet pois.
        { key: "Permissions-Policy", value: "camera=(self), display-capture=(self), microphone=(), geolocation=(), payment=(), usb=()" },
      ],
    },
  ],
  env: {
    // Näytön syke kertoo moderointiin, mikä versio screenillä pyörii.
    NEXT_PUBLIC_VERSIO: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  },
};

export default nextConfig;
