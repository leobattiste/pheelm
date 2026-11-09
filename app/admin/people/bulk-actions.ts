"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient, ownerClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";

const BATCH = 150;

/** Publish/draft controls people.in_directory, never their film's publication status. */
export async function bulkPersonChange(form: FormData) {
  const ids = [...new Set(form.getAll("ids").map(String))].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const operation = String(form.get("operation") ?? "");
  if (!ids.length) redirect("/admin/people?error=selection");
  if (ids.length > 1000) throw new Error("Select at most 1,000 people per action.");
  if (!["publish", "draft", "delete"].includes(operation)) throw new Error("Unsupported action.");

  const db = operation === "delete" ? await ownerClient() : await adminClient();
  if (operation === "delete") {
    // Never silently erase film credits. Removing a credited person can leave
    // films without a director, so these records require manual review first.
    for (let i = 0; i < ids.length; i += BATCH) {
      const { data, error } = await db.from("credits").select("person_id").in("person_id", ids.slice(i, i + BATCH)).limit(1);
      if (error) throw new Error(error.message);
      if (data?.length) throw new Error("Some selected people have film credits. Remove or reassign their credits first; no one has been deleted.");
    }
  }

  let changed = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const result = operation === "delete"
      ? await db.from("people").delete().in("id", batch).select("id")
      : await db.from("people").update({ in_directory: operation === "publish" }).in("id", batch).select("id");
    if (result.error) throw new Error(result.error.message);
    changed += result.data?.length ?? 0;
    await logAdminActivity(db, `Bulk ${operation} people`, "person", null, `${result.data?.length ?? 0} people · ${batch.join(",").slice(0, 350)}`);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/people?updated=${changed}`);
}
