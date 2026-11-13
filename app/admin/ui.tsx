import Link from "next/link";
import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon";
import AdminMenu from "./AdminMenu";

/**
 * The building blocks every admin screen uses, so headers, cards, rows, filters, empty states
 * and pagination look and behave the same everywhere.
 */

/** Admin times are shown in the owner's time zone. */
export const ADMIN_TZ = "America/New_York";
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: ADMIN_TZ });
const DAY_TIME = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: ADMIN_TZ });

/** "Nov 12, 2026", or the fallback when there's no date. */
export function day(iso: string | null | undefined, fallback = "Never") {
  return iso ? DAY.format(new Date(iso)) : fallback;
}

/** "Nov 12, 2026, 9:14 AM" (Eastern). */
export function dayTime(iso: string | null | undefined, fallback = "Never") {
  return iso ? DAY_TIME.format(new Date(iso)) : fallback;
}

/** "Today", "Yesterday", "3 days ago", then the date. Pass false to start with a lowercase letter mid-sentence. */
export function ago(iso: string, capital = true) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const word = days <= 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? `${days} days ago` : null;
  if (!word) return (capital ? "" : "on ") + day(iso);
  return capital ? word[0].toUpperCase() + word.slice(1) : word;
}

/** "1 member", "3 members". */
export function plural(count: number, one: string, many = one + "s") {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

/** A whole number from a query string, kept within bounds. */
export function pageNumber(raw: string | undefined, max = 10000) {
  return Math.max(1, Math.min(max, Number.parseInt(raw ?? "1", 10) || 1));
}

/** The title of a screen (its one heading), what it's for, and its main actions. */
export function PageHeader({ title, description, actions, back }: {
  title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string };
}) {
  return (
    <header className="admin-page-head">
      {back && <Link className="admin-back" href={back.href}><Icon name="arrowLeft" />{back.label}</Link>}
      <div className="admin-title-row">
        <h1>{title}</h1>
        {actions && <div className="actions">{actions}</div>}
      </div>
      {description && <p>{description}</p>}
    </header>
  );
}

/** A card holding one part of a screen. */
export function Panel({ title, icon, actions, children, id, className = "" }: {
  title?: string; icon?: IconName; actions?: ReactNode; children: ReactNode; id?: string; className?: string;
}) {
  return (
    <section className={`admin-panel ${className}`.trim()} id={id}>
      {(title || actions) && (
        <header className="admin-panel-head">
          {title && <h3>{icon && <Icon name={icon} />}{title}</h3>}
          {actions && <div className="actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** One line in a panel: a label, optional detail, and something on the right (a count, a date, a status). */
export function Row({ href, children, aside, detail }: { href?: string; children: ReactNode; aside?: ReactNode; detail?: ReactNode }) {
  const body = (
    <>
      <span className="admin-row-main"><span className="admin-row-title">{children}</span>{detail && <span className="admin-row-detail">{detail}</span>}</span>
      {aside !== undefined && <span className="admin-row-aside">{aside}</span>}
    </>
  );
  return href ? <Link className="admin-row" href={href}>{body}</Link> : <div className="admin-row">{body}</div>;
}

/** A number with its label. Links when there's somewhere to go. */
export function Stat({ value, label, href, tone }: { value: number | string; label: string; href?: string; tone?: "attention" }) {
  const body = <><strong>{typeof value === "number" ? value.toLocaleString("en-US") : value}</strong><span>{label}</span></>;
  const className = "stat" + (tone === "attention" && value ? " is-attention" : "");
  return href ? <Link className={className} href={href}>{body}</Link> : <div className={className}>{body}</div>;
}

export function Stats({ children }: { children: ReactNode }) {
  return <div className="stats">{children}</div>;
}

export type PillTone = "neutral" | "ok" | "warn" | "danger" | "info";
/** A small status label. */
export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}

/** A count badge, hidden at zero. */
export function Count({ value, label }: { value: number; label?: string }) {
  if (!value) return null;
  return <span className="admin-count" aria-label={label ? `${value} ${label}` : undefined}>{value > 99 ? "99+" : value}</span>;
}

/** Links that switch between views of one list ("Open", "Done", …), with counts. */
/** Which records to show (by status, say), as one dropdown rather than a row of tabs. */
export function ViewTabs({ items, label }: { items: { label: string; href: string; active: boolean; count?: number }[]; label: string }) {
  const current = items.find((item) => item.active) ?? items[0];
  const count = (n?: number) => n !== undefined ? <span className="count">{n.toLocaleString("en-US")}</span> : null;
  return (
    <div className="admin-view-filter">
      <AdminMenu label={label} align="left" text={<>{current?.label}{count(current?.count)}</>}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined}>{item.label}{count(item.count)}</Link>
        ))}
      </AdminMenu>
    </div>
  );
}

/** What to show when a list is empty: what that means, and what to do next. */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="admin-empty">
      <p className="admin-empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Previous and next links, with where you are. */
export function Pager({ page, total, size, href }: { page: number; total: number; size: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <nav className="admin-pager" aria-label="Pages">
      {page > 1 ? <Link className="button ghost small" href={href(page - 1)}>Previous</Link> : <span />}
      <span className="muted">Page {page} of {pages}</span>
      {page < pages ? <Link className="button ghost small" href={href(page + 1)}>Next</Link> : <span />}
    </nav>
  );
}

/** A notice at the top of a screen after an action ("Saved", "Couldn't send"). */
export function Flash({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (ok) return <p className="notice ok" role="status">{ok}</p>;
  return null;
}

/** Facts about one record: label and value pairs. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  const shown = items.filter(([, value]) => value !== null && value !== undefined && value !== "");
  return <dl className="admin-facts">{shown.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
