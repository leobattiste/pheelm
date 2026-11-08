import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import GridToggle from "@/components/GridToggle";
import NewsletterSubscribe from "./NewsletterSubscribe";
import type { IconName } from "@/components/Icon";
import Tabs from "@/components/Tabs";
import ThemeToggle from "@/components/ThemeToggle";
import { getServerClient } from "@/lib/supabase/server";
import { DeleteAccount, SignOutEverywhere } from "./AccountActions";
import EmailForm from "./EmailForm";
import PrivacyForm from "./PrivacyForm";
import ProfileForm from "./ProfileForm";
import NotificationPreferences from "./NotificationPreferences";
import { unblock } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings", description: PAGE_COPY.account, robots: { index: false } };

/**
 * Settings, in tabs: your profile, your account (sign-in email and signing out), notifications, privacy
 * (a private profile, hiding Watched or Following, blocked people), appearance, and your data.
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
  const p = (profile ?? {}) as {
    avatar_url?: string | null; handle?: string | null; display_name?: string | null; is_admin?: boolean; is_private?: boolean; country?: string | null;
    hide_watched?: boolean; hide_following?: boolean;
  };
  const blockRows = await db.from("blocks").select("blocked_id, created_at").eq("blocker_id", user.id).order("created_at", { ascending: false });
  const blockedIds = ((blockRows.data ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id);
  const blockedPeople = blockedIds.length
    ? (((await db.from("member_profiles").select("id, handle, display_name").in("id", blockedIds)).data ?? []) as { id: string; handle: string; display_name: string | null }[])
    : [];

  const { data: notificationPrefs } = await db.from("notification_preferences").select("disabled_types").eq("user_id", user.id).maybeSingle();
  const disabledNotificationTypes = (notificationPrefs?.disabled_types ?? []) as string[];

  const { data: subscribedToNewsletter } = await db.rpc("my_newsletter_subscription");

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      icon: "user" as IconName,
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="profile-h">
            <h2 id="profile-h">Your profile</h2>
            <p className="muted">
              {p.handle
                ? <>How you appear on <Link href={`/@${p.handle}`}>pheelm.com/@{p.handle}</Link>, on your public collections and in comments.</>
                : <>Choose a handle to get a profile page for your public collections.</>}
            </p>
            <ProfileForm avatarUrl={p.avatar_url ?? null} handle={p.handle ?? null} displayName={p.display_name ?? null} isPrivate={!!p.is_private} country={p.country ?? null} />
          </section>
        </div>
      ),
    },
    {
      id: "account",
      label: "Account",
      icon: "gear" as IconName,
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="signin-h">
            <h2 id="signin-h">Sign-in email</h2>
            <p className="muted">You sign in with a link or code sent to this address. No password needed.</p>
            <EmailForm email={user.email ?? ""} />
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
      id: "notifications",
      label: "Notifications",
      icon: "bell" as IconName,
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="notification-settings-h">
            <h2 id="notification-settings-h">Notification preferences</h2>
            <NotificationPreferences userId={user.id} initialDisabled={disabledNotificationTypes} isAdmin={!!p.is_admin} />
            <p className="muted"><Link href="/notifications">View your notifications</Link></p>
          </section>
          <section className="account-section" aria-labelledby="news-h">
            <h2 id="news-h">Newsletter</h2>
            <p className="muted">Receive occasional updates about films, collections and stories. Unsubscribe anytime.</p>
            <NewsletterSubscribe email={user.email ?? ""} initialSubscribed={subscribedToNewsletter === true} />
          </section>
        </div>
      ),
    },
    {
      id: "privacy",
      label: "Privacy",
      icon: "lock" as IconName,
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="visibility-h">
            <h2 id="visibility-h">Your profile</h2>
            <p className="muted">Choose what others see on your profile.</p>
            <PrivacyForm isPrivate={!!p.is_private} hideWatched={!!p.hide_watched} hideFollowing={!!p.hide_following} />
          </section>
          <section className="account-section" aria-labelledby="blocked-h">
            <h2 id="blocked-h">Blocked</h2>
            <p className="muted">People you block can&rsquo;t comment on your collections, co-curate with you or notify you, and you don&rsquo;t see their comments. Block someone from the &#8943; menu on their profile.</p>
            {blockRows.error ? null : blockedPeople.length ? (
              <ul className="blocked-list">
                {blockedPeople.map((b) => (
                  <li key={b.id} className="person-row">
                    <span className="person-row-who">
                      <span className="person-row-name">{b.display_name || `@${b.handle}`}</span>
                      <span className="person-row-handle">@{b.handle}</span>
                    </span>
                    <form action={unblock}>
                      <input type="hidden" name="id" value={b.id} />
                      <button type="submit" className="button ghost small">Unblock</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">You haven&rsquo;t blocked anyone.</p>
            )}
          </section>
        </div>
      ),
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: "moon" as IconName,
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
      icon: "stack" as IconName,
      panel: (
        <div className="account-panel">
          <section className="account-section" aria-labelledby="download-h">
            <h2 id="download-h">Download your data</h2>
            <p className="muted">A file with your profile, Watchlist, collections, who you follow, your comments and the films you suggested.</p>
            <div className="actions"><a className="button ghost" href="/account/export" download>Download</a></div>
          </section>
          <section className="account-section" aria-labelledby="privacy-h">
            <h2 id="privacy-h">Privacy policy</h2>
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
