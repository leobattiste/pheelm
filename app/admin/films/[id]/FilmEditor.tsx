"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActionState, useState } from "react";
import Poster from "@/components/Poster";
import type { Award, FilmRow, WatchOption } from "@/lib/types";
import { deleteFilm, importOne, saveFilm, type Result } from "../../actions";
import { useResultToast } from "@/components/Toast";
import { FormSection, SaveBar, SectionNav, useUnsaved } from "../../EditForm";

type Props = {
  film: FilmRow;
  creditText: string;
  collections: { id: string; title: string }[];
  chosen: string[];
  tmdbEnabled: boolean;
};

const awardLine = (a: Award) => `${a.award} | ${a.category} | ${a.result} | ${a.year}`;
const watchLine = (w: WatchOption) => `${w.provider} | ${w.url} | ${w.kind}${w.region ? ` | ${w.region}` : ""}`;

export default function FilmEditor({ film, creditText, collections, chosen, tmdbEnabled, canDelete = false }: Props & { canDelete?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<Result, FormData>(saveFilm, { ok: false, message: "" });
  useResultToast(state);
  const { dirty, formProps, discard } = useUnsaved(state);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<Result | null>(null);
  const [poster, setPoster] = useState(film.poster_url ?? "");
  const [colour, setColour] = useState(film.color ?? "");
  // An import or an upload changes the saved record while this form is open. React keeps the old
  // field values, so without this the form would write them back and wipe the new poster.
  const [saved, setSaved] = useState({ poster: film.poster_url ?? "", colour: film.color ?? "" });
  if (saved.poster !== (film.poster_url ?? "") || saved.colour !== (film.color ?? "")) {
    setSaved({ poster: film.poster_url ?? "", colour: film.color ?? "" });
    setPoster(film.poster_url ?? "");
    setColour(film.color ?? "");
  }

  const runImport = async () => {
    setImporting(true);
    setImportMsg(null);
    const r = await importOne(film.id);
    setImportMsg(r);
    setImporting(false);
    // Reload so the form shows what TMDB filled in.
    if (r.ok) router.refresh();
  };

  const resetAll = () => { discard(); setPoster(film.poster_url ?? ""); setColour(film.color ?? ""); };

  return (
    <form action={action} className="admin-editor" {...formProps}>
      <input type="hidden" name="id" value={film.id} />
      <div className="admin-editor-main">
        <SectionNav items={[
          { id: "basics", label: "Basics" }, { id: "story", label: "Story" }, { id: "people", label: "Cast & crew" },
          { id: "media", label: "Media" }, { id: "awards", label: "Awards" }, { id: "watch", label: "Where to watch" }, { id: "collections", label: "Collections" },
        ]} />

        <FormSection id="basics" title="Basics">
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
          {/* Shown once the database has these columns. */}
          {"aka" in film && (
            <label className="field">Also known as <span className="hint">other titles, separated by semicolons</span><input name="aka" defaultValue={(film.aka ?? []).join("; ")} /></label>
          )}
        </FormSection>

        <FormSection id="story" title="Story">
          {"note" in film && (
            <label className="field">Why it matters <span className="hint">one or two sentences, shown above the synopsis</span><textarea name="note" rows={3} defaultValue={film.note ?? ""} /></label>
          )}
          <label className="field">Synopsis<textarea name="synopsis" rows={6} defaultValue={film.synopsis ?? ""} /></label>
          <Link className="button ghost small admin-fit" href={`/admin/editorial/${film.id}`}>Edit our perspective</Link>
        </FormSection>

        <FormSection id="people" title="Cast & crew" hint="One person per line: director: Name, writer, producer, cinematographer, editor, composer, cast: Name as Character.">
          <label className="field"><span className="visually-hidden">Cast and crew</span>
            <textarea name="credits" className="tall admin-mono" defaultValue={creditText} required />
          </label>
        </FormSection>

        <FormSection id="media" title="Media">
          <div className="form-row">
            <label className="field">Poster link<input name="poster_url" type="url" value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://" /></label>
            <label className="field">…or upload a poster <span className="hint">JPEG, PNG or WebP, portrait 2:3</span><input name="poster_file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          </div>
          {film.poster_url && <label className="check"><input type="checkbox" name="remove_poster" /> Remove poster <span className="hint">clearing the link leaves the poster as it is</span></label>}
          <div className="form-row">
            <label className="field">Trailer <span className="hint">YouTube or Vimeo link</span><input name="trailer_url" type="url" defaultValue={film.trailer_url ?? ""} /></label>
            <label className="field">Still <span className="hint">a wide frame from the film</span><input name="backdrop_url" type="url" defaultValue={film.backdrop_url ?? ""} /></label>
          </div>
          <input type="hidden" name="previous_poster" value={film.poster_url ?? ""} />
          <input type="hidden" name="previous_color" value={film.color ?? ""} />
          <label className="field">Page colour <span className="hint">taken from the poster automatically; pick one to override</span>
            <span className="colour-field">
              <input type="color" value={colour || "#7d2a1f"} onChange={(e) => setColour(e.target.value)} aria-label="Page colour" />
              <input name="color" value={colour} onChange={(e) => setColour(e.target.value)} placeholder="#7d2a1f" pattern="#[0-9a-fA-F]{6}" />
            </span>
          </label>
        </FormSection>

        <FormSection id="awards" title="Awards" hint="One per line: Award | Category | won or nominated | Year.">
          <label className="field"><span className="visually-hidden">Awards</span>
            <textarea name="awards" className="admin-mono" defaultValue={film.awards.map(awardLine).join("\n")} placeholder="Cannes Film Festival | Grand Prix | won | 2019" />
          </label>
        </FormSection>

        <FormSection id="watch" title="Where to watch" hint="One per line: Service | Link | stream, free, rent or buy | Country code.">
          <label className="field"><span className="visually-hidden">Where to watch</span>
            <textarea name="watch" className="admin-mono" defaultValue={film.watch.map(watchLine).join("\n")} placeholder="Criterion Channel | https://www.criterionchannel.com/… | stream | US" />
          </label>
        </FormSection>

        <FormSection id="collections" title="Collections">
          <div className="film-picker">
            {collections.map((c) => (
              <label key={c.id}><input type="checkbox" name="collections" value={c.id} defaultChecked={chosen.includes(c.id)} /> {c.title}</label>
            ))}
          </div>
        </FormSection>
      </div>

      <aside className="admin-editor-side">
        <section className="admin-side-card">
          <h2>Publishing</h2>
          <label className="field">Status
            <select name="status" defaultValue={film.status}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" name="featured" defaultChecked={film.featured} /> Feature on the home page</label>
          <label className="field">Address<input name="slug" defaultValue={film.slug} /></label>
        </section>
        <section className="admin-side-card">
          <h2>Poster</h2>
          <div className="admin-side-poster"><Poster title={film.title} year={film.year} directors={[]} src={poster || null} /></div>
        </section>
        <section className="admin-side-card">
          <h2>TMDB</h2>
          <label className="field">TMDB id<input name="tmdb_id" inputMode="numeric" defaultValue={film.tmdb_id ?? ""} /></label>
          <button className="button ghost small" type="button" onClick={runImport} disabled={!tmdbEnabled || importing}
            title={tmdbEnabled ? "Fill empty fields from TMDB" : "Add TMDB_API_KEY to switch this on"}>
            {importing ? "Importing…" : "Fill empty fields from TMDB"}
          </button>
          {!tmdbEnabled && <p className="muted">Switches on when TMDB_API_KEY is set.</p>}
          {importMsg && <p className={`notice ${importMsg.ok ? "ok" : "error"}`}>{importMsg.message}</p>}
        </section>
        {canDelete && (
          <section className="admin-side-card is-danger">
            <h2>Delete</h2>
            <p className="muted">Removes the film, its credits and its place in watchlists. This can&apos;t be undone.</p>
            <button className="button danger small" type="submit" formAction={deleteFilm} formNoValidate
              onClick={(e) => { if (!confirm(`Delete ${film.title}? This can't be undone.`)) e.preventDefault(); }}>
              Delete film
            </button>
          </section>
        )}
      </aside>

      <SaveBar dirty={dirty} pending={pending} onDiscard={resetAll} />
    </form>
  );
}
