import Link from "next/link";
import { SITE_URL } from "@/lib/supabase/config";

/** "Films / Daughters of the Dust": where a page sits, with a link back up. */
export default function Breadcrumbs({ parent, href, current, currentHref }: { parent: string; href: string; current: string; currentHref?:string }) {
  return (
    <>
    {currentHref&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Pheelm',item:SITE_URL},{'@type':'ListItem',position:2,name:parent,item:SITE_URL+href},{'@type':'ListItem',position:3,name:current,item:SITE_URL+currentHref}]}).replace(/</g,'\\u003c')}}/>}
    <nav className="crumbs breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li><Link href={href}>{parent}</Link></li>
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
    </>
  );
}
