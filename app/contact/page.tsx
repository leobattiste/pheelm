import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ContactForm from "@/components/ContactForm";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", description: "Contact Pheelm for general enquiries, press and privacy requests." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; film?: string; about?: string; label?: string }> }) {
  const sp = await searchParams;
  if (sp.topic === "partnership") redirect("/partnerships");
  if (sp.topic === "feedback" || sp.topic === "correction" || sp.about || sp.film) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) if (value) query.set(key, value);
    redirect(`/feedback?${query}`);
  }
  const topic = sp.topic === "press" || sp.topic === "privacy" ? sp.topic : "general";
  return (
    <article className="page narrow info-page enquiry-page">
      <header className="page-head">
        <h1>Contact</h1>
        <p className="lead">Get in touch for general enquiries, press or privacy requests. Leave your email so we can reply.</p>
      </header>
      {CONTACT_EMAIL && <p className="info-note">Email us directly at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>}
      <ContactForm topic={topic} />
      <p className="muted info-note">Found a problem or have an improvement in mind? <Link href="/feedback">Give feedback</Link>. For collaborations, visit <Link href="/partnerships">Partnership</Link>.</p>
    </article>
  );
}
