/**
 * The tours: which pages each one belongs to and what each step says and points at. A step names its
 * target with CSS selectors (the first one on screen wins); a step whose target isn't there is skipped
 * rather than shown without a pointer. Memory of what was seen is in lib/tour.ts.
 */
export type TourStep = {
  targets: string[];
  title: string;
  text: string;
  /** Bring the target into view first (it sits in the page, not in the menu bar). */
  scroll?: boolean;
  /** Where the card goes: next to the target (default) or low on the screen, for targets that are tall or central. */
  place?: "near" | "bottom";
};
export type Tour = { id: string; match: (path: string) => boolean; doneLabel: string; steps: (member: boolean) => TourStep[] };

const tab = (label: string) => `.tab-bar [aria-label^="${label}"]`;

export const MENU_TOUR: Tour = {
  id: "menu",
  match: () => true,
  doneLabel: "Start exploring",
  steps: (member) => [
    { targets: [tab("Films")], title: "Films", text: "Browse films by Black directors from around the world. Search, filter, and find something new to watch." },
    { targets: [tab("Watchlists")], title: "Watchlists", text: "Discover and create watchlists, share your favorites, and connect with other film enthusiasts through comments." },
    { targets: [tab("Directors")], title: "Directors", text: "Learn about filmmakers, explore their work, and follow your favorites." },
    { targets: [tab("Profile"), tab("Sign in")], ...(member
      ? { title: "Your profile", text: "View your profile, share your interests, and connect with other film enthusiasts." }
      : { title: "Join the community", text: "Sign in or create a free account to save films, follow directors, and join conversations." }) },
    { targets: [tab("More")], title: "More", text: "Access your settings, notifications, help, and other pages on Pheelm." },
  ],
};

/** Shown the first time someone lands on the page, once the menu tour has had its turn. */
export const PAGE_TOURS: Tour[] = [
  {
    id: "films",
    match: (p) => p === "/films",
    doneLabel: "Got it",
    steps: () => [
      { targets: [".search-bar"], title: "Search", text: "Look up a film, a director, a country or a year." },
      { targets: [".filter-button"], title: "Filter and sort", text: "Narrow the list by genre, country and more, and change how it is ordered." },
      { targets: [".film-card"], title: "Open a film", text: "Tap any film to see its page, watch the trailer and join the conversation.", place: "bottom" },
    ],
  },
  {
    id: "film",
    match: (p) => /^\/films\/[^/]+$/.test(p),
    doneLabel: "Got it",
    steps: () => [
      { targets: [`.film-actions [data-action="trailer"]`], title: "Trailer", text: "Watch the trailer right here." },
      { targets: [`.film-actions [data-action="watchlist"]`], title: "Watchlist", text: "Save this film to a watchlist, or start a new one." },
      { targets: [".film-actions .round-button"], title: "More", text: "Mark it as watched, share it, and give feedback." },
      { targets: ["#comments h2"], title: "Comments", text: "Tell others what you thought and join the conversation.", scroll: true, place: "bottom" },
    ],
  },
  {
    id: "directors",
    match: (p) => p === "/directors",
    doneLabel: "Got it",
    steps: () => [
      { targets: [".search-bar"], title: "Search", text: "Look up a director by name or country." },
      { targets: [".filter-button"], title: "Sort", text: "Order directors by number of films, name or when they started." },
      { targets: [".director-card .collection-tile"], title: "Open a director", text: "Tap a director to see their films and follow them.", place: "bottom" },
    ],
  },
  {
    id: "watchlists",
    match: (p) => p === "/watchlists",
    doneLabel: "Got it",
    steps: () => [
      { targets: [".feed-tabs"], title: "Browse", text: "See every watchlist, the featured ones, or the ones you follow." },
      { targets: [".collections-toolbar .filter-button"], title: "Sort", text: "Change how the watchlists are ordered." },
      { targets: [".collection-list .collection-tile"], title: "Open a watchlist", text: "Tap a watchlist to see its films and join the comments.", place: "bottom" },
    ],
  },
];

export const ALL_TOURS: Tour[] = [MENU_TOUR, ...PAGE_TOURS];

/** The tours for this page in the order they would be offered: the menu tour always goes first. */
export const toursFor = (path: string): Tour[] => [MENU_TOUR, ...PAGE_TOURS.filter((t) => t.match(path))];

/** Every wording a tour can show (both visitor and member), so its card can be sized to the longest. */
export const tourCopy = (t: Tour) =>
  [...t.steps(true), ...t.steps(false)].filter((s, i, all) => all.findIndex((d) => d.title === s.title) === i).map(({ title, text }) => ({ title, text }));
