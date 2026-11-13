import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "../../ui";
import AddFilms from "../AddFilms";
import type { QueueItem } from "../queue-actions";

export default async function AddFilmsPage({ searchParams }: { searchParams: Promise<{ method?: string }> }) {
  const { db, user } = await requireAdmin("/admin/films/add");
  const sp = await searchParams;
  const [queue, collections] = await Promise.all([
    db.from("film_queue").select("id,title,year,director_name,director_keys,synopsis,last_error").order("created_at").order("title").limit(1000),
    db.from("lists").select("id,title").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const items = (queue.data ?? []) as QueueItem[];
  const method = sp.method === "one" || sp.method === "list" || sp.method === "queue" ? sp.method : items.length ? "queue" : "one";
  return (
    <>
      <PageHeader back={{ href: "/admin/films", label: "Films" }} title="Add films"
        description="Films are filled in from TMDB: poster, synopsis, cast and crew, and where to watch." />
      <AddFilms queue={items} collections={collections.data ?? []} initial={method} />
    </>
  );
}
