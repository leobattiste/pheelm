import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { setAdmin } from "../actions";

type Row = {
  id: string; handle: string | null; display_name: string | null; email: string | null; created_at: string; last_seen: string | null;
  is_admin: boolean; is_owner: boolean; is_private: boolean; lists: number; saved: number; comments: number;
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never");

/**
 * Everyone who has signed up: when they joined and last signed in, and what they've made. The
 * owner also sees emails and makes or removes admins.
 */
export default async function AdminMembers() {
  const { db, owner } = await requireAdmin("/admin/members");
  const { data, error } = await db.rpc("admin_members");
  if (error) {
    return (
      <>
        <div className="admin-head"><h1>Members</h1></div>
        <p className="notice">To see members, run <code>supabase/admins-watched-blocks.sql</code> in Supabase.</p>
      </>
    );
  }
  const rows = (data ?? []) as Row[];
  const admins = rows.filter((r) => r.is_admin).length;
  const week = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400000).length;

  return (
    <>
      <div className="admin-head"><h1>Members</h1></div>
      <p className="muted">
        {rows.length} {rows.length === 1 ? "member" : "members"}, {week} new this week, {admins} {admins === 1 ? "admin" : "admins"}.
        {owner
          ? " Admins add and edit films and people, review submissions, moderate the community and read the inbox. Only you can make admins, delete films and download the newsletter list."
          : " Only the owner can make admins."}
      </p>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Member</th>{owner && <th>Email</th>}<th>Joined</th><th>Last signed in</th><th>Collections</th><th>Saved</th><th>Comments</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.handle ? <Link href={`/@${r.handle}`}>@{r.handle}</Link> : <span className="muted">{r.display_name || "No profile yet"}</span>}
                  {r.is_owner ? <span className="status-pill">Owner</span> : r.is_admin ? <span className="status-pill">Admin</span> : null}
                  {r.is_private && <span className="status-pill">Private</span>}
                </td>
                {owner && <td>{r.email ?? ""}</td>}
                <td>{day(r.created_at)}</td>
                <td>{day(r.last_seen)}</td>
                <td>{r.lists}</td>
                <td>{r.saved}</td>
                <td>{r.comments}</td>
                <td>
                  {owner && !r.is_owner && (
                    <form action={setAdmin}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="make" value={r.is_admin ? "false" : "true"} />
                      <button className="button ghost small" type="submit">{r.is_admin ? "Remove admin" : "Make admin"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
