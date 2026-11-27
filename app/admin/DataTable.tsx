import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The one list layout admin uses for records (films, directors, members, watchlists): a real
 * table on wide screens, and compact rows on phones, where only the main column and the columns
 * marked `phone` stay. A whole row opens its record; checkboxes and ⋯ menus sit above that link.
 */
export type Column = {
  key: string;
  label: string;
  /** Kept on phones, after the main column (a status, say). The main column always stays. */
  phone?: boolean;
  align?: "end";
  /** A fixed width on wide screens, e.g. "90px". */
  width?: string;
  /** Only on wide screens (1200px and up), when tablets don't have the room. */
  wide?: boolean;
};

export type TableRow = {
  id: string;
  cells: Record<string, ReactNode>;
  /** A checkbox for bulk actions. */
  select?: ReactNode;
  /** A ⋯ menu of actions for this row. */
  menu?: ReactNode;
  /** Shown dimmed: hidden, suspended, a draft. */
  dim?: boolean;
};

export function DataTable({ label, columns, rows, selectAll, empty }: {
  label: string; columns: Column[]; rows: TableRow[]; selectAll?: ReactNode; empty?: ReactNode;
}) {
  const hasSelect = rows.some((r) => r.select);
  const hasMenu = rows.some((r) => r.menu);
  if (!rows.length) return <>{empty ?? null}</>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" aria-label={label}>
        <thead>
          <tr>
            {hasSelect && <th className="col-select" scope="col">{selectAll ?? <span className="visually-hidden">Select</span>}</th>}
            {columns.map((c, i) => (
              <th key={c.key} scope="col" className={cls(c, i)} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
            ))}
            {hasMenu && <th className="col-menu" scope="col"><span className="visually-hidden">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.dim ? "is-dim" : undefined}>
              {hasSelect && <td className="col-select">{r.select}</td>}
              {columns.map((c, i) => <td key={c.key} className={cls(c, i)}>{r.cells[c.key] ?? <span className="admin-cell-none">—</span>}</td>)}
              {hasMenu && <td className="col-menu">{r.menu}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cls = (c: Column, i: number) => [
  i === 0 ? "col-main" : `col-${c.key}`,
  i > 0 && !c.phone ? "is-wide-only" : "",
  c.wide ? "is-xl-only" : "",
  c.align === "end" ? "is-end" : "",
].filter(Boolean).join(" ");

/**
 * The main cell: a picture, the name (the link that opens the record, and makes the whole row
 * clickable), and a line under it. `phoneDetail` replaces that line on phones, where the other
 * columns are hidden, so it can carry what they said.
 */
export function MainCell({ href, title, detail, phoneDetail, media, after }: {
  href: string; title: ReactNode; detail?: ReactNode; phoneDetail?: ReactNode; media?: ReactNode; after?: ReactNode;
}) {
  return (
    <div className="admin-cell-main">
      {media}
      <div className="admin-cell-text">
        <span className="admin-cell-title"><Link className="admin-row-link" href={href}>{title}</Link>{after}</span>
        {detail && <span className={`admin-cell-detail${phoneDetail ? " is-wide-only" : ""}`}>{detail}</span>}
        {phoneDetail && <span className="admin-cell-detail is-phone-only">{phoneDetail}</span>}
      </div>
    </div>
  );
}

/** A small picture for a row: a poster (2:3), a portrait or an avatar (round), or initials. */
export function Thumb({ src, name, shape = "poster" }: { src?: string | null; name: string; shape?: "poster" | "round" }) {
  const initials = name.replace(/^@/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return (
    <span className={`admin-thumb is-${shape}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span>{initials}</span>}
    </span>
  );
}

/** Small grey words for what's missing ("No poster, no synopsis"), or a quiet "Complete". */
export function Gaps({ items }: { items: string[] }) {
  if (!items.length) return <span className="admin-gaps is-complete">Complete</span>;
  return (
    <span className="admin-gaps" title={`Missing: ${items.join(", ")}`}>
      {items.slice(0, 2).map((g) => <span key={g} className="admin-gap">{g}</span>)}
      {items.length > 2 && <span className="admin-gap is-more">+{items.length - 2}</span>}
    </span>
  );
}

/** A count in a table cell, right-aligned and in figures that line up. */
export function Num({ value }: { value: number }) {
  return <span className={`admin-num${value ? "" : " is-zero"}`}>{value.toLocaleString("en-US")}</span>;
}
