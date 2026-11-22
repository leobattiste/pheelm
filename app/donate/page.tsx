import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { feedbackHref } from "@/lib/feedback";
import { DONATE_URL, DONATION_PORTAL_URL } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata("/donate");

/** Support Pheelm: a Donate button that opens Stripe's secure checkout, and a thank-you when Stripe sends donors back with ?thanks. */
export default async function DonatePage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const { thanks } = await searchParams;
  return (
    <article className="page narrow info-page donate-page">
      <header className="page-head">
        <h1>Support Pheelm</h1>
        <p className="lead">
          Pheelm is independent and free to use. Donations pay for hosting and for the time it takes to
          research, verify and write about every film.
        </p>
      </header>

      {thanks !== undefined && (
        <p className="donate-thanks" role="status">Thank you for your donation. It means a lot.</p>
      )}

      {DONATE_URL ? (
        <>
          <section className="donate-card" aria-label="Donate">
            <a className="button" href={DONATE_URL}>Donate</a>
          </section>
          <div className="muted info-note donate-notes">
            <p>Payments are handled securely by Stripe. Pheelm never sees your card details.</p>
            <p>Pheelm is not a tax-exempt charity, so donations are not tax-deductible.</p>
            <p>Already giving? <a href={DONATION_PORTAL_URL}>Update your card or see your receipts</a>. For a problem with a payment, <Link href="/contact">contact us</Link>.</p>
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
