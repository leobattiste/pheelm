import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { feedbackHref } from "@/lib/feedback";
import { DONATE_MONTHLY_URL, DONATE_URL } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata("/donate");

/**
 * Support Pheelm. Each option opens Stripe's secure checkout (cards, Apple Pay, Google Pay), so no
 * payment details ever touch Pheelm. After paying, Stripe sends the donor back here with ?thanks.
 */
export default async function DonatePage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const { thanks } = await searchParams;
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

      {open ? (
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
          <div className="muted info-note donate-notes">
            <p>Payments are handled securely by Stripe. Pheelm never sees your card details.</p>
            <p>Pheelm is not a tax-exempt charity, so donations are not tax-deductible.</p>
            <p>To change or stop a monthly gift, or for a problem with a payment, <Link href="/contact">contact us</Link>.</p>
          </div>
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
