import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", description: "Questions, corrections, press and privacy requests." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return (
    <article className="page narrow info-page">
      <header className="page-head">
        <h1>Contact</h1>
        <p className="lead">
          Questions, corrections, press or privacy requests: send a message and we&rsquo;ll reply by email.
          {CONTACT_EMAIL && <> You can also write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>}
        </p>
      </header>
      <p className="muted info-note">
        To suggest a film, use <Link href="/submit">Suggest a film</Link>. For festivals, distributors and schools, see <Link href="/partnerships">Partnerships</Link>.
      </p>
      <ContactForm topic={topic} />
    </article>
  );
}
