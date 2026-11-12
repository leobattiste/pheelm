import Link from "next/link";
import { commentPlace } from "@/lib/comments";
import { requireAdmin } from "@/lib/admin";
import { removeReportedComment, resolveCommentReport, resolveReport, setListFlag } from "../actions";
import ConfirmButton from "../ConfirmButton";
import SubmitButton from "../SubmitButton";
import { Empty, PageHeader, Panel, Row, dayTime } from "../ui";

type ListReport = { id: string; list_id: string; reason: string; created_at: string; lists: { title: string; hidden: boolean } | null };
type CommentReport = { id: string; created_at: string; reason: string | null; comment_id: string; list_comments: { id: string; body: string; list_id: string | null; film_id: string | null; removed_at: string | null; lists: { title: string } | null; films: { title: string; slug: string } | null } | null };

/** Reports from members about watchlists and comments, to act on or dismiss. */
export default async function AdminReports() {
  const { db } = await requireAdmin("/admin/community");
  const [lists, comments] = await Promise.all([
    db.from("list_reports").select("id, list_id, reason, created_at, lists(title, hidden)").eq("resolved", false).order("created_at", { ascending: false }),
    db.from("comment_reports").select("id, created_at, reason, comment_id, list_comments(id, body, list_id, film_id, removed_at, lists(title), films(title, slug))").eq("resolved", false).order("created_at", { ascending: false }),
  ]);
  const listReports = (lists.data ?? []) as unknown as ListReport[];
  const commentReports = ((comments.data ?? []) as unknown as CommentReport[]).filter((r) => r.list_comments && !r.list_comments.removed_at);
  const dismiss = (action: (f: FormData) => Promise<void>, id: string) => (
    <form action={action}><input type="hidden" name="id" value={id} /><SubmitButton className="button ghost small" pendingLabel="Dismissing…">Dismiss</SubmitButton></form>
  );

  return (
    <>
      <PageHeader title="Reports" description="What members reported. Act on it, or dismiss it if nothing is wrong. Dismissing doesn't tell the person who reported it." />
      {lists.error ? <p className="notice error">Reports couldn&apos;t load. Try again in a moment.</p> : (
        <Panel title={`Watchlists (${listReports.length})`} icon="stack">
          {listReports.length ? listReports.map((r) => (
            <Row key={r.id} detail={`“${r.reason}” · ${dayTime(r.created_at)}`} aside={<>
              {!r.lists?.hidden && (
                <form action={setListFlag}><input type="hidden" name="id" value={r.list_id} /><input type="hidden" name="field" value="hidden" /><input type="hidden" name="value" value="true" />
                  <SubmitButton className="button small" pendingLabel="Hiding…">Hide watchlist</SubmitButton></form>
              )}
              {dismiss(resolveReport, r.id)}
            </>}>
              <Link href={`/c/${r.list_id}`}>{r.lists?.title ?? "A watchlist"}</Link>{r.lists?.hidden ? " (hidden)" : ""}
            </Row>
          )) : <Empty title="No watchlist reports" />}
        </Panel>
      )}
      {!comments.error && (
        <Panel title={`Comments (${commentReports.length})`} icon="comment">
          {commentReports.length ? commentReports.map((r) => (
            <Row key={r.id} detail={<>On <Link href={commentPlace(r.list_comments!).href}>{commentPlace(r.list_comments!).title}</Link>{r.reason ? ` · “${r.reason}”` : ""} · {dayTime(r.created_at)}</>}
              aside={<>
                <form action={removeReportedComment}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="comment_id" value={r.comment_id} /><ConfirmButton className="button small danger" confirm="Remove?">Remove comment</ConfirmButton></form>
                {dismiss(resolveCommentReport, r.id)}
              </>}>
              “{r.list_comments!.body}”
            </Row>
          )) : <Empty title="No comment reports" />}
        </Panel>
      )}
    </>
  );
}
