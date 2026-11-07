import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import GridToggle from "@/components/GridToggle";
import NewsletterForm from "@/components/NewsletterForm";
import Tabs from "@/components/Tabs";
import ThemeToggle from "@/components/ThemeToggle";
import { getServerClient } from "@/lib/supabase/server";
import { DeleteAccount, SignOutEverywhere } from "./AccountActions";
import EmailForm from "./EmailForm";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings", description: PAGE_COPY.account, robots: { index: false } };

/**
 * Settings, in tabs: your profile, your account (sign-in email, newsletter, signing out),
 * appearance, and your data (download or delete).
 */
export default async function AccountPage() {
  const db = await getServerClient();
  if (!db) {
    return (
      <section className="panel">
        <h1>Settings</h1>
        <p className="lead">Accounts aren&rsquo;t available yet. Check back soon.</p>
      </section>
    );
  }
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const p = (profile ?? {}) as { handle?: string | null; display_name?: string | null; is_admin?: boolean; is_private?: boolean; country?: string | null };

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="profile-h">
            <h2 id="profile-h">Your profile</h2>
            <p className="muted">
              {p.handle
                ? <>How you appear on <Link href={`/@${p.handle}`}>pheelm.com/@{p.handle}</Link>, on your public collections and in comments.</>
                : <>Choose a handle to get a profile page for your public collections.</>}
            </p>
            <ProfileForm handle={p.handle ?? null} displayName={p.display_name ?? null} isPrivate={!!p.is_private} country={p.country ?? null} />
          </section>
        </div>
      ),
    },
    {
      id: "account",
      label: "Account",
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="signin-h">
            <h2 id="signin-h">Sign-in email</h2>
            <p className="muted">You sign in with a link or code sent to this address. No password needed.</p>
            <EmailForm email={user.email ?? ""} />
          </section>
          <section className="account-section" aria-labelledby="news-h">
            <h2 id="news-h">Newsletter</h2>
            <p className="muted">New films, collections and stories from Pheelm, now and then. Unsubscribe from any email.</p>
            <NewsletterForm source="settings" id="settings-newsletter" />
          </section>
          <section className="account-section" aria-labelledby="notif-h">
            <h2 id="notif-h">Notifications</h2>
            <p className="muted">
              You&rsquo;re notified when a director you follow has a new film, when a film is added to a collection you follow,
              and about invites, comments and mentions. <Link href="/notifications">See your notifications</Link>
            </p>
          </section>
          <section className="account-section" aria-labelledby="signout-h">
            <h2 id="signout-h">Sign out</h2>
            <p className="muted">Sign out here, or everywhere you&rsquo;re signed in, if you used a shared or lost device.</p>
            <div className="actions">
              <form action="/auth/signout" method="post"><button className="button ghost" type="submit">Sign out</button></form>
              <SignOutEverywhere />
            </div>
          </section>
        </div>
      ),
    },
    {
      id: "appearance",
      label: "Appearance",
      panel: (
        <div className="account-panel">
          <section className="account-section settings-rows" aria-labelledby="appearance-h">
            <h2 id="appearance-h">Appearance</h2>
            <p className="muted">Saved on this device.</p>
            <div className="setting-row"><span>Theme</span><ThemeToggle /></div>
            <div className="setting-row"><span>Grid</span><GridToggle /></div>
          </section>
        </div>
      ),
    },
    {
      id: "data",
      label: "Your data",
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="download-h">
            <h2 id="download-h">Download your data</h2>
            <p className="muted">A file with your profile, Watchlist, collections, who you follow, your comments and the films you suggested.</p>
            <div className="actions"><a className="button ghost" href="/account/export" download>Download</a></div>
          </section>
          <section className="account-section" aria-labelledby="privacy-h">
            <h2 id="privacy-h">Privacy</h2>
            <p className="muted">See the <Link href="/privacy">privacy policy</Link> for what&rsquo;s kept and why, or <Link href="/contact?topic=privacy">contact us</Link> with a question.</p>
          </section>
          <section className="account-section" aria-labelledby="delete-h">
            <h2 id="delete-h">Delete your account</h2>
            <p className="muted">Your profile, Watchlist, collections, follows, comments and notifications are deleted for good. This can&rsquo;t be undone.</p>
            <DeleteAccount />
          </section>
        </div>
      ),
    },
  ];

  return (
    <section className="page account-page">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="label">
          {user.email}
          {p.handle && <> • <Link href={`/@${p.handle}`}>@{p.handle}</Link></>}
          {p.is_admin && <> • <Link href="/admin">Admin</Link></>}
        </p>
      </header>
      <Tabs tabs={tabs} />
    </section>
  );
}
