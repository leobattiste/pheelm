"use client";

import { useState } from "react";
import type { FilmCard } from "@/lib/types";
import { FilmGrid } from "./FilmCard";

/**
 * A director's films as posters, with what they did under each. When they've done more than one
 * kind of work (directed, wrote, acted), chips filter the grid.
 */
export default function PersonFilms({ films, roles }: { films: FilmCard[]; roles: Record<string, string> }) {
  const kinds = [...new Set(Object.values(roles).flatMap((r) => r.split(/, | and /).map((x) => x.charAt(0).toUpperCase() + x.slice(1))))];
  const [kind, setKind] = useState<string | null>(null);
  const shown = kind ? films.filter((f) => roles[f.id]?.toLowerCase().includes(kind.toLowerCase())) : films;

  return (
    <div className="person-films">
      {kinds.length > 1 && (
        <ul className="chip-list" aria-label="Show films by role">
          <li><button type="button" className="chip" aria-pressed={!kind} onClick={() => setKind(null)}>All {films.length}</button></li>
          {kinds.map((k) => (
            <li key={k}><button type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>{k}</button></li>
          ))}
        </ul>
      )}
      <FilmGrid films={shown} notes={roles} />
    </div>
  );
}
