import { PAGE_COPY } from "@/lib/site";
import Link from "next/link";

export function Submissions({ rows }: { rows: { id: string; title: string; director: string; year: number | null; status: string }[] }) {
  return (
    <>
      <p className="lead submissions-intro">{PAGE_COPY.submissions}</p>
      {rows.length ? (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Film</th><th>Director</th><th>Year</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.title}</td>
                  <td>{s.director}</td>
                  <td>{s.year ?? ""}</td>
                  <td><span className={`status-pill ${s.status}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">You haven&rsquo;t suggested any films yet.</p>
      )}
      <p style={{ marginTop: 24 }}>
        <Link className="button" href="/submit">Submit a film</Link>
      </p>
    </>
  );
}
