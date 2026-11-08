import Icon from "./Icon";
import Link from "next/link";
import { initials } from "@/lib/format";
import { bornText, diedText, overallRoles, type PersonInfo } from "@/lib/roles";

/**
 * A cast or crew member's details: portrait, what they do, when and where they were born, their
 * biography, links, and their films on Pheelm. Used in the sheet on film pages and on their page.
 */
export default function PersonDetails({ info, headingLevel = 2 }: { info: PersonInfo; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const born = bornText(info);
  const died = diedText(info);
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
      {(born || died || info.imdb_id || info.instagram) && (
        <dl className="details person-dates">
          {born && <div><dt>Born</dt><dd>{born}</dd></div>}
          {died && <div><dt>Died</dt><dd>{died}</dd></div>}
          <PersonLinks info={info} />
        </dl>
      )}
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
          <h3>Featured in</h3>
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

/** IMDb and Instagram as a details row, labelled "Link" or "Links". Nothing when there are none. */
export function PersonLinks({ info }: { info: Pick<PersonInfo, "imdb_id" | "instagram" | "name"> }) {
  const links = [
    info.imdb_id && { label: "IMDb", href: `https://www.imdb.com/name/${info.imdb_id}/` },
    info.instagram && { label: "Instagram", href: `https://www.instagram.com/${info.instagram}/` },
  ].filter((l): l is { label: string; href: string } => !!l);
  if (!links.length) return null;
  return (
    <div>
      <dt>{links.length > 1 ? "Links" : "Link"}</dt>
      <dd>
        <span className="link-chips">
          {links.map((l) => (
            <a key={l.label} className="platform-link" aria-label={`${info.name} on ${l.label}`} title={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
              <Icon name={l.label === "Instagram" ? "instagram" : "imdb"} />
            </a>
          ))}
        </span>
      </dd>
    </div>
  );
}
