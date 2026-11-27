import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ContactForm from "@/components/ContactForm";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata("/contact");

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; film?: string; about?: string; label?: string }> }) {
  const sp = await searchParams;
  if (sp.topic === "partnership") redirect("/partnerships");
  if (sp.topic === "feedback" || sp.topic === "correction" || sp.about || sp.film) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) if (value) query.set(key, value);
    redirect(`/feedback?${query}`);
  }
  const topic = ["general", "account", "press", "privacy", "other"].includes(sp.topic ?? "") ? sp.topic! : "general";
  return (
    <article className="page full-width info-page enquiry-page contact-page">
      <div className="form-split">
        <div className="form-split-intro">
          <header className="page-head">
            <h1>Contact</h1>
            <p className="lead">Have a question or need to get in touch? Send us a message, and we&apos;ll get back to you when we can.</p>
          </header>
          {CONTACT_EMAIL && <p className="info-note">Email us directly at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>}
          <p className="muted info-note">For partnership inquiries, visit our <Link href="/partnerships">Partnership</Link> page. To report an issue or suggest an improvement, use our <Link href="/feedback">Feedback</Link> page.</p>
        </div>
        <div className="form-split-form">
          <ContactForm topic={topic} />
        </div>
      </div>
    </article>
  );
}
