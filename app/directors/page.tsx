import type { Metadata } from "next";
import Link from "next/link";
import { getDirectors } from "@/lib/data";
import { countryName, initials } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Directors",
  description: "Black directors from around the world, with biographies and filmographies.",
};

export default async function DirectorsPage() {
  const directors = await getDirectors();
  const byCountry = new Map<string, typeof directors>();
  for (const d of directors) {
    const key = d.country ?? "";
    byCountry.set(key, [...(byCountry.get(key) ?? []), d]);
  }
  const groups = [...byCountry.entries()].sort((a, b) => b[1].length - a[1].length || countryName(a[0]).localeCompare(countryName(b[0])));

  return (
    <section className="page">
      <header className="page-head">
        <h1>Directors</h1>
        <p className="lead">{directors.length} directors from {groups.filter(([c]) => c).length} countries.</p>
      </header>
      <ul className="director-list">
        {directors.map((d) => {
          const years = d.films.map((f) => f.year);
          return (
            <li key={d.id}>
              <Link href={`/directors/${d.slug}`} className="director-row">
                {d.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="portrait" src={d.photo_url} alt="" loading="lazy" />
                ) : (
                  <span className="portrait initials" aria-hidden="true">{initials(d.name)}</span>
                )}
                <span className="director-name">{d.name}</span>
                <span className="director-meta">
                  {d.country ? countryName(d.country) : ""}
                  {d.country ? " · " : ""}
                  {d.films.length} {d.films.length === 1 ? "film" : "films"} · {Math.min(...years)}
                  {Math.max(...years) !== Math.min(...years) ? `–${Math.max(...years)}` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
