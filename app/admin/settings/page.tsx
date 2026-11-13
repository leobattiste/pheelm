import { requireAdmin } from "@/lib/admin";
import { PageHeader, Panel, Row } from "../ui";

/** The few things that change rarely: moderation rules and the records of what happened. */
export default async function AdminSettings() {
  const { db } = await requireAdmin("/admin/settings");
  const [words, refused] = await Promise.all([
    db.rpc("admin_banned_words"),
    db.rpc("admin_moderation_log", { page_size: 1, page_offset: 0 }),
  ]);
  const wordCount = Array.isArray(words.data) ? words.data.length : 0;
  const refusedTotal = refused.error ? null : Number((refused.data as { total?: number }[] | null)?.[0]?.total ?? 0);
  return (
    <>
      <PageHeader title="Settings" description="Moderation rules, and the records of what happened in admin." />
      <div className="admin-grid">
        <Panel title="Moderation" icon="flag">
          <Row href="/admin/community/banned-words" detail="Words members can't use in comments, bios and watchlist descriptions." aside={<strong className="admin-number">{wordCount}</strong>}>Banned words</Row>
          <Row href="/admin/community/moderation" detail="Text stopped for a banned word before it was posted. Kept for 90 days."
            aside={refusedTotal !== null ? <strong className="admin-number">{refusedTotal}</strong> : undefined}>Refused text</Row>
        </Panel>
        <Panel title="Records" icon="clock">
          <Row href="/admin/activity" detail="Every change made in admin, newest first.">Activity log</Row>
          <Row href="/admin/analytics" detail="How the catalog and community grow. Visitors aren't tracked.">Analytics</Row>
        </Panel>
      </div>
    </>
  );
}
