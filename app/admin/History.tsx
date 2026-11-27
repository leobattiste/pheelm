import Link from "next/link";
import type { Change } from "@/lib/changes";
import { dayTime } from "./ui";

export type ActivityEntry = {
  id: number; action: string; details: string | null; created_at: string;
  who: string; href?: string; changes?: Change[] | null;
};

/**
 * Entries from the activity log, newest first. An edit shows what it changed, field by field,
 * behind "n changes": the old value struck through and the new one beside it.
 */
export function History({ entries, compact = false }: { entries: ActivityEntry[]; compact?: boolean }) {
  return (
    <ol className={`admin-history${compact ? " is-compact" : ""}`}>
      {entries.map((e) => (
        <li key={e.id}>
          <div className="admin-history-line">
            <span className="admin-history-action">{e.href ? <Link href={e.href}>{e.action}</Link> : e.action}</span>
            <time className="admin-history-when" dateTime={e.created_at}>{dayTime(e.created_at)}</time>
          </div>
          <p className="admin-history-detail">{[e.who, compact ? null : e.details].filter(Boolean).join(" · ")}</p>
          {!!e.changes?.length && (
            <details className="admin-changes">
              <summary>{e.changes.length} {e.changes.length === 1 ? "change" : "changes"}</summary>
              <dl>
                {e.changes.map((c, i) => (
                  <div key={i}>
                    <dt>{c.field}</dt>
                    <dd><del>{c.before}</del><span aria-hidden="true">→</span><ins>{c.after}</ins></dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
