"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";

export async function bulkFilmChange(form: FormData) {
  const db = await adminClient();
  const ids = [...new Set(form.getAll("ids").map(String))].filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 50);
  const operation = String(form.get("operation") ?? "");
  if (!ids.length) redirect("/admin/films?error=selection");
  const changes = {
    publish: { status: "published" },
    draft: { status: "draft" },
    feature: { featured: true },
    unfeature: { featured: false },
  } as const;
  if (!(operation in changes)) throw new Error("Unsupported action.");
  const patch = changes[operation as keyof typeof changes];
  const { data, error } = await db.from("films").update({ ...patch, updated_at: new Date().toISOString() }).in("id", ids).select("id");
  if (error) throw new Error(error.message);
  await logAdminActivity(db, `Bulk ${operation}`, "film", null, `${data?.length ?? 0} films: ${ids.join(",").slice(0, 350)}`);
  revalidatePath("/", "layout");
  redirect(`/admin/films?updated=${data?.length ?? 0}`);
}
