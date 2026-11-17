import { SITE_URL } from "@/lib/supabase/config";

/** Where a page sits, for search engines only (structured data). Nothing is shown on the page. */
export default function Breadcrumbs({ parent, href, current, currentHref }: { parent: string; href: string; current: string; currentHref?:string }) {
  return (
    <>
    {currentHref&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Pheelm',item:SITE_URL},{'@type':'ListItem',position:2,name:parent,item:SITE_URL+href},{'@type':'ListItem',position:3,name:current,item:SITE_URL+currentHref}]}).replace(/</g,'\\u003c')}}/>}
    </>
  );
}
