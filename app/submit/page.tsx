import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { Submissions } from "../account/sections";
import SubmitForm from "./SubmitForm";
import SubmissionNav from "@/components/SubmissionNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suggest a film", description: PAGE_COPY.submit };

/** Suggest a film we're missing, with the films you've already suggested below. */
export default async function SubmitPage() {
  const db = await getServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const mine = db && user
    ? (await db.from("submissions").select("id, title, director, year, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false })).data ?? []
    : [];

  return (
    <>
      <section className="page narrow suggestion-page">
        <header className="page-head">
          <h1>Suggest a film</h1>
          <p className="lead">{PAGE_COPY.submit}</p>
        </header>
        <SubmissionNav />
        <p className="muted submission-intro">For fans: tell us which film is missing and share a link. We&rsquo;ll research the details before adding it.</p>
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
      {mine.length > 0 && (
        <section className="page narrow your-suggestions" aria-labelledby="mine-h">
          <h2 id="mine-h">Your suggestions</h2>
          <Submissions rows={mine} />
        </section>
      )}
    </>
  );
}
