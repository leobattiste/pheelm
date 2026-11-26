import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { feedbackHref } from "@/lib/feedback";
import PayPalDonate from "@/components/PayPalDonate";
import { DONATION_PORTAL_URL, PAYPAL_BUTTON_ID } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata("/donate");

/** Donate: PayPal's hosted Donate button (card, PayPal or Venmo), and a thank-you when PayPal sends donors back with ?thanks. */
export default async function DonatePage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const { thanks } = await searchParams;
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

      {PAYPAL_BUTTON_ID ? (
        <>
          <PayPalDonate buttonId={PAYPAL_BUTTON_ID} />
          <div className="muted info-note donate-notes">
            <p>Payments are handled securely by PayPal. Pheelm never sees your card or PayPal details.</p>
            <p>Pheelm is not a tax-exempt charity, so donations are not tax-deductible.</p>
            <p>Giving monthly? <a href={DONATION_PORTAL_URL}>Change or cancel it in PayPal</a>. For a problem with a payment, <Link href="/contact">contact us</Link>.</p>
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
