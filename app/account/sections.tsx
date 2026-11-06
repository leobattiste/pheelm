import { PAGE_COPY } from "@/lib/site";
import Link from "next/link";
import DirectorCard from "@/components/DirectorCard";
import type { DirectorSummary } from "@/lib/types";

/** The directors a member follows, on their own profile. */
export function Following({ directors }: { directors: DirectorSummary[] }) {
  if (!directors.length) {
    return (
      <div className="empty-state">
        <p>You&rsquo;re not following anyone yet.</p>
        <p className="muted">Press <strong>Follow</strong> on a director&rsquo;s page to keep them here.</p>
        <Link className="button ghost small" href="/directors">Browse directors</Link>
      </div>
    );
  }
  return (
    <section className="film-section" aria-labelledby="following-h" style={{ marginTop: 0 }}>
      <h2 id="following-h">Directors you follow</h2>
      <ul className="director-grid">
        {directors.map((d) => <DirectorCard key={d.id} director={d} />)}
      </ul>
    </section>
  );
}

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
