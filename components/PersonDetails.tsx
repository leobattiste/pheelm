import Link from "next/link";
import { initials } from "@/lib/format";
import { lifeLine, overallRoles, type PersonInfo } from "@/lib/roles";

/**
 * A cast or crew member's details: portrait, what they do, when and where they were born, their
 * biography, links, and their films on Pheelm. Used in the sheet on film pages and on their page.
 */
export default function PersonDetails({ info, headingLevel = 2 }: { info: PersonInfo; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const life = lifeLine(info);
  const paragraphs = info.bio?.split(/\n{2,}/).filter(Boolean) ?? [];

  return (
    <div className="person-details">
      <div className="person-details-head">
        {info.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="portrait" src={info.photo_url} alt="" />
        ) : (
          <span className="portrait portrait-initials" aria-hidden="true">{initials(info.name)}</span>
        )}
        <div className="person-details-name">
          <Heading id={`person-${info.id}`}>{info.name}</Heading>
          <p className="person-roles">{overallRoles(info.works)}</p>
        </div>
      </div>
      {life && <p className="person-life">{life}</p>}
      <PersonLinks info={info} />
      {paragraphs.length > 0 && (
        <div className="person-bio">
          {paragraphs.slice(0, 2).map((p, i) => <p key={i}>{p}</p>)}
          {paragraphs.length > 2 && (
            <details className="more">
              <summary className="link-button"><span className="more-closed">Read more</span><span className="more-open">Show less</span></summary>
              {paragraphs.slice(2).map((p, i) => <p key={i}>{p}</p>)}
            </details>
          )}
        </div>
      )}
      {info.works.length > 0 && (
        <div className="person-works">
          <h3>On Pheelm</h3>
          <ol className="filmography">
            {info.works.map((w) => (
              <li key={w.slug}>
                <span className="year">{w.year}</span>
                <Link href={`/films/${w.slug}`}>{w.title}</Link>
                <span className="muted">{w.role}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** IMDb and Instagram, when TMDB has them. */
export function PersonLinks({ info }: { info: Pick<PersonInfo, "imdb_id" | "instagram" | "name"> }) {
  if (!info.imdb_id && !info.instagram) return null;
  return (
    <ul className="person-links">
      {info.imdb_id && (
        <li><a className="button ghost small" href={`https://www.imdb.com/name/${info.imdb_id}/`} target="_blank" rel="noopener noreferrer">IMDb</a></li>
      )}
      {info.instagram && (
        <li><a className="button ghost small" href={`https://www.instagram.com/${info.instagram}/`} target="_blank" rel="noopener noreferrer">Instagram</a></li>
      )}
    </ul>
  );
}
