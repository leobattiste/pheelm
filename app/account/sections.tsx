import { PAGE_COPY } from "@/lib/site";
import Link from "next/link";
import DirectorCard from "@/components/DirectorCard";
import Poster from "@/components/Poster";
import { MarkSeen } from "@/components/UpdatesDot";
import type { DirectorSummary } from "@/lib/types";

export type Update = { film_id: string; slug: string; title: string; year: number; poster_url: string | null; director_name: string; director_slug: string; added_at: string };

/** Directors the member follows, and the films by them added since they followed. */
export function Following({ directors, updates }: { directors: DirectorSummary[]; updates: Update[] }) {
  if (!directors.length) {
    return (
      <div className="empty-state">
        <p>You&rsquo;re not following anyone yet.</p>
        <p className="muted">Press <strong>Follow</strong> on a director&rsquo;s page to see their new films here as they&rsquo;re added.</p>
        <Link className="button ghost small" href="/directors">Browse directors</Link>
      </div>
    );
  }
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  return (
    <>
      <MarkSeen newest={updates[0]?.added_at ?? null} />
      <section className="film-section" aria-labelledby="new-h" style={{ marginTop: 0 }}>
        <h2 id="new-h">New from directors you follow</h2>
        {updates.length ? (
          <ul className="update-list">
            {updates.map((u) => (
              <li key={u.film_id + u.director_slug}>
                <Link href={`/films/${u.slug}`}>
                  <Poster title={u.title} year={u.year} directors={[u.director_name]} src={u.poster_url} sizes="40px" />
                  <span>
                    <span className="update-title">{u.title}</span>
                    <span className="update-meta"> • {u.director_name} • {u.year}</span>
                  </span>
                  <span className="update-when">Added {fmt.format(new Date(u.added_at))}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="label" style={{ marginBottom: 40 }}>Nothing new yet. Films by these directors will show up here when they&rsquo;re added to Pheelm.</p>
        )}
      </section>
      <section className="film-section" aria-labelledby="following-h">
        <h2 id="following-h">Directors you follow</h2>
        <ul className="director-grid">
          {directors.map((d) => <DirectorCard key={d.id} director={d} />)}
        </ul>
      </section>
    </>
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
