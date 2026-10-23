import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Natiivi .node-binääri, jota ei voi niputtaa: piirrosten PNG-esikatselu tekoälylle.
  serverExternalPackages: ["@resvg/resvg-js"],
  env: {
    // Näytön syke kertoo moderointiin, mikä versio screenillä pyörii.
    NEXT_PUBLIC_VERSIO: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  },
};

export default nextConfig;
