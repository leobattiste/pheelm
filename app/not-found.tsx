import { privateMetadata } from "@/lib/seo";
export const metadata=privateMetadata("Page not found");
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page narrow">
      <h1>Page not found</h1>
      <p className="lead">There&rsquo;s nothing at this address. The link may be mistyped, or the page may have moved.</p>
      <p>
        <Link className="button" href="/films">Browse films</Link>
      </p>
    </section>
  );
}
