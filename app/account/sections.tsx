/** The films a member has suggested, with where each one is in review. */
export function Submissions({ rows }: { rows: { id: string; title: string; director: string; year: number | null; status: string }[] }) {
  return (
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
              <td><span className={`status-pill ${s.status}`}>{s.status === "pending" ? "In review" : s.status === "approved" ? "Added" : "Not added"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
