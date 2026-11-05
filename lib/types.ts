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

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  kind: "essay" | "interview" | "history" | "story" | "news";
  author: string | null;
  cover_url: string | null;
  body: string;
  film_ids: string[];
  status: "draft" | "published";
  published_at: string | null;
};

export type Credit = { person: PersonRow; role: Role; character: string | null };

/** A film with its people attached, ready for pages. */
export type Film = FilmRow & {
  directors: PersonRow[];
  credits: Credit[];
  collections: { slug: string; title: string }[];
};

/** The light version used on cards and in the browser, so pages stay small. */
export type FilmCard = Pick<Film, "id" | "slug" | "title" | "year" | "type" | "countries" | "languages" | "genres" | "poster_url" | "color"> & {
  directors: string[];
  wins: number;
};

export type Director = PersonRow & { films: Film[] };
export type Collection = CollectionRow & { films: Film[] };
