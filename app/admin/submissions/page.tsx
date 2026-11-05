import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { reviewSubmission } from "../actions";

export default async function AdminSubmissions({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireAdmin();
  const status = (await searchParams).status ?? "pending";
  const { data } = await db.from("submissions").select("*").eq("status", status).order("created_at", { ascending: false });

  return (
    <>
      <div className="admin-head"><h1>Submissions</h1></div>
      <div className="actions">
        {["pending", "approved", "rejected"].map((s) => (
          <Link key={s} className="button ghost small" aria-pressed={s === status} href={`/admin/submissions?status=${s}`}>{s[0].toUpperCase() + s.slice(1)}</Link>
        ))}
      </div>
      <p className="muted">Approving creates a draft film (filled from TMDB when that&rsquo;s switched on) and opens it so you can check it before publishing.</p>
      {data?.length ? (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Film</th><th>Director</th><th>Year</th><th>Link</th><th>Note</th><th>Sent</th><th /></tr></thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.title}</strong></td>
                  <td>{s.director}</td>
                  <td>{s.year ?? ""}</td>
                  <td>{s.link && <a href={s.link} target="_blank" rel="noopener noreferrer">Open</a>}</td>
                  <td style={{ maxWidth: 320 }}>{s.note}</td>
                  <td>{new Date(s.created_at).toLocaleDateString("en-GB")}</td>
                  <td>
                    {status === "pending" && (
                      <form action={reviewSubmission} className="actions">
                        <input type="hidden" name="id" value={s.id} />
                        <button className="button small" name="decision" value="approve">Approve</button>
                        <button className="button ghost small" name="decision" value="reject">Reject</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">Nothing {status}.</p>
      )}
    </>
  );
}
