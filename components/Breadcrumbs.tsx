import Link from "next/link";
import { SITE_URL } from "@/lib/supabase/config";

type Crumb = { label: string; href: string };

/**
 * Where a page sits: Films / Spike Lee / Clockers. Shown on the page and given to search engines.
 * `middle` is the level between the section and the page (a film's directors); it can hold several links.
 */
export default function Breadcrumbs({ parent, href, middle, current, currentHref }: { parent: string; href: string; middle?: Crumb[]; current: string; currentHref?: string }) {
  const ld = currentHref && {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Pheelm", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: parent, item: SITE_URL + href },
      ...(middle?.[0] ? [{ "@type": "ListItem", position: 3, name: middle.map((m) => m.label).join(" and "), item: SITE_URL + middle[0].href }] : []),
      { "@type": "ListItem", position: middle?.[0] ? 4 : 3, name: current, item: SITE_URL + currentHref },
    ],
  };
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href={href}>{parent}</Link></li>
          {middle && middle.length > 0 && (
            <li>
              {middle.map((m, i) => (
                <span key={m.href}>{i > 0 && ", "}<Link href={m.href}>{m.label}</Link></span>
              ))}
            </li>
          )}
          <li aria-current="page"><span>{current}</span></li>
        </ol>
      </nav>
    </>
  );
}
