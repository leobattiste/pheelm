/**
 * Where each streaming button goes. TMDB only gives one link per country (its own page listing
 * every service), so each service gets a search for the film on that service instead. Services
 * we don't know go to a JustWatch search for the film in that country.
 */

type Builder = (q: string) => string;

// Matched against the service name from TMDB, lowercased, with "+" read as "plus".
const SERVICES: [RegExp, Builder][] = [
  [/^netflix/, (q) => `https://www.netflix.com/search?q=${q}`],
  [/amazon|prime video/, (q) => `https://www.primevideo.com/search?phrase=${q}`],
  [/^apple|itunes/, (q) => `https://tv.apple.com/search?term=${q}`],
  [/google play/, (q) => `https://play.google.com/store/search?q=${q}&c=movies`],
  [/^youtube/, (q) => `https://www.youtube.com/results?search_query=${q}`],
  [/disney/, (q) => `https://www.disneyplus.com/search?q=${q}`],
  [/^hulu/, (q) => `https://www.hulu.com/search?q=${q}`],
  [/^(hbo )?max\b/, (q) => `https://play.max.com/search?q=${q}`],
  [/^peacock/, (q) => `https://www.peacocktv.com/search?q=${q}`],
  [/paramount/, (q) => `https://www.paramountplus.com/search/?q=${q}`],
  [/criterion/, (q) => `https://www.criterionchannel.com/search?q=${q}`],
  [/^mubi/, (q) => `https://mubi.com/en/search/films?query=${q}`],
  [/^kanopy/, (q) => `https://www.kanopy.com/en/search?query=${q}`],
  [/^hoopla/, (q) => `https://www.hoopladigital.com/search?q=${q}`],
  [/^tubi/, (q) => `https://tubitv.com/search/${q}`],
  [/roku/, (q) => `https://therokuchannel.roku.com/search/${q}`],
  [/^plex/, (q) => `https://watch.plex.tv/search?q=${q}`],
  [/fandango|vudu/, (q) => `https://athome.fandango.com/content/browse/search?searchString=${q}`],
  [/microsoft/, (q) => `https://www.microsoft.com/en-us/search/shop/movies?q=${q}`],
  [/bfi player/, (q) => `https://player.bfi.org.uk/search?q=${q}`],
  [/bbc iplayer/, (q) => `https://www.bbc.co.uk/iplayer/search?q=${q}`],
  [/sky store/, (q) => `https://www.skystore.com/search?q=${q}`],
  [/^canal/, (q) => `https://www.canalplus.com/recherche/?q=${q}`],
];

// JustWatch's country paths, where they differ from the country code.
const JUSTWATCH_PATH: Record<string, string> = { GB: "uk" };

export function watchLink(provider: string, title: string, region = "US") {
  const name = provider.toLowerCase().replace(/\+/g, " plus").trim();
  const q = encodeURIComponent(title);
  const service = SERVICES.find(([re]) => re.test(name));
  if (service) return service[1](q);
  return `https://www.justwatch.com/${JUSTWATCH_PATH[region] ?? region.toLowerCase()}/search?q=${q}`;
}
