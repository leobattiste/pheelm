import type { NextRequest } from "next/server";
import { getUnifiedSearchData, getViewerSearchData } from "@/lib/unified-search-data";

export const dynamic = "force-dynamic";

/** ?viewer=1 returns only the viewer's own part (follows, own lists); otherwise everything. */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const viewerOnly = request.nextUrl.searchParams.get("viewer") === "1";
    return Response.json(viewerOnly ? await getViewerSearchData() : await getUnifiedSearchData(), { headers });
  } catch {
    return Response.json({ error: "Search could not be loaded. Please try again." }, { status: 503, headers });
  }
}
