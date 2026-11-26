import "server-only";

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { rebuildCatalogSnapshot } from "@/lib/catalog-snapshot";
import { serviceClient } from "@/lib/supabase/service";
import { workerCheck } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Rebuilds the catalog snapshot if the catalog has changed: POST, or POST ?force=1 to rebuild anyway. */
export async function POST(request: NextRequest) {
  const check = await workerCheck(request, serviceClient());
  if (check !== "ok") return json({ error: "Not allowed.", reason: check }, 401);
  try {
    const result = await rebuildCatalogSnapshot(request.nextUrl.searchParams.get("force") === "1");
    if ("path" in result && result.replaced) revalidatePath("/", "layout");
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Rebuild failed." }, 500);
  }
}
