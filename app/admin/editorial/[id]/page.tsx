import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import EditorialEditor from "../EditorialEditor";
import { restoreEditorial } from "../actions";

export default async function EditEditorial({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const {db} = await requireAdmin(`/admin/editorial/${id}`);
  const [{data:film},{data:editorial},{data:versions}] = await Promise.all([
    db.from("films").select("id,title,year,slug,status,synopsis").eq("id",id).maybeSingle(),
    db.from("film_editorials").select("essay,sources,status,updated_at").eq("film_id",id).maybeSingle(),
    db.from("film_editorial_versions").select("id,created_at,status,edited_by").eq("film_id",id).order("created_at",{ascending:false}).limit(10),
  ]);
  if(!film) notFound();
  return (
    <>
      <div className="admin-head">
        <div><p className="muted"><Link href="/admin/editorial">Editorial</Link> / {film.year}</p><h1>{film.title}</h1></div>
        <div className="actions"><Link className="button ghost small" href={`/admin/films/${id}`}>Film details</Link>
          {film.status==="published" && <Link className="button ghost small" href={`/films/${film.slug}`}>View film</Link>}
        </div>
      </div>
      <div className="admin-editorial-layout">
        <div>
          <section className="fieldset">
            <h2>Current synopsis</h2>
            <p className="muted">{film.synopsis || "No synopsis yet. Add one in the film editor."}</p>
          </section>
          <EditorialEditor key={editorial?.updated_at ?? "new"} filmId={id} essay={editorial?.essay ?? ""} sources={editorial?.sources ?? ""} status={editorial?.status === "published" ? "published" : "draft"} />
        </div>
        <section className="fieldset">
          <h2>Revision history</h2>
          {(versions ?? []).length ? (versions ?? []).map((v) => (
            <div className="admin-revision" key={v.id}>
              <span className="muted">{new Date(v.created_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</span>
              <span className="status-pill">{v.status}</span>
              <form action={restoreEditorial}><input type="hidden" name="film_id" value={id}/><input type="hidden" name="revision_id" value={v.id}/>
                <button type="submit" className="button ghost small">Restore</button></form>
            </div>
          )) : <p className="muted">No revisions yet.</p>}
        </section>
      </div>
    </>
  );
}
