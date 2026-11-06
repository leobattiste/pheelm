export type FilmType = "feature" | "documentary" | "short" | "animation";
export type Role = "director" | "writer" | "producer" | "cinematographer" | "editor" | "composer" | "cast";

export type Award = { award: string; category: string; result: "won" | "nominated"; year: number };
export type WatchOption = { provider: string; url: string; kind: "stream" | "rent" | "buy" | "free"; region?: string };

export type FilmRow = {
  id: string;
  slug: string;
  title: string;
  original_title: string | null;
  year: number;
  type: FilmType;
  countries: string[];
  languages: string[];
  genres: string[];
  runtime: number | null;
  synopsis: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  /** Hex colour from the poster, used to tint the film's page. */
  color?: string | null;
  trailer_url: string | null;
  awards: Award[];
  watch: WatchOption[];
  tmdb_id: number | null;
  status: "draft" | "published";
  featured: boolean;
  /** When the film was added to the directory (only in the database, not the starter file). */
  created_at?: string;
};

export type PersonRow = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  country: string | null;
  birth_year?: number | null;
  photo_url: string | null;
  tmdb_id: number | null;
  /** From TMDB (supabase/people-details.sql). */
  born?: string | null;
  died?: string | null;
  birthplace?: string | null;
  known_for?: string | null;
  imdb_id?: string | null;
  instagram?: string | null;
  details_at?: string | null;
};

export type CreditRow = { film_id: string; person_id: string; role: Role; character: string | null; sort: number };

export type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "country" | "decade" | "movement" | "theme" | "genre";
  featured: boolean;
  sort_order: number;
};


export type Credit = { person: PersonRow; role: Role; character: string | null };

/** A film with its people attached, ready for pages. */
export type Film = FilmRow & {
  directors: PersonRow[];
  credits: Credit[];
  collections: { slug: string; title: string }[];
};

/** The light version used on cards and in the browser, so pages stay small. */
export type FilmCard = Pick<Film, "id" | "slug" | "title" | "year" | "type" | "countries" | "languages" | "genres" | "poster_url" | "color" | "runtime"> & {
  directors: string[];
  wins: number;
};

export type Director = PersonRow & { films: Film[] };

/** What a director card and the directors page need, without every film attached. */
export type DirectorSummary = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  photo_url: string | null;
  films: number;
  first: number;
  last: number;
  /** Up to three films to preview on their card, best known first. */
  previews: { slug: string; title: string; year: number; poster_url: string | null; color: string | null; directors: string[] }[];
};
export type Collection = CollectionRow & { films: Film[] };
