import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import AdminBrowserToolbar from "../../AdminBrowserToolbar";
import ConfirmButton from "../../ConfirmButton";
import { Empty, PageHeader, Pager, Panel, Row, dayTime, pageNumber, plural } from "../../ui";
import { removeComment } from "../actions";

const SIZE = 40;
type Comment = { id: string; body: string; list_id: string; user_id: string; created_at: string; edited_at: string | null; lists: { title: string } | null };

/** Every comment on every watchlist, newest first, so anything can be removed without waiting for a report. */
export default async function AdminComments({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { db } = await requireAdmin("/admin/community/comments");
  const sp = await searchParams;
  const page = pageNumber(sp.page, 5000);
  const q = (sp.q ?? "").trim().slice(0, 100);
  let query = db.from("list_comments").select("id, body, list_id, user_id, created_at, edited_at, lists(title)", { count: "exact" })
    .is("removed_at", null).order("created_at", { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  if (q) query = query.ilike("body", `%${q.replace(/[%_]/g, "")}%`);
  const { data, count, error } = await query;
  const comments = (data ?? []) as unknown as Comment[];
  const authors = [...new Set(comments.map((c) => c.user_id))];
  const { data: people } = authors.length ? await db.from("member_profiles").select("id, handle").in("id", authors) : { data: [] as { id: string; handle: string }[] };
  const handle = new Map((people ?? []).map((p) => [p.id, p.handle]));
  const here = `/admin/community/comments?${new URLSearchParams({ q, page: String(page) })}`;

  return (
    <>
      <PageHeader title="Comments" description="Every comment on watchlists, newest first. Removing one replaces it with “Comment removed” if it has replies, and deletes it otherwise." />
      <AdminBrowserToolbar action="/admin/community/comments" query={q} placeholder="Search comments" />
      {error ? <p className="notice error">Comments couldn&apos;t load. Try again in a moment.</p> : (
        <>
          <p className="muted">{plural(count ?? 0, "comment")}{q ? " match" : ""}.</p>
          {comments.length ? (
            <Panel>
              {comments.map((c) => (
                <Row key={c.id}
                  detail={<>
                    <Link href={`/admin/members/${c.user_id}`}>{handle.get(c.user_id) ? `@${handle.get(c.user_id)}` : "A member"}</Link>
                    {" on "}<Link href={`/c/${c.list_id}#comment-${c.id}`}>{c.lists?.title ?? "a watchlist"}</Link>
                    {" · "}{dayTime(c.created_at)}{c.edited_at ? " · edited" : ""}
                  </>}
                  aside={<form action={removeComment}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value={here} /><ConfirmButton confirm="Remove?">Remove</ConfirmButton></form>}>
                  {c.body}
                </Row>
              ))}
            </Panel>
          ) : <Empty title={q ? "No comments match" : "No comments yet"} />}
          <Pager page={page} total={count ?? 0} size={SIZE} href={(p) => `/admin/community/comments?${new URLSearchParams({ q, page: String(p) })}`} />
        </>
      )}
    </>
  );
}
