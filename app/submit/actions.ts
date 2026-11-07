"use server";

import { getServerClient } from "@/lib/supabase/server";

export type SubmitState = { ok: boolean; message: string };

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

export async function submitFilm(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const db = await getServerClient();
  if (!db) return { ok: false, message: "Submissions open once the site is connected to Supabase." };
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to submit a film." };

  const title = clip(form.get("title"), 200);
  const director = clip(form.get("director"), 200);
  const yearRaw = clip(form.get("year"), 4);
  const link = clip(form.get("link"), 500);
  const year = yearRaw ? Number(yearRaw) : null;

  if (!title || !director) return { ok: false, message: "Add the film's title and director." };
  if (year !== null && (!Number.isInteger(year) || year < 1890 || year > 2100)) {
    return { ok: false, message: "Enter the year as four digits." };
  }
  if (link && !/^https?:\/\//i.test(link)) return { ok: false, message: "Links need to start with https://" };

  const { error } = await db.from("submissions").insert({
    user_id: user.id,
    title,
    director,
    year,
    link: link || null,
    note: clip(form.get("note"), 2000) || null,
  });
  if (error) return { ok: false, message: "The submission could not be sent. Try again in a moment." };
  return { ok: true, message: `Thanks! ${title} is in the queue for review.` };
}

/**
 * A filmmaker submitting their own film, with what a film page shows: details, synopsis, poster
 * and trailer, credits, awards and where to watch. Kept with the submission for review
 * (supabase/own-film-submissions.sql); before that has run, the details travel in the note.
 */
export async function submitOwnFilm(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const db = await getServerClient();
  if (!db) return { ok: false, message: "Submissions open once the site is connected to Supabase." };
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to submit your film." };

  const title = clip(form.get("title"), 200);
  const director = clip(form.get("director"), 300);
  const yearRaw = clip(form.get("year"), 4);
  const year = yearRaw ? Number(yearRaw) : null;
  const email = clip(form.get("email"), 200);
  if (!title || !director) return { ok: false, message: "Add the film's title and director." };
  if (year === null || !Number.isInteger(year) || year < 1890 || year > 2100) return { ok: false, message: "Enter the year as four digits." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "Add an email address we can reach you at." };
  if (form.get("rights") !== "on") return { ok: false, message: "Confirm you can submit this film." };
  const links = ["poster", "trailer", "website"].map((k) => clip(form.get(k), 500));
  if (links.some((l) => l && !/^https?:\/\//i.test(l))) return { ok: false, message: "Links need to start with https://" };

  const details = {
    original_title: clip(form.get("original_title"), 200) || null,
    runtime: Number(clip(form.get("runtime"), 4)) || null,
    countries: clip(form.get("countries"), 300) || null,
    languages: clip(form.get("languages"), 300) || null,
    genres: clip(form.get("genres"), 300) || null,
    synopsis: clip(form.get("synopsis"), 3000) || null,
    poster: links[0] || null,
    trailer: links[1] || null,
    website: links[2] || null,
    credits: clip(form.get("credits"), 3000) || null,
    awards: clip(form.get("awards"), 2000) || null,
    watch: clip(form.get("watch"), 2000) || null,
    submitted_by: clip(form.get("name"), 200) || null,
    role: clip(form.get("role"), 200) || null,
    email,
  };
  const base = { user_id: user.id, title, director, year, link: links[2] || links[1] || null };
  let { error } = await db.from("submissions").insert({ ...base, kind: "own", details, note: details.synopsis });
  // Before own-film-submissions.sql has run: the details go in the note.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await db.from("submissions").insert({ ...base, note: `Own film submission\n${JSON.stringify(details, null, 2)}`.slice(0, 6000) }));
  }
  if (error) return { ok: false, message: "Your film could not be sent. Try again in a moment." };
  return { ok: true, message: `Thanks! We'll review ${title} and write to ${email} when it's on Pheelm.` };
}
