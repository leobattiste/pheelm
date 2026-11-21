import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { Empty, PageHeader, Panel, Row, plural } from "../ui";

async function resolve(form: FormData) {
  "use server";
  const { db } = await requireAdmin("/admin/searches");
  const q = String(form.get("q") ?? "");
  if (q) await db.from("search_misses").update({ resolved: true }).eq("q", q);
  revalidatePath("/admin/searches");
}

/** What people searched for and found nothing: a to-do list for the catalog. */
export default async function SearchMissesPage() {
  const { db } = await requireAdmin("/admin/searches");
  const { data, error } = await db.from("search_misses").select("q,count,last_at").eq("resolved", false).order("count", { ascending: false }).order("last_at", { ascending: false }).limit(200);
  const rows = error ? [] : data ?? [];
  return (
    <>
      <PageHeader title="Searches with no results" back={{ href: "/admin/films", label: "Films" }}
        description="What people searched for on Pheelm and found nothing, most searched first. Only the words are kept." />
      <Panel>
        {error ? <Empty title="Not set up yet">Apply supabase/archive/search-misses.sql to start counting.</Empty>
          : rows.length ? rows.map((r) => (
            <Row key={r.q} detail={`${plural(r.count, "search", "searches")} • last ${new Date(r.last_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              aside={<form action={resolve}><input type="hidden" name="q" value={r.q} /><button className="button small ghost">Done</button></form>}>
              <Link href={`/admin/films?q=${encodeURIComponent(r.q)}`}>{r.q}</Link>
            </Row>
          )) : <Empty title="Nothing yet">Searches that find nothing will show here.</Empty>}
      </Panel>
    </>
  );
}
