import type { SupabaseClient } from "@supabase/supabase-js";
import { BOXES, type InboxBox } from "./inbox";

/** What's waiting for an admin, for the nav badges and the Overview. Each count is 0 when its table isn't set up. */
export type AdminCounts = { inbox: number; reports: number; submissions: number } & Record<InboxBox, number>;

export async function adminCounts(db: SupabaseClient): Promise<AdminCounts> {
  const count = async (table: string, filter: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count, error } = await filter(db.from(table).select("id", { count: "exact", head: true }));
    return error ? 0 : count ?? 0;
  };
  // Unanswered messages by topic, in one query.
  const open = await db.from("messages").select("topic").eq("handled", false).limit(1000);
  const topics = (open.data ?? []) as { topic: string }[];
  const boxes = Object.fromEntries(BOXES.map((b) => [b.id, topics.filter((t) => b.topics.includes(t.topic)).length])) as Record<InboxBox, number>;
  const [listReports, commentReports, submissions] = await Promise.all([
    count("list_reports", (q) => q.eq("resolved", false)),
    count("comment_reports", (q) => q.eq("resolved", false)),
    count("submissions", (q) => q.eq("status", "pending")),
  ]);
  return { inbox: topics.length, ...boxes, reports: listReports + commentReports, submissions };
}
