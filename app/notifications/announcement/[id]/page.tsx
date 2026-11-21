import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { privateMetadata } from "@/lib/seo";
import { getServerClient, getViewer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = privateMetadata("From Pheelm");

type Announcement = { kind: "announcement" | "service" | "newsletter"; subject: string; message: string; action_path: string; action_label: string; created_at: string };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An announcement or service notice in full, opened from Notifications. Only its recipients can read it. */
export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const db = await getServerClient();
  if (!db) redirect("/");
  const user = await getViewer(db);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/notifications/announcement/${id}`)}`);
  const { data, error } = await db.rpc("my_announcement", { p_id: id });
  if (error || !data) notFound();
  const a = data as Announcement;
  // Opening it counts as reading it.
  await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).eq("ref_id", id).is("read_at", null);
  const date = new Date(a.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  return (
    <article className="page announcement-page">
      <header className="page-head">
        <p className="muted">{a.kind === "service" ? "Service notice" : "From Pheelm"} · <time dateTime={a.created_at}>{date}</time></p>
        <h1>{a.subject}</h1>
      </header>
      <div className="announcement-body">
        {a.message.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
      </div>
      <div className="actions">
        {a.action_path && a.action_path !== "/" ? <Link className="button" href={a.action_path}>{a.action_label}</Link> : null}
        <Link className="button ghost" href="/notifications">Back to notifications</Link>
      </div>
    </article>
  );
}
