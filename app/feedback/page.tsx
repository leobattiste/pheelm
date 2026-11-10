import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { getFilm } from "@/lib/data";
import { safeAbout } from "@/lib/feedback";

export const metadata: Metadata = publicPageMetadata("/feedback");

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ topic?: string; film?: string; about?: string; label?: string }> }) {
  const sp = await searchParams;
  const film = !sp.about && sp.film ? await getFilm(sp.film) : null;
  const page = safeAbout(sp.about) ?? (film ? `/films/${film.slug}` : null);
  const about = page ? { page, title: (sp.label || film?.title || page).slice(0, 200) } : undefined;
  return (
    <article className="page full-width info-page enquiry-page">
      <header className="page-head">
        <h1>Feedback</h1>
        <p className="lead">Help improve Pheelm. Report something that isn&rsquo;t working, suggest an improvement or correct information about a film or person.</p>
      </header>
      <ContactForm feedback topic={sp.topic === "correction" ? "correction" : "feedback"} about={about} />
      <p className="muted info-note">For general enquiries, press or privacy requests, <Link href="/contact">contact us</Link>. To add a missing film, <Link href="/submit">suggest a film</Link>.</p>
    </article>
  );
}
