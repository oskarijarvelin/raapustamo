// Tulostaa kioskien asennusosoitteet. Avain lasketaan samoin kuin src/lib/kioski.ts:ssä.
//
//   npm run kioskiavain -- ipad-1 ipad-2
//   npm run kioskiavain -- --osoite https://raapustamo.fi ipad-1
//
// Lukee KIOSKI_SALAISUUS-muuttujan ympäristöstä tai .env.local-tiedostosta.
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";

export const kioskiavain = (salaisuus, kioski) =>
  createHmac("sha256", salaisuus).update(`kioski:${kioski}`).digest("base64url").slice(0, 22);

function main(argumentit) {
  const salaisuus = process.env.KIOSKI_SALAISUUS;
  if (!salaisuus) {
    console.error("KIOSKI_SALAISUUS puuttuu (.env.local tai ympäristömuuttuja).");
    process.exit(1);
  }
  let osoite = "http://localhost:3000";
  const kioskit = [];
  for (let i = 0; i < argumentit.length; i++) {
    if (argumentit[i] === "--osoite") osoite = argumentit[++i];
    else kioskit.push(argumentit[i]);
  }
  if (kioskit.length === 0 || kioskit.some((k) => !/^ipad-[1-9][0-9]?$/.test(k))) {
    console.error("Anna kioskien tunnukset muodossa ipad-1 … ipad-99.");
    process.exit(1);
  }
  for (const kioski of kioskit) {
    const url = new URL(osoite);
    url.searchParams.set("kiosk", kioski);
    url.searchParams.set("avain", kioskiavain(salaisuus, kioski));
    console.log(`${kioski}  ${url}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
