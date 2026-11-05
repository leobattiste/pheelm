import Link from "next/link";
import type { Collection } from "@/lib/types";
import Poster from "./Poster";

/** The collection's name and description, with three of its posters side by side below. */
export default function CollectionTile({ collection }: { collection: Collection }) {
  return (
    <li>
      <Link href={`/collections/${collection.slug}`} className="collection-tile">
        <span className="collection-fan" aria-hidden="true">
          {collection.films.slice(0, 3).map((f) => (
            <Poster key={f.id} title={f.title} year={f.year} directors={f.directors.map((d) => d.name)} src={f.poster_url} sizes="140px" />
          ))}
        </span>
        <span className="collection-title">{collection.title}</span>
        <span className="collection-desc">{[`${collection.films.length} ${collection.films.length === 1 ? "film" : "films"}`, collection.description].filter(Boolean).join(" • ")}</span>
      </Link>
    </li>
  );
}
