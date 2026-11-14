import Link from "next/link";
import { getProfileDirectorCards } from "@/lib/profile-data";
import { countryName } from "@/lib/format";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import AdminAddPanel from "../AdminAddPanel";
import { AdminSelectionProvider, AdminSelectionTools } from "../AdminSelectionBar";
import AddPersonForm from "./AddPersonForm";
import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "../ui";
import PeopleBulkControls, { type AdminPersonRow } from "./PeopleBulkControls";
import { bulkPersonChange } from "./bulk-actions";

type Params = {
  q?: string; all?: string; missing?: string; country?: string; visibility?: string;
  sort?: string; page?: string; limit?: string; updated?: string; error?: string;
};
const SIZES = ["20", "40", "80", "all"];
// What a person can be missing. "any" is any of the first five.
const BLANK = (column: string) => `${column}.is.null,${column}.eq.`;
const MISSING: Record<string, { label: string; or: string }> = {
  photo: { label: "Missing portrait", or: BLANK("photo_url") },
  bio: { label: "Missing biography", or: BLANK("bio") },
  country: { label: "Missing country", or: BLANK("country") },
  born: { label: "Missing birth date", or: "born.is.null" },
  birthplace: { label: "Missing birthplace", or: BLANK("birthplace") },
  known_for: { label: "Missing known for", or: BLANK("known_for") },
  instagram: { label: "Missing Instagram", or: BLANK("instagram") },
  imdb: { label: "Missing IMDb link", or: BLANK("imdb_id") },
  tmdb: { label: "Not linked to TMDB", or: "tmdb_id.is.null" },
};
const MISSING_ANY = ["photo", "bio", "country", "born", "birthplace"].map((k) => MISSING[k].or).join(",");

