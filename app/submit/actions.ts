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
