import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import AdminBrowserToolbar from "../../AdminBrowserToolbar";
import ConfirmButton from "../../ConfirmButton";
import { Empty, PageHeader, Pager, Panel, Pill, Row, ViewTabs, dayTime, pageNumber, plural } from "../../ui";
import { removeComment } from "../actions";
import { commentPlace } from "@/lib/comments";

const SIZE = 40;
type Comment = {
  id: string; body: string; list_id: string | null; film_id: string | null; user_id: string; created_at: string; edited_at: string | null; spoiler: boolean;
  lists: { title: string } | null; films: { title: string; slug: string } | null;
};
type Where = "all" | "films" | "watchlists";

/** Every comment on every film and watchlist, newest first, so anything can be removed without waiting for a report. */
export default async function AdminComments({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; where?: string }> }) {
  const { db } = await requireAdmin("/admin/community/comments");
  const sp = await searchParams;
  const page = pageNumber(sp.page, 5000);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const where: Where = sp.where === "films" || sp.where === "watchlists" ? sp.where : "all";
  let query = db.from("list_comments").select("id, body, list_id, film_id, user_id, created_at, edited_at, spoiler, lists(title), films(title, slug)", { count: "exact" })
    .is("removed_at", null).order("created_at", { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  if (q) query = query.ilike("body", `%${q.replace(/[%_]/g, "")}%`);
  if (where === "films") query = query.not("film_id", "is", null);
  if (where === "watchlists") query = query.not("list_id", "is", null);
  const { data, count, error } = await query;
  const comments = (data ?? []) as unknown as Comment[];
  const authors = [...new Set(comments.map((c) => c.user_id))];
  const { data: people } = authors.length ? await db.from("member_profiles").select("id, handle").in("id", authors) : { data: [] as { id: string; handle: string }[] };
  const handle = new Map((people ?? []).map((p) => [p.id, p.handle]));
  const link = (params: { where?: Where; page?: number }) => `/admin/community/comments?${new URLSearchParams({
    ...(q ? { q } : {}), ...((params.where ?? where) !== "all" ? { where: params.where ?? where } : {}), ...((params.page ?? 1) > 1 ? { page: String(params.page) } : {}),
  })}`;
  const here = link({ page });

  return (
    <>
      <PageHeader back={{ href: "/admin/community/watchlists", label: "Watchlists" }} title="Comments" description="Every comment on films and watchlists, newest first. Removing one replaces it with “Comment removed” if it has replies, and deletes it otherwise." />
      <AdminBrowserToolbar action="/admin/community/comments" query={q} placeholder="Search comments" />
      <ViewTabs label="Where" items={[
        { label: "All", href: link({ where: "all" }), active: where === "all" },
        { label: "Films", href: link({ where: "films" }), active: where === "films" },
        { label: "Watchlists", href: link({ where: "watchlists" }), active: where === "watchlists" },
      ]} />
      {error ? <p className="notice error">Comments couldn&apos;t load. Try again in a moment.</p> : (
        <>
          <p className="muted">{plural(count ?? 0, "comment")}{q ? " match" : ""}.</p>
          {comments.length ? (
            <Panel>
              {comments.map((c) => {
                const place = commentPlace(c);
                return (
                <Row key={c.id}
                  detail={<>
                    <Pill>{place.kind}</Pill>{" "}
                    <Link href={`/admin/members/${c.user_id}`}>{handle.get(c.user_id) ? `@${handle.get(c.user_id)}` : "A member"}</Link>
                    {" on "}<Link href={place.href}>{place.title}</Link>
                    {" · "}{dayTime(c.created_at)}{c.edited_at ? " · edited" : ""}{c.spoiler ? " · spoiler" : ""}
                  </>}
                  aside={<form action={removeComment}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value={here} /><ConfirmButton confirm="Remove?">Remove</ConfirmButton></form>}>
                  {c.body}
                </Row>
                );
              })}
            </Panel>
          ) : <Empty title={q ? "No comments match" : "No comments yet"} />}
          <Pager page={page} total={count ?? 0} size={SIZE} href={(p) => link({ page: p })} />
        </>
      )}
    </>
  );
}
