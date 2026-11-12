import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Empty, PageHeader, Pager, Panel, Pill, Row, dayTime, pageNumber, plural } from "../../ui";

const SIZE = 50;
const FIELD: Record<string, string> = { comment: "Comment", bio: "Bio", watchlist_description: "Watchlist description" };
type Refusal = { id: number; actor_id: string | null; handle: string | null; field: string; excerpt: string; reason: string; created_at: string; total: number };

/** Text the content check refused, kept for 90 days, so you can see what's being blocked and spot repeat attempts. */
export default async function ModerationLog({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { db } = await requireAdmin("/admin/community/moderation");
  const page = pageNumber((await searchParams).page, 2000);
  const { data, error } = await db.rpc("admin_moderation_log", { page_size: SIZE, page_offset: (page - 1) * SIZE });
  const rows = (data ?? []) as Refusal[];
  const total = rows[0]?.total ?? 0;

  return (
    <>
      <PageHeader title="Refused text" description="Comments, bios and watchlist descriptions the content check stopped before they were posted. Kept for 90 days. Nothing here was published." />
      {error ? <p className="notice error">The log couldn&apos;t load. If this keeps happening, run <code>supabase/admin-community.sql</code> in Supabase.</p> : rows.length ? (
        <>
          <p className="muted">{plural(total, "refusal")} in the last 90 days.</p>
          <Panel>
            {rows.map((r) => (
              <Row key={r.id}
                detail={<>{r.actor_id ? <Link href={`/admin/members/${r.actor_id}`}>{r.handle ? `@${r.handle}` : "A member"}</Link> : "Deleted account"} · {FIELD[r.field] ?? r.field} · {dayTime(r.created_at)}</>}
                aside={<Pill tone="danger">{r.reason}</Pill>}>
                {r.excerpt}
              </Row>
            ))}
          </Panel>
          <Pager page={page} total={total} size={SIZE} href={(p) => `/admin/community/moderation?page=${p}`} />
        </>
      ) : <Empty title="Nothing refused">When the content check stops a comment, bio or description, it appears here.</Empty>}
    </>
  );
}
