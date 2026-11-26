import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import NewsletterForm from "@/components/NewsletterForm";

export const metadata: Metadata = publicPageMetadata("/newsletter");

export default function NewsletterPage() {
  return (
    <article className="page full-width info-page">
      <div className="form-split">
        <div className="form-split-intro">
          <header className="page-head">
            <h1>Newsletter</h1>
            <p className="lead">New films and watchlists and the film of the week, by email. No more than once a month.</p>
          </header>
          <p className="muted info-note">To unsubscribe at any time, reply to any of our emails or <Link href="/contact?topic=privacy">contact us</Link>. We never share your address.</p>
        </div>
        <div className="form-split-form">
          <NewsletterForm source="newsletter-page" id="newsletter-page-email" />
        </div>
      </div>
    </article>
  );
}
