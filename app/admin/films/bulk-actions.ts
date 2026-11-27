"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient, ownerClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { queueCatalogSnapshot } from "@/lib/catalog-snapshot";

const MAX_SELECTION = 1000;
const BATCH = 150;

/** Publish, draft, feature or (owner only) permanently delete selected films. */
export async function bulkFilmChange(form: FormData) {
  const ids = [...new Set(form.getAll("ids").map(String))].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const operation = String(form.get("operation") ?? "");
  if (!ids.length) redirect("/admin/films?error=selection");
  if (ids.length > MAX_SELECTION) throw new Error(`Select at most ${MAX_SELECTION} films per action.`);
  if (!["publish", "draft", "feature", "unfeature", "delete"].includes(operation)) throw new Error("Unsupported action.");

  // Deletion is restricted to the owner on the server, not just hidden in the UI.
  const db = operation === "delete" ? await ownerClient() : await adminClient();
  const patch = {
    publish: { status: "published" },
    draft: { status: "draft" },
    feature: { featured: true },
    unfeature: { featured: false },
  } as const;
  let changed = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const result = operation === "delete"
      ? await db.from("films").delete().in("id", batch).select("id, title, year")
      : await db.from("films").update({
          ...patch[operation as keyof typeof patch], updated_at: new Date().toISOString(),
        }).in("id", batch).select("id, title, year");
    if (result.error) throw new Error(result.error.message);
    changed += result.data?.length ?? 0;
    const names = (result.data ?? []).map((r) => `${r.title} (${r.year})`);
    const verb = ({ publish: "Published", draft: "Moved to drafts", feature: "Featured", unfeature: "Stopped featuring", delete: "Deleted" } as Record<string, string>)[operation];
    await logAdminActivity(db, `${verb} ${names.length} ${names.length === 1 ? "film" : "films"}`, "film", null, names.join(", ").slice(0, 480));
  }

  queueCatalogSnapshot();
  revalidatePath("/", "layout");
  redirect(`/admin/films?updated=${changed}`);
}
