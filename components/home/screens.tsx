import CommunityTile from "@/components/CommunityTile";
import DirectorCard from "@/components/DirectorCard";
import FilmCard from "@/components/FilmCard";
import Icon from "@/components/Icon";
import Poster from "@/components/Poster";
import UserAvatar from "@/components/UserAvatar";
import type { CommunityCollection, Member } from "@/lib/community";
import { countryName, initials, runtimeLabel } from "@/lib/format";
import { toCard, toDirectorSummary } from "@/lib/data";
import type { Director, Film } from "@/lib/types";

/**
 * Miniatures of Pheelm's real pages for the home page, built from the same components and
 * classes as the pages themselves, with real data. Nothing in them links anywhere.
 */

const Head = ({ title, sub }: { title: string; sub?: string }) => (
  <header className="page-head"><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</header>
);

const Toolbar = ({ query, placeholder, filters = 0 }: { query?: string; placeholder: string; filters?: number }) => (
  <div className="toolbar catalog-toolbar">
    <div className="catalog-search-control"><div className="search-bar"><Icon name="search" /><input readOnly tabIndex={-1} value={query ?? ""} placeholder={placeholder} aria-hidden="true" /></div></div>
    <span className={"button ghost filter-button" + (filters ? " has-count" : "")}><Icon name="filter" /><span className="filter-label">Filters</span>{filters > 0 && <span className="badge">{filters}</span>}</span>
  </div>
);

const Films = ({ films }: { films: Film[] }) => (
  <ul className="film-grid">{films.map((f) => <FilmCard key={f.id} film={toCard(f)} plain />)}</ul>
);

/* Films ---------------------------------------------------------------------------------------- */

export function FilmFeed({ films, total }: { films: Film[]; total: number }) {
  return <div className="page"><Head title="Films" sub={`${total.toLocaleString("en-US")} films by Black directors`} /><Toolbar placeholder="Search films, directors and cast" /><Films films={films} /></div>;
}

export function FilmSearch({ films, chips, count }: { films: Film[]; chips: string[]; count: number }) {
  return (
    <div className="page">
      <Head title="Films" />
      <Toolbar placeholder="Search films" filters={chips.length} />
      <ul className="chip-list catalog-active-filters">{chips.map((c) => <li key={c}><span className="chip">{c}<Icon name="close" className="x" /></span></li>)}</ul>
      <div className="result-bar catalog-results-summary"><span className="link-button">Clear</span><span className="result-count">{count} results</span></div>
      <Films films={films} />
    </div>
  );
}

