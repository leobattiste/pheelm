import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { PageHeader, Panel } from "../ui";
import { tmdbEnabled } from "@/lib/tmdb";
import BulkImport from "../BulkImport";
import PeopleFill from "../PeopleFill";
import WatchRefresh from "../WatchRefresh";
import AwardsRefresh from "../AwardsRefresh";
import CreditsRefresh from "../CreditsRefresh";
import TmdbAwardsCheck from "../TmdbAwardsCheck";

// The batch buttons here run server actions that wait on TMDB and Wikidata.
export const maxDuration = 300;

export default async function AutomationPage() {
  const { db } = await requireAdmin("/admin/automation");
  const [{ data: posters, count: missingPosters }, { data: synopses, count: missingSynopses }, { count: peopleWaiting }] = await Promise.all([
    db.from("films").select("id,title", { count: "exact" }).or("poster_url.is.null,poster_url.eq.").order("year").limit(200),
    db.from("films").select("id,title", { count: "exact" }).or("synopsis.is.null,synopsis.eq.").not("tmdb_id", "is", null).order("year").limit(200),
    db.from("people").select("id", { count: "exact", head: true }).not("tmdb_id", "is", null).is("details_at", null),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/admin/films", label: "Films" }} title="Automation" description="Fill missing details from TMDB in batches. Imports only fill empty fields, so nothing you wrote is overwritten. Check results before publishing."
        actions={<><Link className="button ghost small" href="/admin/quality">Content quality</Link><Link className="button ghost small" href="/admin/searches">Searches with no results</Link></>} />
      {!tmdbEnabled && <p className="notice error">TMDB isn&apos;t connected, so these can&apos;t run. Add TMDB_API_KEY in Vercel.</p>}
      <Panel id="posters" title="Fill missing posters" icon="camera">
        <p className="muted">{missingPosters ?? 0} films need a poster. Each import only fills empty metadata fields.</p>
        {tmdbEnabled && <BulkImport films={posters ?? []} label="poster" />}
        {(missingPosters ?? 0) > 200 && <p className="muted">Showing the first 200. Reload after this batch to continue.</p>}
      </Panel>
      <Panel id="synopses" title="Fill missing synopses" icon="pencil">
        <p className="muted">{missingSynopses ?? 0} TMDB-linked films have no synopsis. Existing editorial text is preserved.</p>
        {tmdbEnabled && <BulkImport films={synopses ?? []} label="synopsis" />}
        {(missingSynopses ?? 0) > 200 && <p className="muted">Showing the first 200. Reload after this batch to continue.</p>}
      </Panel>
      <Panel id="cast-and-crew" title="Add full cast and crew" icon="users2">
        {tmdbEnabled && <CreditsRefresh />}
      </Panel>
      <Panel id="people-details" title="Fill people details" icon="users2">
        <PeopleFill waiting={peopleWaiting ?? 0} />
      </Panel>
      <Panel id="awards" title="Update awards and nominations" icon="laurel">
        <AwardsRefresh />
      </Panel>
      <Panel id="tmdb-awards" title="Check TMDB for awards" icon="laurel">
        {tmdbEnabled && <TmdbAwardsCheck />}
      </Panel>
      <Panel id="where-to-watch" title="Refresh where to watch" icon="play">
        <WatchRefresh />
      </Panel>
      <p className="muted">Automatic matches can be wrong. Check directors, artwork and written details in the editors.</p>
    </>
  );
}
