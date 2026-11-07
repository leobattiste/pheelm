"use client";

import { useActionState } from "react";
import { submitFilm, type SubmitState } from "./actions";

export default function SubmitForm() {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitFilm, { ok: false, message: "" });

  if (state.ok) {
    return (
      <div className="form">
        <p className="notice ok" role="status">{state.message}</p>
        <a className="button ghost" href="/submit">Suggest another</a>
      </div>
    );
  }

  return (
    <form action={action} className="form">
      <label className="field">
        Film title
        <input name="title" required maxLength={200} />
      </label>
      <div className="form-row">
        <label className="field">
          Director
          <input name="director" required maxLength={200} />
        </label>
        <label className="field">
          Year
          <input name="year" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} />
        </label>
      </div>
      <label className="field">
        Link <span className="hint">IMDb, TMDB, Letterboxd, Wikipedia or the film&rsquo;s site</span>
        <input name="link" type="url" placeholder="https://" maxLength={500} />
      </label>
      <label className="field">
        Anything we should know? <span className="hint">Optional. Where to watch it, why it belongs here, a correction.</span>
        <textarea name="note" maxLength={2000} />
      </label>
      {state.message && <p className="notice error" role="alert">{state.message}</p>}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Suggest film"}
      </button>
    </form>
  );
}
