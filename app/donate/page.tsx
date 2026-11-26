import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { feedbackHref } from "@/lib/feedback";
import DonateCheckout from "@/components/DonateCheckout";
import { DONATE_URL, DONATION_PORTAL_URL } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata("/donate");

/**
 * Donate: an amount picker with Stripe's checkout embedded on the page when the Stripe keys are set;
 * otherwise a Donate button to the Stripe payment link. A thank-you shows when donors come back with ?thanks.
 */
export default async function DonatePage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const { thanks } = await searchParams;
  const publishableKey = process.env.STRIPE_SECRET_KEY ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : undefined;
  return (
    <article className="page narrow info-page donate-page">
      <header className="page-head">
        <h1>Donate</h1>
        <p className="lead">
          Pheelm is an independent platform dedicated to helping people discover films by Black directors
          around the world. We believe their stories and contributions to cinema deserve greater recognition.
        </p>
        <p className="lead">
          We don&rsquo;t run ads, and your donations help us cover operating costs, improve the platform, and
          keep Pheelm accessible to everyone. Every contribution, no matter the amount, helps us continue
          building and growing.
        </p>
      </header>

      {thanks !== undefined && (
        <p className="donate-thanks" role="status">Thank you for your donation. It means a lot.</p>
      )}

      {publishableKey || DONATE_URL ? (
        <>
          {publishableKey ? (
            <DonateCheckout publishableKey={publishableKey} />
          ) : (
            <section className="donate-card" aria-label="Donate">
              <a className="button" href={DONATE_URL}>Donate</a>
            </section>
          )}
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
