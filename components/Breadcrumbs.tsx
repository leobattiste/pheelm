import Link from "next/link";

/** "Films / Daughters of the Dust": where a page sits, with a link back up. */
export default function Breadcrumbs({ parent, href, current }: { parent: string; href: string; current: string }) {
  return (
    <nav className="crumbs breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li><Link href={href}>{parent}</Link></li>
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}
