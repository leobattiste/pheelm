import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", description: `What ${SITE_NAME} collects, why, and what you can do about it.` };

export default function PrivacyPage() {
  const reach = CONTACT_EMAIL ? <>write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use the <Link href="/contact?topic=privacy">contact form</Link></> : <>use the <Link href="/contact?topic=privacy">contact form</Link></>;
  return (
    <article className="page narrow info-page">
      <header className="page-head">
        <h1>Privacy</h1>
        <p className="lead">What {SITE_NAME} collects, why, and what you can do about it. Updated {LEGAL_UPDATED}.</p>
      </header>
      <div className="prose">
        <h2>The short version</h2>
        <p>
          You can browse {SITE_NAME} without an account and without being tracked. If you make an account, sign up for the newsletter or send us a
          message, we keep only what&rsquo;s needed for that, we don&rsquo;t sell it, and you can ask us to delete it.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Your account.</strong> Your email address, so you can sign in with a link or code. No password is stored.</li>
          <li><strong>What you save.</strong> Your watchlist, your collections (and whether each is public) and the films you suggest.</li>
          <li><strong>Newsletter.</strong> Your email address and when you signed up.</li>
          <li><strong>Messages.</strong> What you send through the contact and partnership forms: your name, email, organisation and message.</li>
          <li><strong>Visits.</strong> Anonymous, aggregated page views (which pages are popular, from which countries and devices), measured without cookies and without identifying you.</li>
        </ul>

        <h2>What&rsquo;s stored on your device</h2>
        <p>
          Your browser remembers your light or dark setting, how posters are shown and your recent searches. These stay on your device. Signing in
          sets a cookie that keeps you signed in. There are no advertising or tracking cookies.
        </p>

        <h2>Who helps us run the site</h2>
        <ul>
          <li><strong>Supabase</strong> stores accounts, watchlists, collections, the newsletter list and messages.</li>
          <li><strong>Vercel</strong> hosts the site and measures the anonymous page views.</li>
          <li><strong>TMDB</strong> provides film details, posters and photos, which your browser loads from TMDB&rsquo;s servers.</li>
          <li><strong>YouTube</strong> plays trailers, in its privacy-enhanced mode, only when you press Play.</li>
        </ul>
        <p>Streaming links take you to the service&rsquo;s own site, where its privacy policy applies.</p>

        <h2>How long we keep it</h2>
        <p>
          Account data is kept until you delete your account or ask us to. Newsletter addresses are kept until you unsubscribe. Messages are kept
          as long as needed to reply and follow up.
        </p>

        <h2>Your choices</h2>
        <p>
          You can see and change what you&rsquo;ve saved from your <Link href="/me">Watchlist</Link> page. To get a copy of your data, correct it,
          or delete your account and everything in it, {reach}. We&rsquo;ll do it within 30 days.
        </p>

        <h2>Children</h2>
        <p>{SITE_NAME} isn&rsquo;t meant for children under 13, and we don&rsquo;t knowingly collect their information.</p>

        <h2>Changes</h2>
        <p>If this policy changes, we&rsquo;ll update the date at the top, and tell account holders by email if the change is significant.</p>
      </div>
    </article>
  );
}