export default async function AdminPeople({ searchParams }: { searchParams: Promise<Params> }) {
  const { db, owner } = await requireAdmin("/admin/people");
  const sp = await searchParams;
  const everyone = sp.all === "1";
  // There are many more credited people than directors. "All" is limited to
  // the Directors view to avoid rendering thousands of unrelated people at once.
  const size = SIZES.includes(sp.limit ?? "") ? sp.limit! : "40";
  const effectiveSize = everyone && size === "all" ? "80" : size;
  const perPage = effectiveSize === "all" ? 500 : Number(effectiveSize);
  const page = effectiveSize === "all" ? 1 : Math.max(1, Math.min(5000, Number.parseInt(sp.page ?? "1", 10) || 1));
  const q = (sp.q ?? "").trim().slice(0, 100);
  const missing = sp.missing === "any" || sp.missing! in MISSING ? sp.missing! : "";
  const visibility = ["shown", "hidden"].includes(sp.visibility ?? "") ? sp.visibility! : "";
  const country = /^[A-Za-z]{2}$/.test(sp.country ?? "") ? sp.country!.toUpperCase() : "";
  const sort = ["za", "added"].includes(sp.sort ?? "") ? sp.sort! : "az";

  const build = () => {
    let query = everyone
      ? db.from("people").select("id,slug,name,country,bio,photo_url,in_directory,credits(role)", { count: "exact" })
      : db.from("people").select("id,slug,name,country,bio,photo_url,in_directory,credits!inner(role)", { count: "exact" }).eq("credits.role", "director");
    if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
    if (missing === "any") query = query.or(MISSING_ANY);
    else if (missing) query = query.or(MISSING[missing].or);
    if (country) query = query.eq("country", country);
    if (visibility) query = query.eq("in_directory", visibility === "shown");
    if (sort === "added") return query.order("created_at", { ascending: false }).order("name");
    return query.order("name", { ascending: sort === "az" });
  };

  const load = async () => {
    const first = await build().range(effectiveSize === "all" ? 0 : (page - 1) * perPage, effectiveSize === "all" ? 499 : page * perPage - 1);
    if (first.error || effectiveSize !== "all") return first;
    const rows = [...(first.data ?? [])];
    const count = first.count ?? rows.length;
    for (let start = 500; start < count; start += 500) {
      const next = await build().range(start, Math.min(start + 499, count - 1));
      if (next.error) return { data: rows, count, error: next.error };
      rows.push(...(next.data ?? []));
      if (!next.data?.length) break;
    }
    return { data: rows, count, error: null };
  };

  const [result, countryRows] = await Promise.all([
    load(),
    db.from("people").select("country").not("country", "is", null).limit(10000),
  ]);
  const { data: people, count, error } = result;
  const directors = await getProfileDirectorCards((people ?? []).map(person => person.id)).catch(() => []);
  const summaries = new Map(directors.map(director => [director.id, director]));
  const rows: AdminPersonRow[] = (people ?? []).map((person) => ({
    ...person,
    credits: (person.credits ?? []) as { role: string }[],
    previews: summaries.get(person.id)?.previews ?? [],
  }));
  const countries = [...new Set((countryRows.data ?? []).map((person) => person.country).filter((value): value is string => !!value))].sort();
  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) if (!["page", "updated", "error"].includes(key) && value) baseParams.set(key, value);
  const href = (next: number) => { const p = new URLSearchParams(baseParams); p.set("page", String(next)); return `/admin/people?${p.toString()}`; };

  return (
    <AdminSelectionProvider key="people" entity="people"><section className="admin-directors">
      <PageHeader title="Directors" description="A director shows in the public directory once they direct a published film."
        actions={<AdminAddPanel label="Add a director" text="Add director"><AddPersonForm/></AdminAddPanel>} />
      {!!sp.updated && <p className="notice ok" role="status">{sp.updated} people updated.</p>}
      {sp.error === "selection" && <p className="notice error">Select at least one person first.</p>}
      {sp.error === "credits" && <p className="notice error">No one was deleted. Some selected people still have film credits; remove or reassign those credits first.</p>}
      <AdminBrowserToolbar action="/admin/people" query={q} pageSize={effectiveSize} placeholder="Search directors" compact count={count ?? 0} noun={everyone ? "people" : "directors"} allowAll={!everyone}
        selectionControls={<AdminSelectionTools entity="people" ids={rows.map(person => person.id)} canDelete={owner} action={bulkPersonChange}/>}
        filters={[
        { name: "all", label: "Show", value: everyone ? "1" : "", options: [{ value: "", label: "Directors" }, { value: "1", label: "Everyone" }] },
        { name: "visibility", label: "Directory visibility", value: visibility, options: [{ value: "", label: "All" }, { value: "shown", label: "Shown" }, { value: "hidden", label: "Hidden" }] },
        { name: "country", label: "Country", value: country, options: [{ value: "", label: "All countries" }, ...countries.map((code) => ({ value: code, label: countryName(code) }))] },
        { name: "missing", label: "Needs fixing", value: missing, options: [{ value: "", label: "Nothing in particular" }, { value: "any", label: "Missing any key detail" }, ...Object.entries(MISSING).map(([value, m]) => ({ value, label: m.label }))] },
        { name: "sort", label: "Sort by", value: sort, options: [{ value: "az", label: "Name A–Z" }, { value: "za", label: "Name Z–A" }, { value: "added", label: "Latest added" }] },
      ]} />
      {error ? <p className="notice error">Could not load directors. Try again.</p> : (
        <PeopleBulkControls people={rows} canDelete={owner} />
      )}
      {!rows.length && !error && <p className="empty">No matching people.</p>}
      {effectiveSize !== "all" && <div className="actions admin-pagination">
        {page > 1 && <Link className="button ghost small" href={href(page - 1)}>Previous</Link>}
        <span className="muted">Page {page} of {Math.max(1, Math.ceil((count ?? 0) / perPage))}</span>
        {page * perPage < (count ?? 0) && <Link className="button ghost small" href={href(page + 1)}>Next</Link>}
      </div>}
    </section></AdminSelectionProvider>
  );
}
