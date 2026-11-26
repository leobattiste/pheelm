// The film page must not pull the whole catalog. A cold render that reads every film, person and
// credit ran past the time limit once the catalog passed two thousand films, and visitors got
// React error #441. These checks guard the shape of the fix, not its wording.
import assert from "node:assert";
import { readFileSync } from "node:fs";

const page = readFileSync("app/films/[slug]/FilmPageView.tsx", "utf8");
const route = readFileSync("app/films/[slug]/page.tsx", "utf8");
const data = readFileSync("lib/data.ts", "utf8");

// The page body and its metadata both go through the trimmed loader.
assert.match(page, /filmPageCatalog/, "the film page should load its catalog through filmPageCatalog");
assert.equal((page.match(/filmPageCatalog\(/g) ?? []).length, 2, "generateMetadata and the page body should each call filmPageCatalog, and nothing else should");

// The whole-catalog loaders must not be back on the render path.
for (const banned of ["getDirectors(", "getCommunityCollections("])
  assert.ok(!page.includes(banned), `${banned} loads the whole catalog, so the film page should not call it`);
// getFilms stays, but only for generateStaticParams, which runs at build time.
const staticParams = route.slice(route.indexOf("generateStaticParams"), route.indexOf("generateMetadata"));
assert.ok(staticParams.includes("getFilms()"), "generateStaticParams may use getFilms");
assert.equal((route.match(/getFilms\(\)/g) ?? []).length, 1, "getFilms belongs to generateStaticParams alone");
assert.ok(!page.includes("getFilms("), "the film page view never loads the whole film list");

// The tile count comes from the list, not from the three posters the tile shows.
assert.match(page, /<CommunityTile[^>]*filmCount=\{c\.filmCount\}/, "pass the real film count, or every tile reads '3 films'");

// The loader reads only director credits across the catalog, plus this film's own people.
assert.match(data, /readAll<CreditRow>\(db, "credits", \(q\) => q\.eq\("role", "director"\)\)/, "only director credits should be read for every film");
assert.match(data, /q\.eq\("film_id", film\.id\)/, "this film's own credits should be read");
assert.match(data, /readIn<CreditRow>\(db, "credits", "person_id",/, "the credits of this film's people should be read, for their filmographies");
assert.match(data, /readIn<PersonRow>\(db, "people", "id",/, "only the people actually referenced should be read");

// Thousands of ids do not fit in one request URL, so these reads go in chunks.
assert.match(data, /i \* 200, i \* 200 \+ 200/, "readIn should chunk its ids so the query string stays short");

// Local work and CI run on the starter catalog, which has no Supabase behind it.
assert.match(data, /if \(!supabaseEnabled \|\| building\(\) \|\| warm\(\) \|\| \(await snapshotOn\(\)\)\) \{\s*const c = await catalog\(\);/, "a build, a machine without Supabase, a server already holding the catalog, and a current snapshot should share one catalog instead of reading per page");

console.log("ok  film page loads only what it needs");
