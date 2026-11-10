import { publicPageMetadata } from "@/lib/seo";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import OwnFilmForm from "./OwnFilmForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = publicPageMetadata("/submit/your-film");

/** For filmmakers: submit your own film, with everything its page on Pheelm would show. */
export default async function SubmitOwnFilmPage() {
  const db = await getServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;

  return (
    <section className="page full-width suggestion-page own-film-page">
      <header className="page-head">
        <h1>Submit your film</h1>
        <p className="lead">{PAGE_COPY.submitOwn}</p>
      </header>
      <p className="muted submission-intro">Want to recommend someone else&rsquo;s film? <Link href="/submit">Suggest a film</Link>.</p>
      {!db ? (
        <p className="notice">Submissions aren&rsquo;t open yet. Check back soon.</p>
      ) : user ? (
        <OwnFilmForm email={user.email ?? ""} />
      ) : (
        <p>
          <Link className="button" href="/login?next=/submit/your-film">Sign in to submit your film</Link>
        </p>
      )}
    </section>
  );
}
