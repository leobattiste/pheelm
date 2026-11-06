import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Tabs from "@/components/Tabs";
import { getServerClient } from "@/lib/supabase/server";
import EmailForm from "./EmailForm";
import { Submissions } from "./sections";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account", description: PAGE_COPY.account, robots: { index: false } };

/**
 * Settings: the sign-in email, the films a member has suggested, and their data. Their name,
 * handle, privacy and the directors they follow are on their profile; their films on the Watchlist.
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

  const [{ data: profile }, { data: submissions }] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("submissions").select("id, title, director, year, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const p = (profile ?? {}) as { handle?: string | null; display_name?: string | null; is_admin?: boolean };

  const tabs = [
    {
      id: "account",
      label: "Account",
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="profile-h">
            <h2 id="profile-h">Profile</h2>
            <p className="muted">
              {p.handle
                ? <>Your name, handle, privacy and the directors you follow are on <Link href={`/@${p.handle}`}>your profile</Link>.</>
                : <>Choose a handle to get a profile page for your public collections and the directors you follow. <Link href="/profile">Create your profile</Link></>}
            </p>
          </section>
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
    {
      id: "submissions",
      label: `Submissions${submissions?.length ? ` (${submissions.length})` : ""}`,
      panel: <Submissions rows={submissions ?? []} />,
    },
  ];

  return (
    <section className="page account-page">
      <header className="page-head">
        <h1>Account</h1>
        <p className="lead">{PAGE_COPY.account}</p>
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
