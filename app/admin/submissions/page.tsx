import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { reviewSubmission } from "../actions";
import SubmitButton from "../SubmitButton";
import { Empty, Facts, PageHeader, Pager, Panel, Pill, ViewTabs, day, pageNumber } from "../ui";

const SIZE = 20;
const STATUSES = [{ id: "pending", label: "To review" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }] as const;
// What filmmakers fill in on "Submit your film", in the order it's worth reading.
const DETAIL_LABELS: [string, string][] = [
  ["submitted_by", "Submitted by"], ["role", "Their role"], ["email", "Contact email"], ["type", "Type"], ["original_title", "Original title"],
  ["aka", "Also known as"], ["runtime", "Runtime (minutes)"], ["countries", "Countries"], ["languages", "Languages"], ["genres", "Genres"],
  ["synopsis", "Synopsis"], ["credits", "Credits"], ["awards", "Awards"], ["watch", "Where to watch"],
  ["poster", "Poster"], ["backdrop", "Backdrop"], ["trailer", "Trailer"], ["website", "Website"], ["note", "Note"],
];
type Submission = {
  id: string; user_id: string | null; title: string; director: string | null; year: number | null; link: string | null; note: string | null;
  status: string; film_id: string | null; created_at: string; reviewed_at: string | null; review_note: string | null; kind: string | null;
  details: Record<string, unknown> | null;
};
const canon = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isLink = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//i.test(v);

/** Films members suggest or submit as their own. Approving makes a draft to check before publishing; the submitter is emailed either way. */
export default async function AdminSubmissions({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { db } = await requireAdmin("/admin/submissions");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s.id === sp.status)?.id ?? "pending";
  const page = pageNumber(sp.page, 2000);
  const [{ data, count, error }, ...counts] = await Promise.all([
    db.from("submissions").select("*", { count: "exact" }).eq("status", status).order("created_at", { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1),
    ...STATUSES.map((s) => db.from("submissions").select("id", { count: "exact", head: true }).eq("status", s.id)),
  ]);
  const submissions = (data ?? []) as Submission[];
  // Possible duplicates: same title (ignoring accents and punctuation) and year, already in the catalog.
  const titles = [...new Set(submissions.map((s) => s.title))];
  const { data: known } = titles.length ? await db.from("films").select("id,title,year").or(titles.map((t) => `title.ilike."${t.replace(/["\\%_*]/g, "")}"`).join(",")) : { data: [] };
  const matches = new Map((known ?? []).map((f) => [`${canon(f.title)}|${f.year}`, f.id]));
  const members = [...new Set(submissions.map((s) => s.user_id).filter((v): v is string => !!v))];
  const { data: people } = members.length ? await db.from("member_profiles").select("id, handle").in("id", members) : { data: [] as { id: string; handle: string }[] };
  const handle = new Map((people ?? []).map((p) => [p.id, p.handle]));

  return (
    <>
      <PageHeader title="Submissions" description="Films members suggest, or submit as their own. Approving creates a draft you check before publishing. The member is emailed when you approve or reject." />
      <ViewTabs label="Submissions by status" items={STATUSES.map((s, i) => ({ label: s.label, href: `/admin/submissions?status=${s.id}`, active: s.id === status, count: counts[i].count ?? 0 }))} />
      {error ? <p className="notice error">Submissions couldn&apos;t load. Try again in a moment.</p> : submissions.length ? submissions.map((s) => {
        const match = matches.get(`${canon(s.title)}|${s.year}`);
        const details = DETAIL_LABELS.map(([key, label]) => [label, s.details?.[key]] as const).filter(([, v]) => v !== null && v !== undefined && v !== "");
        return (
          <Panel key={s.id} title={`${s.title}${s.year ? ` (${s.year})` : ""}`} actions={s.kind === "own" ? <Pill tone="info">Their own film</Pill> : <Pill>Suggestion</Pill>}>
            <Facts items={[
              ["Director", s.director],
              ["From", s.user_id ? <Link key="m" href={`/admin/members/${s.user_id}`}>{handle.get(s.user_id) ? `@${handle.get(s.user_id)}` : "A member"}</Link> : null],
              ["Sent", day(s.created_at)],
              ["Link", isLink(s.link) ? <a key="l" href={s.link} target="_blank" rel="noopener noreferrer">{s.link.replace(/^https?:\/\//, "").slice(0, 60)}</a> : null],
              ["Reviewed", s.reviewed_at ? day(s.reviewed_at) : null],
            ]} />
            {match && <p className="notice error">This may already be on Pheelm. <Link href={`/admin/films/${match}`}>Check the existing film</Link> before approving.</p>}
            {s.kind !== "own" && s.note && <p className="admin-message-body">{s.note}</p>}
            {details.length > 0 && (
              <details><summary>Everything they sent</summary>
                <Facts items={details.map(([label, v]) => [label, isLink(v) ? <a key={label} href={v} target="_blank" rel="noopener noreferrer">{v}</a> : String(v)])} />
              </details>
            )}
            {status === "pending" ? (
              <form action={reviewSubmission} className="form">
                <input type="hidden" name="id" value={s.id} />
                <label className="field">Note to the team <span className="field-hint">Optional. Only admins see it.</span><textarea name="review_note" rows={2} maxLength={1500} defaultValue={s.review_note ?? ""} /></label>
                <div className="actions">
                  <SubmitButton name="decision" value="approve" pendingLabel="Working…">Approve and create draft</SubmitButton>
                  <SubmitButton className="button ghost small" name="decision" value="reject" pendingLabel="Reject">Reject</SubmitButton>
                </div>
              </form>
            ) : (
              <div className="actions">
                {s.film_id && <Link className="button ghost small" href={`/admin/films/${s.film_id}`}>Open the film</Link>}
                {s.review_note && <p className="muted">Note: {s.review_note}</p>}
              </div>
            )}
          </Panel>
        );
      }) : <Empty title={status === "pending" ? "Nothing to review" : `Nothing ${STATUSES.find((x) => x.id === status)!.label.toLowerCase()} yet`}>{status === "pending" ? "New submissions appear here." : null}</Empty>}
      <Pager page={page} total={count ?? 0} size={SIZE} href={(p) => `/admin/submissions?status=${status}&page=${p}`} />
    </>
  );
}
