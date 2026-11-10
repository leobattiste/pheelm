import { notFound, permanentRedirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { watchlistPath } from "@/lib/watchlist-links";
import { collectionIdForLegacySlug } from "@/lib/community";

/** Pheelm's collections used to live at /collections/<slug>; they're @leo's collections now. */
export default async function LegacyCollection({ params }: { params: Promise<{ slug: string }> }) {
  const id = await collectionIdForLegacySlug((await params).slug);
  if (!id) notFound();
  const db=await getServerClient();
  const result=db?await db.from("lists").select("id,slug").eq("id",id).maybeSingle():null;
  if(!result?.data)notFound();
  permanentRedirect(watchlistPath(result.data));
}
