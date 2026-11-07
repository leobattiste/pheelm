import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { tmdbEnabled } from "@/lib/tmdb";
import BulkImport from "../BulkImport";
import PeopleFill from "../PeopleFill";
import WatchRefresh from "../WatchRefresh";

export default async function AutomationPage() {
  const { db } = await requireAdmin("/admin/automation");
  const [{ data: posters, count: missingPosters }, { data: synopses, count: missingSynopses }, { count: peopleWaiting }] = await Promise.all([
    db.from("films").select("id,title", { count: "exact" }).or("poster_url.is.null,poster_url.eq.").order("year").limit(200),
    db.from("films").select("id,title", { count: "exact" }).or("synopsis.is.null,synopsis.eq.").not("tmdb_id", "is", null).order("year").limit(200),
    db.from("people").select("id", { count: "exact", head: true }).not("tmdb_id", "is", null).is("details_at", null),
  ]);
  return (
    <div className="account-panel">
      <div className="admin-head"><div><h2 className="admin-section-heading">Automation</h2><p className="muted">Run data enrichment in manageable batches. Review all results before publishing.</p></div>
        <Link className="button ghost small" href="/admin/quality">Content quality</Link>
      </div>
      {!tmdbEnabled && <p className="notice error">TMDB imports are unavailable. Configure TMDB_API_KEY in Vercel first.</p>}
      <section className="account-section">
        <h2>Fill missing posters</h2>
        <p className="muted">{missingPosters ?? 0} films need a poster. Each import only fills empty metadata fields.</p>
        {tmdbEnabled && <BulkImport films={posters ?? []} label="poster" />}
        {(missingPosters ?? 0) > 200 && <p className="muted">Showing the first 200. Reload after this batch to continue.</p>}
      </section>
      <section className="account-section">
        <h2>Fill missing synopses</h2>
        <p className="muted">{missingSynopses ?? 0} TMDB-linked films have no synopsis. Existing editorial text is preserved.</p>
        {tmdbEnabled && <BulkImport films={synopses ?? []} label="synopsis" />}
        {(missingSynopses ?? 0) > 200 && <p className="muted">Showing the first 200. Reload after this batch to continue.</p>}
      </section>
      <section className="account-section">
        <h2>People metadata</h2>
        <PeopleFill waiting={peopleWaiting ?? 0} />
      </section>
      <section className="account-section">
        <h2>Where to watch</h2>
        <WatchRefresh />
      </section>
      <p className="muted">Automated results can contain errors or incorrect matches. Verify director attribution, artwork rights and written details in the editors.</p>
    </div>
  );
}