export function FilmAbout({ film }: { film: Film }) {
  const cast = film.credits.filter((c) => c.role === "cast").slice(0, 4);
  const directors = film.directors.map((d) => d.name).join(" and ");
  return (
    <article className="showcase-film">
      <div className="showcase-film-art"><Poster title={film.title} year={film.year} directors={film.directors.map((d) => d.name)} src={film.poster_url} hero /></div>
      <div className="showcase-film-body">
        <header className="film-head">
          <h1 className="film-title">{film.title}</h1>
          <p className="film-byline"><span className="byline-item">{directors}</span><span className="byline-item">{film.year}</span>{runtimeLabel(film.runtime) && <span className="byline-item">{runtimeLabel(film.runtime)}</span>}</p>
        </header>
        <div className="actions showcase-actions">
          <span className="button"><Icon name="bookmark" />Save</span>
          <span className="button ghost"><Icon name="check" />Watched</span>
          {film.trailer_url && <span className="button ghost"><Icon name="play" />Trailer</span>}
        </div>
        {film.synopsis && <p className="film-synopsis">{film.synopsis}</p>}
        <dl className="details">
          <div><dt>{film.countries.length > 1 ? "Countries" : "Country"}</dt><dd>{film.countries.map(countryName).join(", ")}</dd></div>
          <div><dt>Genre</dt><dd>{film.genres.join(", ")}</dd></div>
          {film.languages.length > 0 && <div><dt>Language</dt><dd>{film.languages.join(", ")}</dd></div>}
        </dl>
        {cast.length > 0 && (
          <section className="showcase-people">
            <h2>Cast and crew</h2>
            <ul>
              {[...film.directors.slice(0, 1).map((p) => ({ person: p, role: "Director" })), ...cast.map((c) => ({ person: c.person, role: c.character || "Cast" }))].map(({ person, role }) => (
                <li key={person.id + role}>
                  {person.photo_url ? <img className="portrait" src={person.photo_url} alt="" loading="lazy" /> : <span className="portrait portrait-initials">{initials(person.name)}</span>}
                  <span><strong>{person.name}</strong><span className="muted">{role}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {film.watch.length > 0 && (
          <section className="showcase-watch">
            <h2>Where to watch</h2>
            <ul className="chip-list">{[...new Set(film.watch.map((w) => w.provider))].slice(0, 5).map((p) => <li key={p}><span className="chip">{p}</span></li>)}</ul>
          </section>
        )}
      </div>
    </article>
  );
}

/* Directors ------------------------------------------------------------------------------------ */

export function DirectorDirectory({ directors, total }: { directors: Director[]; total: number }) {
  return (
    <div className="page">
      <Head title="Directors" sub={`${total.toLocaleString("en-US")} Black filmmakers from around the world`} />
      <Toolbar placeholder="Search directors" />
      <ul className="director-grid">{directors.map((d) => <DirectorCard key={d.id} director={toDirectorSummary(d)} plain />)}</ul>
    </div>
  );
}

function PersonHead({ director }: { director: Director }) {
  const years = director.films.map((f) => f.year);
  return (
    <header className="person-head">
      {director.photo_url ? <img className="portrait" src={director.photo_url} alt="" /> : <span className="portrait portrait-initials">{initials(director.name)}</span>}
      <div className="person-text">
        <h1>{director.name}</h1>
        <p className="person-sub">{[director.country && countryName(director.country), `${director.films.length} films`, years.length ? `${Math.min(...years)}–${Math.max(...years)}` : null].filter(Boolean).join(" • ")}</p>
      </div>
    </header>
  );
}

function ProfileTabs({ tabs, active }: { tabs: string[]; active: number }) {
  return <div className="profile-tabs">{tabs.map((t, i) => <span key={t} className="chip" aria-current={i === active ? "page" : undefined}>{t}</span>)}</div>;
}

export function DirectorBio({ director }: { director: Director }) {
  const awards = director.films
    .flatMap((f) => f.awards.filter((a) => a.result === "won" && a.award !== "National Film Registry").map((a) => ({ ...a, film: f.title })))
    .sort((a, b) => b.year - a.year).slice(0, 4);
  return (
    <div className="page profile">
      <PersonHead director={director} />
      <ProfileTabs tabs={["Films", "About"]} active={1} />
      <section className="profile-about">
        <dl className="details">
          {director.bio && <div className="details-wide"><dt>Biography</dt><dd>{director.bio.split(/\n+/).slice(0, 2).join(" ")}</dd></div>}
          {director.born && <div><dt>Born</dt><dd>{new Date(director.born).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}{director.birthplace ? ` in ${director.birthplace}` : ""}</dd></div>}
          {awards.length > 0 && <div className="details-wide"><dt>Awards</dt><dd><ul className="about-awards">{awards.map((a) => <li key={a.award + a.category + a.year}><span className="award-name">{a.award}</span> {a.category}, <em>{a.film}</em> ({a.year})</li>)}</ul></dd></div>}
        </dl>
      </section>
    </div>
  );
}

export function DirectorFilms({ director }: { director: Director }) {
  return (
    <div className="page profile">
      <PersonHead director={director} />
      <ProfileTabs tabs={["Films", "About"]} active={0} />
      <ul className="film-grid">{[...director.films].sort((a, b) => b.year - a.year).map((f) => <FilmCard key={f.id} film={toCard(f)} note="Director" plain />)}</ul>
    </div>
  );
}

/* Watchlists ----------------------------------------------------------------------------------- */

function WatchlistHead({ list, extra }: { list: CommunityCollection; extra?: React.ReactNode }) {
  return (
    <header className="page-head showcase-list-head">
      <h1>{list.title}</h1>
      <p className="muted">{list.owner ? `@${list.owner.handle} • ` : ""}{list.films.length} films</p>
      {list.description && <p>{list.description}</p>}
      {extra}
    </header>
  );
}

export function WatchlistCollection({ list }: { list: CommunityCollection }) {
  return (
    <div className="page">
      <WatchlistHead list={list} extra={<div className="actions"><span className="button"><Icon name="bookmark" />Save watchlist</span><span className="button ghost"><Icon name="share" />Share</span></div>} />
      <Films films={list.films.slice(0, 18)} />
    </div>
  );
}

export function WatchlistFollowing({ lists }: { lists: CommunityCollection[] }) {
  return (
    <div className="page">
      <Head title="Watchlists" sub="Made by the Pheelm community" />
      <ProfileTabs tabs={["Featured", "Popular", "Following", "Yours"]} active={2} />
      <ul className="collection-list">{lists.map((c) => <CommunityTile key={c.id} c={c} plain />)}</ul>
    </div>
  );
}

export function WatchlistCollaboration({ list, owner }: { list: CommunityCollection; owner: Member | null }) {
  return (
    <div className="page">
      <WatchlistHead list={list} />
      <section className="showcase-collab">
        <h2>Curators</h2>
        <ul>
          {owner && <li><UserAvatar person={owner} className="avatar" /><span><strong>{owner.display_name || `@${owner.handle}`}</strong><span className="muted">@{owner.handle} • Owner</span></span></li>}
          <li><span className="avatar portrait-initials"><Icon name="userPlus" /></span><span><strong>Invite a member</strong><span className="muted">They can add films and edit this watchlist with you.</span></span></li>
        </ul>
        <div className="showcase-invite"><div className="search-bar"><Icon name="at" /><input readOnly tabIndex={-1} placeholder="Their handle" aria-hidden="true" /></div><span className="button">Send invite</span></div>
      </section>
      <Films films={list.films.slice(0, 6)} />
    </div>
  );
}

/* Members -------------------------------------------------------------------------------------- */

function MemberHead({ member }: { member: Member }) {
  return (
    <header className="person-head">
      <UserAvatar person={member} className="portrait" />
      <div className="person-text"><h1>{member.display_name || `@${member.handle}`}</h1><p className="person-sub">@{member.handle}{member.country ? ` • ${countryName(member.country)}` : ""}</p></div>
    </header>
  );
}

export function MemberProfile({ member, lists }: { member: Member; lists: CommunityCollection[] }) {
  return (
    <div className="page member-page">
      <MemberHead member={member} />
      {member.bio && <p className="showcase-bio">{member.bio.split(/\n+/)[0]}</p>}
      <ProfileTabs tabs={["Watchlist", "Following", "About"]} active={0} />
      <ul className="collection-list">{lists.map((c) => <CommunityTile key={c.id} c={c} showOwner={false} plain />)}</ul>
    </div>
  );
}

export function MemberCommunity({ member, lists, directors }: { member: Member; lists: CommunityCollection[]; directors: Director[] }) {
  return (
    <div className="page member-page">
      <MemberHead member={member} />
      <ProfileTabs tabs={["Watchlist", "Following", "About"]} active={1} />
      <h2 className="showcase-subhead">Directors</h2>
      <ul className="director-grid">{directors.map((d) => <DirectorCard key={d.id} director={toDirectorSummary(d)} plain />)}</ul>
      <h2 className="showcase-subhead">Watchlists</h2>
      <ul className="collection-list">{lists.map((c) => <CommunityTile key={c.id} c={c} plain />)}</ul>
    </div>
  );
}

/** An example of a conversation on a watchlist. The comments are samples, not real members. */
export function MemberConversation({ list, leo, comments }: {
  list: CommunityCollection; leo: Member | null;
  comments: { handle: string; name: string; body: string; when: string; likes: number; replies?: { handle: string; name: string; body: string; when: string; likes: number; leo?: boolean }[] }[];
}) {
  const Avatar = ({ name, isLeo }: { name: string; isLeo?: boolean }) => isLeo && leo ? <UserAvatar person={leo} className="comment-avatar" /> : <span className="comment-avatar portrait-initials" aria-hidden="true">{initials(name)}</span>;
  const Comment = ({ c, isLeo }: { c: { handle: string; name: string; body: string; when: string; likes: number }; isLeo?: boolean }) => (
    <div className="comment">
      <Avatar name={c.name} isLeo={isLeo} />
      <div className="comment-main">
        <div className="comment-head"><span className="comment-name">{c.name}</span><span className="comment-time">@{c.handle} • {c.when}</span></div>
        <p className="comment-body">{c.body.split(/(@[a-z0-9_]+)/i).map((part, i) => part.startsWith("@") ? <span key={i} className="mention">{part}</span> : part)}</p>
        <div className="comment-actions"><span className="comment-act"><Icon name="heart" />{c.likes}</span><span className="comment-act"><Icon name="reply" />Reply</span></div>
      </div>
    </div>
  );
  return (
    <div className="page">
      <WatchlistHead list={list} />
      <section className="comments">
        <div className="comments-head"><h2>Comments <span className="comments-count">{comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)}</span></h2></div>
        <div className="composer"><span className="muted">Add a comment…</span></div>
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.body} className="thread">
              <Comment c={c} />
              {c.replies && <ul className="replies">{c.replies.map((r) => <li key={r.body}><Comment c={r} isLeo={r.leo} /></li>)}</ul>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
