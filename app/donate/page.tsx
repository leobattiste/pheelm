import type { Metadata } from "next";
import Link from "next/link";
import { feedbackHref } from "@/lib/feedback";
import { DONATE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Donate", description: "Support Pheelm, an independent directory of films by Black directors." };

export default function DonatePage() {
  return (
    <article className="page narrow info-page">
      <header className="page-head">
        <h1>Support Pheelm</h1>
        <p className="lead">
          Pheelm is independent and free to use. Donations pay for hosting and for the time it takes to
          research, verify and write about every film.
        </p>
      </header>
      {DONATE_URL ? (
        <div className="actions">
          <a className="button" href={DONATE_URL} target="_blank" rel="noopener noreferrer">Donate</a>
        </div>
      ) : (
        <p className="muted info-note">
          Donations open soon. In the meantime, you can help by <Link href="/submit">suggesting a film</Link> we&rsquo;re
          missing or <Link href={feedbackHref("/donate", "Donate")}>telling us what you think</Link>.
        </p>
      )}
    </article>
  );
}
