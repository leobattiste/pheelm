import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { tmdbEnabled } from "@/lib/tmdb";
import { JOBS, JOB_KINDS, type Job, type JobKind } from "@/lib/jobs";
import { DataTable } from "../DataTable";
import { PageHeader, Panel, Pill, ago } from "../ui";
import TmdbAwardsCheck from "../TmdbAwardsCheck";
import AdminMenu from "../AdminMenu";
import { JobButton, JobsRefresher } from "./JobControls";

// Start runs the first batches right after answering; give it room.
export const maxDuration = 300;

const n = (value: number) => value.toLocaleString("en-US");

/**
 * Jobs: each automation is one row: what's left to do, how the last run went, and Start or Stop.
 * A started job runs on the server, so it carries on with this page closed.
 */
export default async function AutomationPage() {
  const { db } = await requireAdmin("/admin/automation");
  const [jobs, ...remaining] = await Promise.all([
    db.from("admin_jobs").select("*").order("started_at", { ascending: false }).limit(60),
    ...JOB_KINDS.map((kind) => JOBS[kind].remaining(db).catch(() => 0)),
  ]);
  const ready = !jobs.error;
  const latest = new Map<JobKind, Job>();
  for (const j of (jobs.data ?? []) as Job[]) if (!latest.has(j.kind)) latest.set(j.kind, j);
  const left = new Map(JOB_KINDS.map((kind, i) => [kind, remaining[i] as number]));
  const anyRunning = [...latest.values()].some((j) => j.status === "running");

  return (
    <>
      <PageHeader back={{ href: "/admin/films", label: "Films" }} title="Automation"
        description="Jobs run on the server and keep going with this page closed. They only fill empty fields, so nothing you wrote is overwritten."
        actions={<AdminMenu><Link href="/admin/quality">Content quality</Link><Link href="/admin/searches">Searches with no results</Link></AdminMenu>} />
      {!tmdbEnabled && <p className="notice error">TMDB isn&apos;t connected, so most jobs can&apos;t run. Add TMDB_API_KEY in Vercel.</p>}
      {!ready && <p className="notice error">Jobs need a database update (admin_jobs) before they can run.</p>}
      {anyRunning && <JobsRefresher />}

      <DataTable label="Jobs"
        columns={[
          { key: "job", label: "Job" },
          { key: "todo", label: "To check", align: "end", width: "100px" },
          { key: "last", label: "Last run", phone: true, width: "260px" },
          { key: "action", label: "", align: "end", phone: true, width: "110px" },
        ]}
        rows={JOB_KINDS.map((kind) => {
          const def = JOBS[kind];
          const job = latest.get(kind);
          const running = job?.status === "running";
          const pct = running && job.total ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;
          const blocked = !ready || (def.tmdb && !tmdbEnabled);
          return {
            id: kind,
            cells: {
              job: (
                <div className="admin-cell-text" id={kind === "credits" ? "cast-and-crew" : kind === "watch" ? "where-to-watch" : kind === "people" ? "people-details" : kind}>
                  <span className="admin-cell-title">{def.label}</span>
                  <span className="admin-cell-detail admin-job-summary">{def.summary}</span>
                </div>
              ),
              todo: <span className="admin-num">{n(left.get(kind) ?? 0)}</span>,
              last: running ? (
                <div className="admin-job-progress">
                  <span><Pill tone="info">Running</Pill> {n(job.processed)} of {n(job.total)} · {n(job.changed)} {def.unit}</span>
                  <span className="admin-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${def.label} progress`}><span style={{ width: `${pct}%` }} /></span>
                </div>
              ) : job ? (
                <div className="admin-job-progress">
                  <span>
                    {job.status === "done" ? <Pill tone="ok">Done</Pill> : job.status === "failed" ? <Pill tone="danger">Couldn&apos;t finish</Pill> : <Pill>Stopped</Pill>}{" "}
                    <span className="muted">{ago(job.finished_at ?? job.updated_at)} · {n(job.changed)} {def.unit}{job.failed ? ` · ${n(job.failed)} failed` : ""}</span>
                  </span>
                  {job.status === "failed" && job.last_error && <span className="admin-cell-detail admin-job-error" title={job.last_error}>{job.last_error}</span>}
                </div>
              ) : <span className="muted">Never run</span>,
              action: <JobButton kind={kind} jobId={running ? job.id : null} disabled={blocked} />,
            },
          };
        })} />

      <Panel id="tmdb-awards" title="Check TMDB for awards" icon="laurel">
        {tmdbEnabled ? <TmdbAwardsCheck /> : <p className="muted">Needs TMDB.</p>}
      </Panel>
      <p className="muted">Automatic matches can be wrong. Check directors, artwork and written details in the editors.</p>
    </>
  );
}
