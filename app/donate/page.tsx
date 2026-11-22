import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { feedbackHref } from "@/lib/feedback";
import { DONATE_MONTHLY_URL, DONATE_URL } from "@/lib/site";
import { donationResult, EMBEDDED_DONATIONS, PUBLISHABLE_KEY } from "@/lib/donate";
import DonateForm from "./DonateForm";

export const metadata: Metadata = publicPageMetadata("/donate");

/**
 * Support Pheelm. With Stripe keys set, donors choose an amount and pay in Stripe's secure form right
 * on this page (cards, Apple Pay, Google Pay); card details go to Stripe, never to Pheelm. Without the
 * keys, the options link to Stripe's own checkout. Either way the donor comes back here to a thank-you.
 */
export default async function DonatePage({ searchParams }: { searchParams: Promise<{ thanks?: string; session_id?: string }> }) {
  const { thanks: linkThanks, session_id } = await searchParams;
  const result = session_id ? await donationResult(session_id) : null;
  const thanks = result?.paid ? (result.monthly ? "monthly" : "1") : linkThanks;
  const open = Boolean(DONATE_URL || DONATE_MONTHLY_URL);
  return (
    <article className="page narrow info-page donate-page">
      <header className="page-head">
        <h1>Support Pheelm</h1>
        <p className="lead">
          Pheelm is independent and free to use. Donations pay for hosting and for the time it takes to
          research, verify and write about every film.
        </p>
      </header>

      {thanks && (
        <p className="donate-thanks" role="status">
          {thanks === "monthly"
            ? "Thank you for giving every month. It means a lot."
            : "Thank you for your donation. It means a lot."}
        </p>
      )}

      {session_id && result && !result.paid && (
        <p className="notice error" role="alert">That payment didn&rsquo;t go through. You haven&rsquo;t been charged; please try again.</p>
      )}

      {EMBEDDED_DONATIONS ? (
        <>
          <DonateForm publishableKey={PUBLISHABLE_KEY} />
          <Notes />
        </>
      ) : open ? (
        <>
          <ul className="donate-options">
            {DONATE_URL && (
              <li className="donate-option">
                <h2>Give once</h2>
                <p>Any amount from $1. We suggest $10.</p>
                <a className="button primary" href={DONATE_URL}>Donate</a>
              </li>
            )}
            {DONATE_MONTHLY_URL && (
              <li className="donate-option">
                <h2>Give monthly</h2>
                <p>From $5 a month, in steps of $5. Stop whenever you like.</p>
                <a className="button" href={DONATE_MONTHLY_URL}>Give monthly</a>
              </li>
            )}
          </ul>
          <Notes />
        </>
      ) : (
        <p className="muted info-note">
          Donations open soon. In the meantime, you can help by <Link href="/submit">suggesting a film</Link> we&rsquo;re
          missing or <Link href={feedbackHref("/donate", "Donate")}>telling us what you think</Link>.
        </p>
      )}
    </article>
  );
}

function Notes() {
  return (
    <div className="muted info-note donate-notes">
      <p>Payments are handled securely by Stripe. Pheelm never sees your card details.</p>
      <p>Pheelm is not a tax-exempt charity, so donations are not tax-deductible.</p>
      <p>To change or stop a monthly gift, or for a problem with a payment, <Link href="/contact">contact us</Link>.</p>
    </div>
  );
}
