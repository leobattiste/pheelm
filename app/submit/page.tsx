import { publicPageMetadata } from "@/lib/seo";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import SubmitForm from "./SubmitForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = publicPageMetadata("/submit");

/** Fan suggestions, with a separate route for filmmakers submitting their own work. */
export default async function SubmitPage() {
  const db = await getServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;

  return (
    <section className="page full-width suggestion-page">
      <header className="page-head">
        <h1>Suggest a film</h1>
        <p className="lead">{PAGE_COPY.submit}</p>
      </header>
      <p className="muted submission-intro">If you&rsquo;re a filmmaker, <Link href="/submit/your-film">submit your own film</Link>.</p>
      {!db ? (
        <p className="notice">Suggestions aren&rsquo;t open yet. Check back soon.</p>
      ) : user ? (
        <SubmitForm />
      ) : (
        <p>
          <Link className="button" href="/login?next=/submit">Sign in to suggest a film</Link>
        </p>
      )}
    </section>
  );
}
