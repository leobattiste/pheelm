import type { Metadata } from "next";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import SubmitForm from "./SubmitForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Submit a film" };

export default async function SubmitPage() {
  const db = await getServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;

  return (
    <section className="panel">
      <h1>Submit a film</h1>
      <p className="lead">
        Know a film by a Black director that belongs here? Features, documentaries, shorts and animation from any country are welcome.
        We review every suggestion before adding it.
      </p>
      {!db ? (
        <p className="notice">Submissions aren&rsquo;t open yet. Check back soon.</p>
      ) : user ? (
        <SubmitForm />
      ) : (
        <p>
          <Link className="button" href="/login?next=/submit">Sign in to submit</Link>
        </p>
      )}
    </section>
  );
}
