"use client";

import FilmCard from "@/components/FilmCard";
import { TYPE_LABELS } from "@/lib/format";
import type { FilmType } from "@/lib/types";
import { useAdminSelection } from "../AdminSelectionBar";

export type AdminFilmRow = {
  id: string; slug: string; title: string; year: number; type: string; status: string;
  poster_url: string | null; featured: boolean; tmdb_id: number | null;
  credits: { role: string; people: { name: string } | null }[];
};

export default function BulkControls({ films, canDelete }: { films: AdminFilmRow[]; canDelete: boolean }) {
  const { selected, toggle } = useAdminSelection("films");


  return (
    <div className="admin-managed-list">
      <ul className="film-grid admin-film-grid">
        {films.map((film) => (
          <FilmCard key={film.id} href={`/admin/films/${film.id}`} film={{
            id: film.id, slug: film.slug, title: film.title, year: film.year,
            type: film.type as FilmType, poster_url: film.poster_url,
            directors: (film.credits ?? []).filter((credit) => credit.role === "director").map((credit) => credit.people?.name).filter((name): name is string => !!name),
            countries: [], languages: [], genres: [], runtime: null, wins: 0,
          }} extra={TYPE_LABELS[film.type as FilmType] ?? film.type} controls={
            <div className="admin-film-controls admin-card-selection">
              <label className="check">
                <input type="checkbox" checked={selected.includes(film.id)} onChange={(event) => toggle(film.id, event.target.checked)} aria-label={`Select ${film.title}`} />Select
              </label>
              <span className={`status-pill ${film.status}`}>{film.status === "published" ? "Published" : "Draft"}</span>
              {film.featured && <span className="status-pill">Featured</span>}
              <span className="visually-hidden">{film.tmdb_id ? "Matched on TMDB" : "No TMDB match"}</span>
            </div>
          } />
        ))}
      </ul>
    </div>
  );
}
