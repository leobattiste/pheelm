/**
 * Reads a search like "nigerian comedies from the 90s" or "senegal documentaries" as filters:
 * country, genre, decade or year, and what's left over as words to match. So a search can go
 * straight to the right slice of the Films page, not only to titles that contain those words.
 */
import { ALL_COUNTRIES } from "./countries";
import { plain } from "./fuzzy";

export type Parsed = {
  country: string | null;
  genre: string | null;
  decade: string | null;
  year: number | null;
  /** "by women", "women directors": films by women directors. */
  women: boolean;
  /** "directors", "filmmakers": the person is looking for people, not films. */
  people: boolean;
  /** What's left once the filters are taken out, for matching titles and names. */
  rest: string;
};

// What people call nationalities, for the countries on Pheelm and a few more.
const DEMONYMS: Record<string, string> = {
  nigerian: "NG", nollywood: "NG", senegalese: "SN", ghanaian: "GH", kenyan: "KE", "south african": "ZA",
  ethiopian: "ET", malian: "ML", burkinabe: "BF", cameroonian: "CM", ivorian: "CI", congolese: "CD",
  brazilian: "BR", haitian: "HT", jamaican: "JM", british: "GB", english: "GB", uk: "GB", american: "US",
  usa: "US", us: "US", french: "FR", canadian: "CA", cuban: "CU", martinican: "MQ", guadeloupean: "GP",
  rwandan: "RW", ugandan: "UG", zambian: "ZM", sudanese: "SD", chadian: "TD", mauritanian: "MR",
  guinean: "GN", gabonese: "GA", angolan: "AO", mozambican: "MZ", zimbabwean: "ZW", tanzanian: "TZ",
  somali: "SO", egyptian: "EG", moroccan: "MA", tunisian: "TN", algerian: "DZ", trinidadian: "TT",
  bahamian: "BS", colombian: "CO", dominican: "DO", lesotho: "LS", basotho: "LS", nigerien: "NE",
  beninese: "BJ", togolese: "TG", liberian: "LR", "sierra leonean": "SL", gambian: "GM", bissau: "GW",
  "cape verdean": "CV", curacaoan: "CW", dutch: "NL", belgian: "BE", german: "DE", portuguese: "PT",
};

// The genres on Pheelm, and the words people use for them.
const GENRES: Record<string, string> = {
  drama: "Drama", dramas: "Drama", comedy: "Comedy", comedies: "Comedy", funny: "Comedy", crime: "Crime",
  documentary: "Documentary", documentaries: "Documentary", doc: "Documentary", docs: "Documentary",
  romance: "Romance", romantic: "Romance", "love story": "Romance", "love stories": "Romance",
  thriller: "Thriller", thrillers: "Thriller", action: "Action", history: "History", historical: "History",
  music: "Music", musical: "Music", musicals: "Music", fantasy: "Fantasy", horror: "Horror", scary: "Horror",
  "science fiction": "Science Fiction", "sci fi": "Science Fiction", scifi: "Science Fiction",
  afrofuturist: "Science Fiction", afrofuturism: "Science Fiction", adventure: "Adventure", war: "War",
  mystery: "Mystery", family: "Family", kids: "Family", animation: "Animation", animated: "Animation",
  western: "Western", westerns: "Western", biography: "Biography", biopic: "Biography", biopics: "Biography",
  experimental: "Experimental",
};

// Words that only frame the request.
const FILLER = new Set(["film", "films", "movie", "movies", "cinema", "by", "from", "in", "the", "of", "about", "and",
  "made", "set", "with", "a", "an", "best", "top", "good", "great", "classic", "classics", "black", "show", "me", "find", "some",
  "directed", "on"]);
const PEOPLE = new Set(["director", "directors", "filmmaker", "filmmakers"]);
const WOMEN = new Set(["women", "woman", "female", "she"]);

const COUNTRY_BY_NAME = new Map(Object.entries(ALL_COUNTRIES).map(([code, name]) => [plain(name), code]));

/** Read a search into filters and leftover words. */
export function parseQuery(input: string): Parsed {
  let text = ` ${plain(input).replace(/[^a-z0-9\s'-]/g, " ").replace(/['-]/g, " ").replace(/\s+/g, " ").trim()} `;
  const out: Parsed = { country: null, genre: null, decade: null, year: null, women: false, people: false, rest: "" };
  const take = (phrase: string) => {
    text = text.replace(` ${phrase} `, " ");
  };

  // Longest names first, so "south africa" wins over "africa".
  const phrases = (map: Map<string, string> | Record<string, string>) =>
    [...(map instanceof Map ? map.entries() : Object.entries(map))].sort((a, b) => b[0].length - a[0].length);

  for (const [name, code] of [...phrases(COUNTRY_BY_NAME), ...phrases(DEMONYMS)]) {
    if (out.country) break;
    if (text.includes(` ${name} `)) { out.country = code; take(name); }
  }
  for (const [word, genre] of phrases(GENRES)) {
    if (out.genre) break;
    if (text.includes(` ${word} `)) { out.genre = genre; take(word); }
  }

  const words = text.trim().split(" ").filter(Boolean);
  const rest: string[] = [];
  for (const w of words) {
    const decade = w.match(/^(19|20)?(\d)0s$/);
    if (decade && !out.decade) {
      const century = decade[1] ?? (Number(decade[2]) <= 2 ? "20" : "19");
      out.decade = `${century}${decade[2]}0s`;
      continue;
    }
    if (/^(18|19|20)\d\d$/.test(w) && !out.year && Number(w) >= 1890 && Number(w) <= 2030) { out.year = Number(w); continue; }
    if (WOMEN.has(w)) { out.women = true; continue; }
    if (PEOPLE.has(w)) { out.people = true; continue; }
    if (FILLER.has(w)) continue;
    rest.push(w);
  }
  out.rest = rest.join(" ");
  return out;
}

/** Whether the search asked for any filter at all. */
export const hasFilters = (p: Parsed) => !!(p.country || p.genre || p.decade || p.year || p.women);

/** A short, readable name for what the filters describe: "Nigerian comedies from the 1990s". */
export function describe(p: Parsed, countryName: (code: string) => string) {
  const genre = p.genre ? (p.genre === "Documentary" ? "documentaries" : p.genre === "Comedy" ? "comedies" : `${p.genre.toLowerCase()} films`) : "films";
  const where = p.country ? ` from ${countryName(p.country)}` : "";
  const when = p.decade ? ` of the ${p.decade}` : p.year ? ` from ${p.year}` : "";
  const by = p.women ? " by women directors" : "";
  const text = `${genre[0].toUpperCase()}${genre.slice(1)}${where}${by}${when}`;
  return text.replace(/^Science fiction films/, "Science fiction films");
}
