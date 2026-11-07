"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";

export type EditorialResult = { ok: boolean; message: string };

export async function saveEditorial(_previous: EditorialResult, form: FormData): Promise<EditorialResult> {
  const db = await adminClient();
  const filmId = String(form.get("film_id") ?? "");
  const essay = String(form.get("essay") ?? "").trim().slice(0, 30000);
  const sources = String(form.get("sources") ?? "").trim().slice(0, 8000);
  const status = form.get("status") === "published" ? "published" : "draft";
  if (status === "published" && essay.length < 100) return { ok: false, message: "Add an original essay of at least 100 characters before publishing." };
  const { data: film } = await db.from("films").select("id, slug").eq("id", filmId).maybeSingle();
  if (!film) return { ok: false, message: "Film not found." };
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again." };
  const { error } = await db.from("film_editorials").upsert({
    film_id: filmId, essay, sources, status, updated_by: user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "film_id" });
  if (error) return { ok: false, message: error.message };
  const revision = await db.from("film_editorial_versions").insert({
    film_id: filmId, essay, sources, status, edited_by: user.id,
  });
  if (revision.error) console.error("Editorial revision failed:", revision.error.message);
  await logAdminActivity(db, status === "published" ? "Published film essay" : "Saved essay draft", "film", filmId, film.slug);
  revalidatePath("/admin/editorial");
  revalidatePath(`/admin/editorial/${filmId}`);
  revalidatePath("/admin/quality");
  revalidatePath(`/films/${film.slug}`);
  return { ok: true, message: status === "published" ? "Essay published." : "Draft saved." };
}

export async function restoreEditorial(form: FormData) {
  const db = await adminClient();
  const filmId = String(form.get("film_id") ?? "");
  const revisionId = Number(form.get("revision_id"));
  if (!Number.isSafeInteger(revisionId) || revisionId <= 0) throw new Error("Invalid revision.");
  const [{ data: rev }, { data: film }] = await Promise.all([
    db.from("film_editorial_versions").select("essay,sources,status").eq("id",revisionId).eq("film_id",filmId).maybeSingle(),
    db.from("films").select("slug").eq("id",filmId).maybeSingle(),
  ]);
  if (!rev || !film) throw new Error("Revision not found.");
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Sign in again.");
  const { error } = await db.from("film_editorials").upsert({
    film_id:filmId, essay:rev.essay, sources:rev.sources, status:rev.status, updated_by:user.id, updated_at:new Date().toISOString(),
  }, { onConflict:"film_id" });
  if (error) throw new Error(error.message);
  await db.from("film_editorial_versions").insert({ film_id:filmId, essay:rev.essay, sources:rev.sources, status:rev.status, edited_by:user.id });
  await logAdminActivity(db,"Restored essay revision","film",filmId,film.slug);
  revalidatePath(`/admin/editorial/${filmId}`);
  revalidatePath("/admin/editorial");
  revalidatePath("/admin/quality");
  revalidatePath(`/films/${film.slug}`);
}
