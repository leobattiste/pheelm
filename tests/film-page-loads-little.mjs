// The film page must not pull the whole catalog. A cold render that reads every film, person and
// credit ran past the time limit once the catalog passed two thousand films, and visitors got
// React error #441. These checks guard the shape of the fix, not its wording.
import assert from "node:assert";
import { readFileSync } from "node:fs";

const page = readFileSync("app/films/[slug]/page.tsx", "utf8");
const data = readFileSync("lib/data.ts", "utf8");

// The page body and its metadata both go through the trimmed loader.
assert.match(page, /filmPageCatalog/, "the film page should load its catalog through filmPageCatalog");
assert.equal((page.match(/filmPageCatalog\(/g) ?? []).length, 2, "generateMetadata and the page body should each call filmPageCatalog, and nothing else should");

// The whole-catalog loaders must not be back on the render path.
for (const banned of ["getDirectors(", "getCommunityCollections("])
  assert.ok(!page.includes(banned), `${banned} loads the whole catalog, so the film page should not call it`);
// getFilms stays, but only for generateStaticParams, which runs at build time.
const staticParams = page.slice(page.indexOf("generateStaticParams"), page.indexOf("generateMetadata"));
assert.ok(staticParams.includes("getFilms()"), "generateStaticParams may use getFilms");
assert.equal((page.match(/getFilms\(\)/g) ?? []).length, 1, "getFilms belongs to generateStaticParams alone");

// The tile count comes from the list, not from the three posters the tile shows.
assert.match(page, /<CommunityTile[^>]*filmCount=\{c\.filmCount\}/, "pass the real film count, or every tile reads '3 films'");

// The loader reads only director credits across the catalog, plus this film's own people.
assert.match(data, /readAll<CreditRow>\(db, "credits", \(q\) => q\.eq\("role", "director"\)\)/, "only director credits should be read for every film");
assert.match(data, /q\.eq\("film_id", film\.id\)/, "this film's own credits should be read");
assert.match(data, /q\.in\("person_id",/, "the credits of this film's people should be read, for their filmographies");
assert.match(data, /q\.in\("id",/, "only the people actually referenced should be read");

// Local work and CI run on the starter catalog, which has no Supabase behind it.
assert.match(data, /if \(!supabaseEnabled\) \{\s*const c = await catalog\(\);/, "without Supabase the loader should fall back to the starter catalog");

console.log("ok  film page loads only what it needs");
