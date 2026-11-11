"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { fillPerson, importFilm } from "@/lib/import";
import { tmdbEnabled } from "@/lib/tmdb";

export type ImportResult = { id: string; ok: boolean; message: string };

/** Small, authenticated batches keep large selections out of a single long server request. */
export async function importSelectedFromTmdb(entity: "films" | "people", ids: string[]): Promise<ImportResult[]> {
  const db = await adminClient();
  if (entity !== "films" && entity !== "people") throw new Error("Unsupported catalog.");
  if (!Array.isArray(ids) || !ids.length || ids.length > 3 || ids.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new Error("Import up to three valid items per batch.");
  }
  if (!tmdbEnabled) throw new Error("TMDB import is unavailable. Check the TMDB API key in project settings.");

  const results = await Promise.all([...new Set(ids)].map(async (id): Promise<ImportResult> => {
    try {
      let message: string;
      if (entity === "films") {
        message = await importFilm(db, id);
      } else {
        const { data: person, error } = await db.from("people").select("*").eq("id", id).single();
        if (error || !person) throw new Error("Director not found.");
        if (!person.tmdb_id) throw new Error(`${person.name}: add a TMDB person ID in the editor before importing.`);
        await fillPerson(db, person);
        message = `${person.name}: imported available TMDB details into empty fields.`;
      }
      await logAdminActivity(db, "Imported selected TMDB metadata", entity === "films" ? "film" : "person", id);
      return { id, ok: true, message };
    } catch (error) {
      return { id, ok: false, message: error instanceof Error ? error.message : "Could not import this item. Try again." };
    }
  }));
  revalidatePath("/", "layout");
  return results;
}
