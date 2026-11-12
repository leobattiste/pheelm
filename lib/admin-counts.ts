import type { SupabaseClient } from "@supabase/supabase-js";

/** What's waiting for an admin, for the nav badges and the Overview. Each count is 0 when its table isn't set up. */
export type AdminCounts = { inbox: number; reports: number; submissions: number };

export async function adminCounts(db: SupabaseClient): Promise<AdminCounts> {
  const count = async (table: string, filter: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count, error } = await filter(db.from(table).select("id", { count: "exact", head: true }));
    return error ? 0 : count ?? 0;
  };
  const [inbox, listReports, commentReports, submissions] = await Promise.all([
    count("messages", (q) => q.eq("handled", false)),
    count("list_reports", (q) => q.eq("resolved", false)),
    count("comment_reports", (q) => q.eq("resolved", false)),
    count("submissions", (q) => q.eq("status", "pending")),
  ]);
  return { inbox, reports: listReports + commentReports, submissions };
}
