// Luo näytöille avaimet sykettä varten ja tulostaa asennusosoitteet sekä rekisteröinnin SQL:n
// (migraatio 0005). Avain on satunnainen, ja tietokantaan tallennetaan vain sen SHA-256-tiiviste.
// Uusi ajo luo uudet avaimet: aja SQL uudelleen ja avaa näytölle uusi asennusosoite.
//
//   npm run nayttoavain -- led-1 keynote-lava-1
//   npm run nayttoavain -- --osoite https://www.raapustamo.fi led-1
import { createHash, randomBytes } from "node:crypto";

const TUNNUS = /^[a-z0-9-]{1,40}$/;
const KEYNOTE = /^keynote-([a-z0-9-]{1,30})$/;

const argumentit = process.argv.slice(2);
let osoite = "http://localhost:3000";
const naytot = [];
for (let i = 0; i < argumentit.length; i++) {
  if (argumentit[i] === "--osoite") osoite = argumentit[++i];
  else naytot.push(argumentit[i]);
}
if (naytot.length === 0 || naytot.some((t) => !TUNNUS.test(t))) {
  console.error("Anna näyttöjen tunnukset, esim. led-1 tai keynote-lava-1 (pienet kirjaimet, numerot ja viivat).");
  process.exit(1);
}

const sql = [];
console.log("Asennusosoitteet (avaa kerran näytön selaimessa, avain tallentuu laitteelle):\n");
for (const tunnus of naytot) {
  const avain = randomBytes(16).toString("base64url");
  const tiiviste = createHash("sha256").update(avain, "utf8").digest("hex");
  const keynote = tunnus.match(KEYNOTE);
  const url = new URL(keynote ? "/keynote/naytto" : "/naytto", osoite);
  if (keynote) url.searchParams.set("lava", keynote[1]);
  else url.searchParams.set("tunnus", tunnus);
  url.searchParams.set("avain", avain);
  console.log(`${tunnus}  ${url}`);
  sql.push(`  ('${tunnus}', '${tiiviste}')`);
}

console.log(`
Lisää muut parametrit tarpeen mukaan (esim. LED: &skaala=1&silta=http://localhost:7400, keynote: &lapinakyva=1).

Rekisteröinti (Supabase → SQL Editor):

insert into public.naytot (tunnus, avain_tiiviste) values
${sql.join(",\n")}
on conflict (tunnus) do update set avain_tiiviste = excluded.avain_tiiviste;
`);
