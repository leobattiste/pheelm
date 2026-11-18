import { getUnifiedSearchData } from "@/lib/unified-search-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    return Response.json(await getUnifiedSearchData(), { headers });
  } catch {
    return Response.json({ error: "Search could not be loaded. Please try again." }, { status: 503, headers });
  }
}
