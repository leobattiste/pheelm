"use client";

import { useActionState } from "react";
import { submitOwnFilm, type SubmitState } from "../actions";

/**
 * A filmmaker's own film, in the order a film page shows it: the film, its story, poster and
 * trailer, the people who made it, awards and where to watch, then who's sending it.
 */
export default function OwnFilmForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitOwnFilm, { ok: false, message: "" });

  if (state.ok) {
    return (
      <div className="form">
        <p className="notice ok" role="status">{state.message}</p>
        <a className="button ghost" href="/submit/your-film">Submit another film</a>
      </div>
    );
  }

  return (
    <form action={action} className="form own-film-form">
      <fieldset>
        <legend>The film</legend>
        <label className="field">Title<input name="title" required maxLength={200} /></label>
        <label className="field">
          Original title <span className="hint">If it&rsquo;s known by another title in its own language</span>
          <input name="original_title" maxLength={200} />
        </label>
        <div className="form-row">
          <label className="field">Director <span className="hint">Separate several with commas</span><input name="director" required maxLength={300} /></label>
          <label className="field">Year<input name="year" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} /></label>
        </div>
        <div className="form-row">
          <label className="field">Runtime <span className="hint">Minutes</span><input name="runtime" inputMode="numeric" pattern="[0-9]{1,4}" maxLength={4} /></label>
          <label className="field">Countries<input name="countries" maxLength={300} placeholder="Nigeria, United Kingdom" /></label>
        </div>
        <div className="form-row">
          <label className="field">Languages<input name="languages" maxLength={300} placeholder="Yoruba, English" /></label>
          <label className="field">Genres<input name="genres" maxLength={300} placeholder="Drama, Documentary" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Story</legend>
        <label className="field">
          Synopsis <span className="hint">Two or three sentences, as you&rsquo;d want it on the film&rsquo;s page</span>
          <textarea name="synopsis" maxLength={3000} rows={5} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Poster and trailer</legend>
        <label className="field">Poster <span className="hint">A link to the image, at least 1000 pixels tall</span><input name="poster" type="url" placeholder="https://" maxLength={500} /></label>
        <label className="field">Trailer <span className="hint">YouTube or Vimeo</span><input name="trailer" type="url" placeholder="https://" maxLength={500} /></label>
        <label className="field">Website or press kit<input name="website" type="url" placeholder="https://" maxLength={500} /></label>
      </fieldset>

      <fieldset>
        <legend>Cast and crew</legend>
        <label className="field">
          Who made it <span className="hint">One person per line: name, then role. For example: Ama Mensah, Writer</span>
          <textarea name="credits" maxLength={3000} rows={6} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Awards and festivals</legend>
        <label className="field">
          Festivals, prizes and nominations <span className="hint">One per line, with the year</span>
          <textarea name="awards" maxLength={2000} rows={4} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Where to watch</legend>
        <label className="field">
          Streaming, rental or screenings <span className="hint">One per line, with a link if there is one</span>
          <textarea name="watch" maxLength={2000} rows={3} />
        </label>
      </fieldset>

      <fieldset>
        <legend>About you</legend>
        <div className="form-row">
          <label className="field">Your name<input name="name" maxLength={200} autoComplete="name" /></label>
          <label className="field">Your role on the film<input name="role" maxLength={200} placeholder="Director, producer…" /></label>
        </div>
        <label className="field">Email <span className="hint">We&rsquo;ll write here when we&rsquo;ve reviewed it</span><input name="email" type="email" required defaultValue={email} autoComplete="email" /></label>
        <label className="check">
          <input type="checkbox" name="rights" required /> I made this film or have the right to submit it.
        </label>
      </fieldset>

      {state.message && <p className="notice error" role="alert">{state.message}</p>}
      <button className="button" type="submit" disabled={pending}>{pending ? "Sending…" : "Submit your film"}</button>
    </form>
  );
}
