import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export function PrivacyPolicy() {
  const reach = CONTACT_EMAIL ? <>write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use the <Link href="/contact?topic=privacy">contact form</Link></> : <>use the <Link href="/contact?topic=privacy">contact form</Link></>;
  return (
      <div className="prose">
        <h2>The short version</h2>
        <p>
          {SITE_NAME} is in early access, so most of it needs a free account. We keep only what&rsquo;s needed to run it, we don&rsquo;t sell
          anything, there are no advertising trackers, and you can download or delete your data yourself in Settings.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Your account.</strong> Your email address, so you can sign in with a link or code. No password is stored.</li>
          <li><strong>Your profile.</strong> The name, handle and country you choose, and your privacy settings.</li>
          <li><strong>What you save and do.</strong> Your Watchlist, the films you mark as watched, your collections (and whether each is public), the collections and directors you follow, your comments and likes, and the films you suggest.</li>
          <li><strong>People you block.</strong> Kept so we can stop them commenting on your collections, co-curating with you or notifying you. They aren&rsquo;t told.</li>
          <li><strong>Newsletter.</strong> Your email address and when you signed up.</li>
          <li><strong>Messages and feedback.</strong> What you send through the contact and partnership forms: your name, email, organisation and message, and for feedback, the page or film it&rsquo;s about.</li>
          <li><strong>Reports.</strong> When you report a collection or comment, the report and, if you&rsquo;re signed in, your account.</li>
          <li><strong>Visits.</strong> Anonymous, aggregated page views (which pages are popular, from which countries and devices), measured without cookies and without identifying you.</li>
        </ul>

        <h2>Who can see what</h2>
        <ul>
          <li><strong>Everyone with an account</strong> can see your public profile: your name, handle, country, public collections, and, unless you hide them in Settings, the films you&rsquo;ve watched and the directors you follow. A private profile shows only your handle.</li>
          <li><strong>{SITE_NAME}&rsquo;s admins</strong>, who look after films and the community, can see the list of members: handles, when they joined and last signed in, and how many collections, saved films and comments each has. They read reports and messages.</li>
          <li><strong>{SITE_NAME}&rsquo;s owner</strong> can also see members&rsquo; email addresses, to answer them and keep the site safe. Your email is never shown to other members.</li>
        </ul>

        <h2>What&rsquo;s stored on your device</h2>
        <p>
          Your browser remembers your light or dark setting, how posters are shown, your recent searches and whether you&rsquo;ve seen the welcome
          steps. These stay on your device. Signing in sets a cookie that keeps you signed in. If you add {SITE_NAME} to your home screen, pages
          you&rsquo;ve opened are kept so it works offline. There are no advertising or tracking cookies.
        </p>

        <h2>Who helps us run the site</h2>
        <ul>
          <li><strong>Supabase</strong> stores accounts, watchlists, collections, the newsletter list and messages.</li>
          <li><strong>Vercel</strong> hosts the site and measures the anonymous page views.</li>
          <li><strong>TMDB</strong> provides film details, posters and photos, which your browser loads from TMDB&rsquo;s servers.</li>
          <li><strong>YouTube</strong> plays trailers, in its privacy-enhanced mode, only when you press Play.</li>
          <li><strong>An email service</strong> sends sign-in emails and the newsletter.</li>
          <li><strong>Cloudflare Turnstile</strong> checks that the contact and newsletter forms are sent by people, not bots.</li>
        </ul>
        <p>Streaming links take you to the service&rsquo;s own site, where its privacy policy applies.</p>

        <h2>How long we keep it</h2>
        <p>
          Account data is kept until you delete your account or ask us to. Newsletter addresses are kept until you unsubscribe. Messages are kept
          as long as needed to reply and follow up.
        </p>

        <h2>Your choices</h2>
        <p>
          You can see and change what you&rsquo;ve saved from your <Link href="/me">Watchlist</Link> page. In <Link href="/account">Settings</Link>
          you can make your profile private, hide what you&rsquo;ve watched or who you follow, unblock people, download a copy of your data, and
          delete your account and everything in it. For anything else, {reach}. We&rsquo;ll reply within 30 days.
        </p>

        <h2>Children</h2>
        <p>{SITE_NAME} isn&rsquo;t meant for children under 13, and we don&rsquo;t knowingly collect their information.</p>

        <h2>Changes</h2>
        <p>If this policy changes, we&rsquo;ll update the date at the top, and tell account holders by email if the change is significant.</p>
      </div>
  );
}

export function TermsPolicy() {
  return (
      <div className="prose">
        <h2>Using {SITE_NAME}</h2>
        <p>
          {SITE_NAME} is free to browse. By using it you agree to these terms. If you don&rsquo;t agree, please don&rsquo;t use the site.
        </p>

        <h2>Your account</h2>
        <p>
          You need an account to keep a watchlist, make collections or suggest films. Keep access to your email secure, since
          that&rsquo;s how you sign in. You can delete your account in <Link href="/account">Settings</Link> or <Link href="/contact?topic=privacy">contact us</Link> for help.
        </p>

        <h2>What you add</h2>
        <p>
          Collections you make public, and films you suggest, should be your own work and lawful. By adding them you let {SITE_NAME} show them on
          the site. We may edit or remove anything that breaks these terms. Suggested films are reviewed before they&rsquo;re added, and we
          decide what goes in the directory.
        </p>

        <h2>Please don&rsquo;t</h2>
        <ul>
          <li>Copy the directory in bulk, scrape it, or overload the site.</li>
          <li>Use the forms to send spam, abuse or anything unlawful.</li>
          <li>Try to get into accounts or parts of the site that aren&rsquo;t yours.</li>
        </ul>

        <h2>Films, posters and information</h2>
        <p>
          Posters, stills and trailers belong to their filmmakers and distributors and are shown to help people find the films. Film information
          comes partly from TMDB and JustWatch. {SITE_NAME} uses the TMDB API but is not endorsed or certified by TMDB. We work to keep everything
          accurate, but details, awards and where-to-watch information can be incomplete or change. <Link href="/contact?topic=correction">Tell us</Link>{" "}
          about mistakes and we&rsquo;ll fix them.
        </p>

        <h2>Other sites</h2>
        <p>Links to streaming services, IMDb, Instagram and others take you to sites we don&rsquo;t run, where their own terms apply.</p>

        <h2>No guarantees</h2>
        <p>
          {SITE_NAME} is provided as it is. We can&rsquo;t promise it will always be available or free of errors, and to the extent the law
          allows, we&rsquo;re not responsible for losses from using it.
        </p>

        <h2>Changes</h2>
        <p>We may update these terms. The date at the top shows when they last changed. Using the site after a change means you accept the new terms.</p>

        <h2>Questions</h2>
        <p><Link href="/contact">Contact us</Link> with any questions about these terms.</p>
      </div>
  );
}
