"use client";

import { useActionState, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import type { ArticleRow } from "@/lib/types";
import { deleteArticle, saveArticle, type Result } from "../../actions";

type FilmOption = { id: string; title: string; year: number };

export default function ArticleEditor({ article, films }: { article: ArticleRow; films: FilmOption[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(saveArticle, { ok: false, message: "" });
  const [body, setBody] = useState(article.body);
  const [preview, setPreview] = useState(false);
  const [picked, setPicked] = useState(new Set(article.film_ids));
  const [filter, setFilter] = useState("");
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const shown = films.filter((f) => !filter || f.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <form action={action} className="editor">
      <input type="hidden" name="id" value={article.id} />
      <div className="form">
        <fieldset className="fieldset">
          <legend>Story</legend>
          <label className="field">Headline<input name="title" defaultValue={article.title} required /></label>
          <label className="field">Standfirst <span className="hint">one or two sentences under the headline</span><input name="dek" defaultValue={article.dek ?? ""} /></label>
          <div className="actions">
            <button type="button" className="button ghost small" aria-pressed={!preview} onClick={() => setPreview(false)}>Write</button>
            <button type="button" className="button ghost small" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button>
          </div>
          <label className="field" hidden={preview}>
            Text <span className="hint">Blank line between paragraphs. ## Heading · &gt; Quote · - List · **bold** · *italic* · [link](https://…) · ![caption](image link)</span>
            <textarea name="body" className="tall" value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          {preview && <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />}
        </fieldset>
        <fieldset className="fieldset">
          <legend>Films in this story ({picked.size})</legend>
          <input className="search-input" placeholder="Filter films" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter films" />
          {[...picked].filter((id) => !shown.some((f) => f.id === id)).map((id) => <input key={id} type="hidden" name="films" value={id} />)}
          <div className="film-picker">
            {shown.map((f) => (
              <label key={f.id}>
                <input type="checkbox" name="films" value={f.id} checked={picked.has(f.id)} onChange={() => toggle(f.id)} /> {f.title} <span className="muted">{f.year}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <aside>
        <label className="field">Status
          <select name="status" defaultValue={article.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label className="field">Kind
          <select name="kind" defaultValue={article.kind}>
            <option value="essay">Essay</option>
            <option value="interview">Interview</option>
            <option value="history">History</option>
            <option value="story">Behind the film</option>
            <option value="news">News</option>
          </select>
        </label>
        <label className="field">Author<input name="author" defaultValue={article.author ?? ""} /></label>
        <label className="field">Publish date<input name="published_at" type="date" defaultValue={article.published_at?.slice(0, 10) ?? ""} /></label>
        <label className="field">Address<input name="slug" defaultValue={article.slug} /></label>
        <label className="field">Cover image link<input name="cover_url" type="url" defaultValue={article.cover_url ?? ""} /></label>
        <label className="field">…or upload<input name="cover_file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.message && <p className={`notice ${state.ok ? "ok" : "error"}`} role="status">{state.message}</p>}
        <button className="button danger small" type="submit" formAction={deleteArticle} formNoValidate
          onClick={(e) => { if (!confirm("Delete this story? This can't be undone.")) e.preventDefault(); }}>
          Delete story
        </button>
      </aside>
    </form>
  );
}
