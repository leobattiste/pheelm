import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { CONTACT_EMAIL } from "@/lib/site";
import { getFilm } from "@/lib/data";
import { safeAbout } from "@/lib/feedback";

export const metadata: Metadata = { title: "Contact", description: "Questions, corrections, press and privacy requests." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; film?: string; about?: string; label?: string }> }) {
  const sp = await searchParams;
  const { topic } = sp;
  // Feedback says what it's about: a page or part of one (?about=&label=), or a film (older ?film= links).
  const film = !sp.about && sp.film ? await getFilm(sp.film) : null;
  const aboutPath = safeAbout(sp.about) ?? (film ? `/films/${film.slug}` : null);
  const about = aboutPath ? { page: aboutPath, title: (sp.label || film?.title || aboutPath).slice(0, 200) } : undefined;
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
      <ContactForm topic={topic} about={about} />
    </article>
  );
}
