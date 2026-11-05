"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import Poster from "@/components/Poster";
import type { Award, FilmRow, WatchOption } from "@/lib/types";
import { deleteFilm, importOne, saveFilm, type Result } from "../../actions";

type Props = {
  film: FilmRow;
  creditText: string;
  collections: { id: string; title: string }[];
  chosen: string[];
  tmdbEnabled: boolean;
};

const awardLine = (a: Award) => `${a.award} | ${a.category} | ${a.result} | ${a.year}`;
const watchLine = (w: WatchOption) => `${w.provider} | ${w.url} | ${w.kind}${w.region ? ` | ${w.region}` : ""}`;

export default function FilmEditor({ film, creditText, collections, chosen, tmdbEnabled }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<Result, FormData>(saveFilm, { ok: false, message: "" });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<Result | null>(null);
  const [poster, setPoster] = useState(film.poster_url ?? "");
  const [colour, setColour] = useState(film.color ?? "");

  const runImport = async () => {
    setImporting(true);
    setImportMsg(null);
    const r = await importOne(film.id);
    setImportMsg(r);
    setImporting(false);
    // Reload so the form shows what TMDB filled in.
    if (r.ok) router.refresh();
  };

  return (
    <form action={action} className="editor">
      <input type="hidden" name="id" value={film.id} />
      <div className="form">
        <fieldset className="fieldset">
          <legend>Basics</legend>
          <div className="form-row">
            <label className="field">Title<input name="title" defaultValue={film.title} required /></label>
            <label className="field">Original title <span className="hint">if different</span><input name="original_title" defaultValue={film.original_title ?? ""} /></label>
          </div>
          <div className="form-row">
            <label className="field">Year<input name="year" inputMode="numeric" defaultValue={film.year} required /></label>
            <label className="field">Type
              <select name="type" defaultValue={film.type}>
                <option value="feature">Feature</option>
                <option value="documentary">Documentary</option>
                <option value="short">Short</option>
                <option value="animation">Animation</option>
              </select>
            </label>
            <label className="field">Runtime <span className="hint">minutes</span><input name="runtime" inputMode="numeric" defaultValue={film.runtime ?? ""} /></label>
          </div>
          <div className="form-row">
            <label className="field">Countries <span className="hint">codes, comma-separated: SN, FR</span><input name="countries" defaultValue={film.countries.join(", ")} /></label>
            <label className="field">Languages <span className="hint">comma-separated</span><input name="languages" defaultValue={film.languages.join(", ")} /></label>
          </div>
          <label className="field">Genres <span className="hint">comma-separated</span><input name="genres" defaultValue={film.genres.join(", ")} /></label>
          <label className="field">Synopsis<textarea name="synopsis" defaultValue={film.synopsis ?? ""} /></label>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Cast &amp; crew</legend>
          <label className="field">
            One person per line <span className="hint">director: Name · writer · producer · cinematographer · editor · composer · cast: Name as Character</span>
            <textarea name="credits" className="tall" defaultValue={creditText} required />
          </label>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Media</legend>
          <label className="field">Poster link<input name="poster_url" type="url" value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://" /></label>
          <label className="field">…or upload a poster <span className="hint">JPEG, PNG or WebP, portrait 2:3</span><input name="poster_file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          <label className="field">Trailer <span className="hint">YouTube or Vimeo link</span><input name="trailer_url" type="url" defaultValue={film.trailer_url ?? ""} /></label>
          <label className="field">Still <span className="hint">a wide frame from the film, shown across the top of its page</span><input name="backdrop_url" type="url" defaultValue={film.backdrop_url ?? ""} /></label>
          <input type="hidden" name="previous_poster" value={film.poster_url ?? ""} />
          <input type="hidden" name="previous_color" value={film.color ?? ""} />
          <label className="field">Page colour <span className="hint">taken from the poster automatically; pick one to override</span>
            <span className="colour-field">
              <input type="color" value={colour || "#7d2a1f"} onChange={(e) => setColour(e.target.value)} aria-label="Page colour" />
              <input name="color" value={colour} onChange={(e) => setColour(e.target.value)} placeholder="#7d2a1f" pattern="#[0-9a-fA-F]{6}" />
            </span>
          </label>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Awards</legend>
          <label className="field">
            One per line <span className="hint">Award | Category | won or nominated | Year</span>
            <textarea name="awards" defaultValue={film.awards.map(awardLine).join("\n")} placeholder="Cannes Film Festival | Grand Prix | won | 2019" />
          </label>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Where to watch</legend>
          <label className="field">
            One per line <span className="hint">Service | Link | stream, free, rent or buy | Country code</span>
            <textarea name="watch" defaultValue={film.watch.map(watchLine).join("\n")} placeholder="Criterion Channel | https://www.criterionchannel.com/… | stream | US" />
          </label>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Collections</legend>
          <div className="film-picker">
            {collections.map((c) => (
              <label key={c.id}><input type="checkbox" name="collections" value={c.id} defaultChecked={chosen.includes(c.id)} /> {c.title}</label>
            ))}
          </div>
        </fieldset>
      </div>

      <aside>
        <Poster title={film.title} year={film.year} directors={[]} src={poster || null} />
        <label className="field">Status
          <select name="status" defaultValue={film.status}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" name="featured" defaultChecked={film.featured} /> Feature on the home page</label>
        <label className="field">Address<input name="slug" defaultValue={film.slug} /></label>
        <label className="field">TMDB id<input name="tmdb_id" inputMode="numeric" defaultValue={film.tmdb_id ?? ""} /></label>
        <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.message && <p className={`notice ${state.ok ? "ok" : "error"}`} role="status">{state.message}</p>}
        <button className="button ghost" type="button" onClick={runImport} disabled={!tmdbEnabled || importing}
          title={tmdbEnabled ? "Fill empty fields from TMDB" : "Add TMDB_API_KEY to switch this on"}>
          {importing ? "Importing…" : "Import from TMDB"}
        </button>
        {!tmdbEnabled && <p className="muted" style={{ fontSize: 13 }}>TMDB import switches on when TMDB_API_KEY is set.</p>}
        {importMsg && <p className={`notice ${importMsg.ok ? "ok" : "error"}`}>{importMsg.message}</p>}
        <button className="button danger small" type="submit" formAction={deleteFilm} formNoValidate
          onClick={(e) => { if (!confirm(`Delete ${film.title}? This can't be undone.`)) e.preventDefault(); }}>
          Delete film
        </button>
      </aside>
    </form>
  );
}
