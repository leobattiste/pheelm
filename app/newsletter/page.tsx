import type { Metadata } from "next";
import Link from "next/link";
import NewsletterForm from "@/components/NewsletterForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Newsletter", description: `New films and collections from ${SITE_NAME}, by email.` };

export default function NewsletterPage() {
  return (
    <article className="page narrow info-page">
      <header className="page-head">
        <h1>Newsletter</h1>
        <p className="lead">New films and collections and the film of the week, by email. No more than once a month.</p>
      </header>
      <NewsletterForm source="newsletter-page" id="newsletter-page-email" />
      <p className="muted info-note">To unsubscribe at any time, reply to any of our emails or <Link href="/contact?topic=privacy">contact us</Link>. We never share your address.</p>
    </article>
  );
}
