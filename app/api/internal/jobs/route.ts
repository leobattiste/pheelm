import "server-only";

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { workerCheck } from "@/lib/worker-auth";
import { queueCatalogSnapshot } from "@/lib/catalog-snapshot";
import { logFinishedJobs, runJobs } from "@/lib/jobs";

export const runtime = "nodejs";
// Called every minute while a job runs (pheelm-admin-jobs); each call works for about 50 seconds.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Works through running admin jobs for up to ~50 seconds. */
export async function POST(request: NextRequest) {
  const db = serviceClient();
  const check = await workerCheck(request, db);
  if (check !== "ok") return json({ error: "Not allowed.", reason: check }, 401);
  if (!db) return json({ error: "Supabase is not configured." }, 503);
  const { batches, changed, finished } = await runJobs(db, 50_000);
  if (changed) queueCatalogSnapshot();
  if (finished.length) {
    await logFinishedJobs(db, finished);
    revalidatePath("/", "layout");
  }
  return json({ batches, changed, finished: finished.length });
}
