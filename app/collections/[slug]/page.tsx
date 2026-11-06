import { notFound, permanentRedirect } from "next/navigation";
import { collectionIdForLegacySlug } from "@/lib/community";

/** Pheelm's collections used to live at /collections/<slug>; they're @leo's collections now. */
export default async function LegacyCollection({ params }: { params: Promise<{ slug: string }> }) {
  const id = await collectionIdForLegacySlug((await params).slug);
  if (!id) notFound();
  permanentRedirect(`/c/${id}`);
}
