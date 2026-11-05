import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page narrow">
      <h1>Not found</h1>
      <p className="lead">That page isn&rsquo;t in the directory.</p>
      <p>
        <Link className="button" href="/films">Browse all films</Link>
      </p>
    </section>
  );
}
