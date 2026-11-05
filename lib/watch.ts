/**
 * Where each streaming button goes. TMDB tells us which services have a film but gives no link to
 * the film on each one, so every button opens a search for the film on that service. Services we
 * can't search aren't shown, so every button on the page goes straight to the service.
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
  [/^amc/, (q) => `https://www.amcplus.com/search?q=${q}`],
  [/^starz/, (q) => `https://www.starz.com/us/en/search?q=${q}`],
  [/^shudder/, (q) => `https://www.shudder.com/search?q=${q}`],
  [/^showtime/, (q) => `https://www.paramountplus.com/search/?q=${q}`],
  [/^sling/, (q) => `https://watch.sling.com/search?q=${q}`],
];

/** A search for the film on the service, or null for services we can't search. */
export function watchLink(provider: string, title: string): string | null {
  const name = provider.toLowerCase().replace(/\+/g, " plus").trim();
  const service = SERVICES.find(([re]) => re.test(name));
  return service ? service[1](encodeURIComponent(title)) : null;
}
