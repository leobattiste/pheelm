import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Partnerships",
  description: `Work with ${SITE_NAME}: festivals, distributors, streaming services, schools and film societies.`,
};

const WAYS: [string, string][] = [
  ["Festivals", "Bring your programme, past winners and retrospectives to a global audience with a dedicated collection, and keep them findable long after the festival ends."],
  ["Distributors and streaming services", "Make sure your films are listed with accurate details, trailers and where to watch, and featured when they're released."],
  ["Schools, libraries and film societies", "Build curated collections for courses and screenings, and point students and members to where each film can be watched."],
];

export default function PartnershipsPage() {
  return (
    <article className="page narrow info-page">
      <header className="page-head">
        <h1>Partnerships</h1>
        <p className="lead">{SITE_NAME} works with the people who make, show and teach films by Black directors.</p>
      </header>

      <ul className="ways">
        {WAYS.map(([title, text]) => (
          <li key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </li>
        ))}
      </ul>

      <section className="info-section" aria-labelledby="partner-form">
        <h2 id="partner-form">Get in touch</h2>
        <p className="muted">Tell us who you are and what you have in mind. We reply to every message.</p>
        <ContactForm partnership />
      </section>
    </article>
  );
}
