"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { serviceClient } from "@/lib/supabase/service";
import { tmdbEnabled } from "@/lib/tmdb";
import { queueCatalogSnapshot } from "@/lib/catalog-snapshot";
import { JOBS, isJobKind, logFinishedJobs, runJobs } from "@/lib/jobs";

type Result = { ok: boolean; message: string };

/**
 * Starts a background job. The first batches run straight away (after this action answers), and
 * the worker carries on every minute until it's done, with or without this page open.
 */
export async function startJob(kind: string): Promise<Result> {
  try {
    const db = await adminClient();
    if (!isJobKind(kind)) return { ok: false, message: "Unknown job." };
    const job = JOBS[kind];
    if (job.tmdb && !tmdbEnabled) return { ok: false, message: "Add TMDB_API_KEY in Vercel to run this." };
    const service = serviceClient();
    if (!service) return { ok: false, message: "The server key isn't set, so jobs can't run. Add SUPABASE_SERVICE_ROLE_KEY in Vercel." };
    const { data: { user } } = await db.auth.getUser();
    const total = await job.remaining(service);
    const { data, error } = await service.from("admin_jobs").insert({ kind, total, started_by: user?.id ?? null }).select("id").single();
    if (error) return { ok: false, message: error.code === "23505" ? `${job.label} is already running.` : "Couldn't start the job. Try again." };
    await logAdminActivity(db, `Started: ${job.label}`, "job", data.id, `${total.toLocaleString("en-US")} to check`);
    after(async () => {
      const { changed, finished } = await runJobs(service, 240_000, data.id);
      if (changed) queueCatalogSnapshot();
      if (finished.length) await logFinishedJobs(service, finished);
    });
    revalidatePath("/admin/automation");
    return { ok: true, message: `${job.label} started.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** Stops a running job after the batch in hand. It can be started again from the beginning. */
export async function stopJob(id: string): Promise<Result> {
  try {
    const db = await adminClient();
    const service = serviceClient();
    if (!service) return { ok: false, message: "The server key isn't set." };
    const { data } = await service.from("admin_jobs").update({ status: "stopped", finished_at: new Date().toISOString(), locked_until: null })
      .eq("id", id).eq("status", "running").select("kind").maybeSingle();
    if (!data) return { ok: false, message: "That job isn't running." };
    await logAdminActivity(db, `Stopped: ${JOBS[data.kind as keyof typeof JOBS]?.label ?? "job"}`, "job", id);
    revalidatePath("/admin/automation");
    return { ok: true, message: "Stopped." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}
