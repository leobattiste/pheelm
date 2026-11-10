import { privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import PublicName from "../me/PublicName";

export const dynamic = "force-dynamic";
export const metadata: Metadata = privateMetadata("Your profile");

type Props = { searchParams: Promise<{ edit?: string }> };

/**
 * A shortcut to your own profile at /@handle (with ?edit to open Edit profile). Without a handle
 * yet, this is where you choose one.
 */
export default async function ProfilePage({ searchParams }: Props) {
  const sp = await searchParams;
  const db = await getServerClient();
  if (!db) redirect("/");
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/profile");
  const { data } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const p = (data ?? {}) as { handle?: string | null; display_name?: string | null; social_platform?: string | null; social_url?: string | null; website_url?: string | null; avatar_url?: string | null; bio?: string | null };
  if (p.handle) redirect(`/@${p.handle}${sp.edit !== undefined ? "?edit" : ""}`);

  return (
    <section className="page create-profile-page">
      <header className="page-head">
        <h1>Create your profile</h1>
        <p className="lead">Add a photo, choose your handle, and tell people a little about yourself.</p>
      </header>
      <PublicName links={p} avatarUrl={p.avatar_url ?? null} bio={p.bio ?? null} handle={null} displayName={p.display_name ?? null} />
    </section>
  );
}
