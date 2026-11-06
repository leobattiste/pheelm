import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Tabs from "@/components/Tabs";
import { getDirectors, toDirectorSummary } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";
import PublicName from "../me/PublicName";
import EmailForm from "./EmailForm";
import { Following, Submissions, type Update } from "./sections";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account", robots: { index: false } };

/**
 * Where members manage who they are on Pheelm: their public name, sign-in email, the directors
 * they follow, the films they've suggested, and their data. Their films live on the Watchlist.
 */
export default async function AccountPage() {
  const db = await getServerClient();
  if (!db) {
    return (
      <section className="panel">
        <h1>Account</h1>
        <p className="lead">Accounts aren&rsquo;t available yet. Check back soon.</p>
      </section>
    );
  }
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [{ data: profile }, { data: submissions }, followsResult, updatesResult, directors] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("submissions").select("id, title, director, year, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("follows").select("person_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.rpc("follow_updates"),
    getDirectors(),
  ]);
  const p = (profile ?? {}) as { handle?: string | null; display_name?: string | null; is_admin?: boolean };
  // Public names need community.sql; following needs follows.sql. Each part shows once its SQL has run.
  const namesReady = "handle" in p;
  const followsReady = !followsResult.error;
  const followedIds = new Set((followsResult.data ?? []).map((f: { person_id: string }) => f.person_id));
  const followed = directors.filter((d) => followedIds.has(d.id)).map(toDirectorSummary);
  const updates = (updatesResult.data ?? []) as Update[];

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      panel: (
        <div className="account-panel">
          {namesReady && <PublicName handle={p.handle ?? null} displayName={p.display_name ?? null} />}
          <section className="account-section" aria-labelledby="signin-h">
            <h2 id="signin-h">Sign-in email</h2>
            <p className="muted">You sign in with a link or code sent to this address. No password needed.</p>
            <EmailForm email={user.email ?? ""} />
          </section>
          <section className="account-section" aria-labelledby="data-h">
            <h2 id="data-h">Your data</h2>
            <p className="muted">
              To get a copy of your data or delete your account and everything in it, <Link href="/contact?topic=privacy">contact us</Link>. See the{" "}
              <Link href="/privacy">privacy policy</Link> for what&rsquo;s kept and why.
            </p>
            <form action="/auth/signout" method="post" className="actions">
              <button className="button ghost" type="submit">Sign out</button>
            </form>
          </section>
        </div>
      ),
    },
    ...(followsReady
      ? [{ id: "following", label: `Following${followed.length ? ` (${followed.length})` : ""}`, panel: <Following directors={followed} updates={updates} /> }]
      : []),
    {
      id: "suggestions",
      label: `Suggestions${submissions?.length ? ` (${submissions.length})` : ""}`,
      panel: <Submissions rows={submissions ?? []} />,
    },
  ];

  return (
    <section className="page account-page">
      <header className="page-head">
        <h1>Account</h1>
        <p className="label">
          {user.email}
          {p.handle && <> • <Link href={`/@${p.handle}`}>pheelm.com/@{p.handle}</Link></>}
          {p.is_admin && <> • <Link href="/admin">Admin</Link></>}
        </p>
      </header>
      <Tabs tabs={tabs} />
    </section>
  );
}
