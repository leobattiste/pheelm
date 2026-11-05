import type { FilmType, Role } from "./types";

export const COUNTRIES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", FR: "France", SN: "Senegal", ML: "Mali",
  BF: "Burkina Faso", MR: "Mauritania", KE: "Kenya", ZM: "Zambia", TD: "Chad", LS: "Lesotho",
  CM: "Cameroon", AO: "Angola", CG: "Republic of the Congo", CD: "DR Congo", HT: "Haiti", MQ: "Martinique",
  GP: "Guadeloupe", BR: "Brazil", NG: "Nigeria", IE: "Ireland", GH: "Ghana", DE: "Germany", BE: "Belgium",
  ET: "Ethiopia", ZA: "South Africa", TN: "Tunisia", CA: "Canada", JM: "Jamaica", TT: "Trinidad and Tobago",
  CI: "Côte d'Ivoire", RW: "Rwanda", UG: "Uganda", TZ: "Tanzania", SD: "Sudan", SO: "Somalia", NE: "Niger",
  GN: "Guinea", GW: "Guinea-Bissau", BJ: "Benin", TG: "Togo", CO: "Colombia", CU: "Cuba", NL: "Netherlands",
  PT: "Portugal", ES: "Spain", IT: "Italy", SE: "Sweden", AU: "Australia", MZ: "Mozambique", ZW: "Zimbabwe",
  BW: "Botswana", NA: "Namibia", EG: "Egypt", MA: "Morocco", DZ: "Algeria", CV: "Cape Verde", BB: "Barbados",
  BS: "Bahamas", DO: "Dominican Republic", PR: "Puerto Rico", GF: "French Guiana", RE: "Réunion",
};

export const countryName = (code: string) => COUNTRIES[code] ?? code;

export const TYPE_LABELS: Record<FilmType, string> = {
  feature: "Feature",
  documentary: "Documentary",
  short: "Short",
  animation: "Animation",
};

export const TYPE_PLURALS: Record<FilmType, string> = {
  feature: "Features",
  documentary: "Documentaries",
  short: "Shorts",
  animation: "Animation",
};

export const ROLE_LABELS: Record<Role, string> = {
  director: "Director",
  writer: "Writer",
  producer: "Producer",
  cinematographer: "Cinematography",
  editor: "Editor",
  composer: "Music",
  cast: "Cast",
};

export const ROLES = Object.keys(ROLE_LABELS) as Role[];

export const decadeOf = (year: number) => `${Math.floor(year / 10) * 10}s`;

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listJoin(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function runtimeLabel(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${m ? `${m} min` : ""}`.trim() : `${m} min`;
}

/** Pulls a YouTube or Vimeo id out of a trailer link so it can be embedded. */
export function trailerEmbed(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === "youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.match(/\/(\d+)/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {}
  return null;
}

// Placeholder posters take their colour from the title, so each film keeps the same one.
const POSTER_COLOURS = [
  ["#1d1a17", "#e8d9b0"], ["#5a1f1b", "#f2d2a9"], ["#123a32", "#e6efe0"], ["#2a2350", "#f0c873"],
  ["#7a3b12", "#fbe7c6"], ["#0f2f4a", "#f4b860"], ["#3d1f3a", "#f1c6d3"], ["#33402a", "#efe3b8"],
  ["#b2452c", "#1a1410"], ["#d8b25a", "#1f1a12"], ["#e6ddd0", "#262019"], ["#8c1c2a", "#f6e3d6"],
];

export function posterColours(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = POSTER_COLOURS[h % POSTER_COLOURS.length];
  return { bg, fg };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-ZÀ-Ý]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}
