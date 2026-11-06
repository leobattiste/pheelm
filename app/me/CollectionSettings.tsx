"use client";

import { useState } from "react";
import { deleteCollection, updateCollection } from "./actions";

type List = { id: string; title: string; description: string | null; is_public: boolean };

/** A collection's heading, with editing, sharing and deleting tucked behind "Edit". */
export default function CollectionSettings({ list, count, handle, minFilms = 5 }: { list: List; count: number; handle?: string | null; minFilms?: number }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${list.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (editing) {
    return (
      <form action={updateCollection} className="collection-edit">
        <input type="hidden" name="id" value={list.id} />
        <label className="field">Name<input name="title" defaultValue={list.title} maxLength={80} required /></label>
        <label className="field">Description <span className="hint">optional</span><textarea name="description" defaultValue={list.description ?? ""} maxLength={500} /></label>
        <label className="check"><input type="checkbox" name="is_public" defaultChecked={list.is_public} /> Public: anyone with the link can see it, and it can appear in the community</label>
        <div className="actions">
          <button className="button" type="submit">Save</button>
          <button className="button ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
          <button className="button ghost small danger-text" type="submit" formAction={deleteCollection} formNoValidate
            onClick={(e) => { if (!confirm(`Delete “${list.title}”? The films stay in All.`)) e.preventDefault(); }}>
            Delete collection
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="collection-heading">
      <div>
        <h2>{list.title}</h2>
        <p className="label">
          {count} {count === 1 ? "film" : "films"} · {list.is_public ? "Public" : "Private"}
        </p>
        {list.description && <p className="collection-desc-full">{list.description}</p>}
        {list.is_public && handle !== undefined && (
          <p className="community-status">
            {handle && count >= minFilms
              ? <>In the community, by <a href={`/@${handle}`}>@{handle}</a>.</>
              : <>To appear in the community: {count < minFilms && `add ${minFilms - count} more ${minFilms - count === 1 ? "film" : "films"}`}{count < minFilms && !handle && " and "}{!handle && <a href="/profile">create your profile</a>}.</>}
          </p>
        )}
      </div>
      <div className="actions">
        {list.is_public && (
          <button type="button" className="button ghost small" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button>
        )}
        <button type="button" className="button ghost small" onClick={() => setEditing(true)}>Edit</button>
      </div>
    </div>
  );
}
