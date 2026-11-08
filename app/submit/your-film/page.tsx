import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import OwnFilmForm from "./OwnFilmForm";
import SubmissionNav from "@/components/SubmissionNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Submit your film", description: PAGE_COPY.submitOwn };

/** For filmmakers: submit your own film, with everything its page on Pheelm would show. */
export default async function SubmitOwnFilmPage() {
  const db = await getServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;

  return (
    <section className="page narrow suggestion-page own-film-page">
      <header className="page-head">
        <h1>Suggest a film</h1>
        <p className="lead">{PAGE_COPY.submit}</p>
      </header>
      <SubmissionNav owner />
      <p className="muted submission-intro">{PAGE_COPY.submitOwn}</p>
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
