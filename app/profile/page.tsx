import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import PublicName from "../me/PublicName";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

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
  const p = (data ?? {}) as { handle?: string | null; display_name?: string | null };
  if (p.handle) redirect(`/@${p.handle}${sp.edit !== undefined ? "?edit" : ""}`);

  return (
    <section className="page account-page">
      <header className="page-head">
        <h1>Your profile</h1>
        <p className="label">Choose a handle to get your own page, with the collections you make public.</p>
      </header>
      <div className="account-panel">
        <PublicName handle={null} displayName={p.display_name ?? null} />
      </div>
    </section>
  );
}
