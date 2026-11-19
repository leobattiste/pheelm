/**
 * Loading placeholders built from the real card markup (film-grid, director-grid, collection-list,
 * rows), so they take the same size and follow the grid switch. Every block pulses gently.
 */
const B = "profile-skeleton-block";
const n = (count: number) => Array.from({ length: count }, (_, i) => i);

export function Line({ short, wide, className = "" }: { short?: boolean; wide?: boolean; className?: string }) {
  return <span className={`${B} skeleton-line${short ? " is-short" : ""}${wide ? " is-wide" : ""} ${className}`.trim()} />;
}

/** The search bar and filter button. */
export function ToolbarSkeleton({ filter = true }: { filter?: boolean }) {
  return (
    <div className="toolbar catalog-toolbar skeleton-toolbar" aria-hidden="true">
      <span className={`${B} skeleton-bar`} />
      {filter && <span className={`${B} skeleton-round`} />}
    </div>
  );
}

export function FilmCardSkeleton() {
  return (
    <li className="film-card">
      <a className="skeleton-card-link">
        <span className={`poster ${B}`} />
        <Line className="film-card-title" />
        <Line short className="film-card-meta" />
      </a>
    </li>
  );
}

export function FilmGridSkeleton({ count = 12 }: { count?: number }) {
  return <ul className="film-grid" aria-hidden="true">{n(count).map((i) => <FilmCardSkeleton key={i} />)}</ul>;
}

export function DirectorCardSkeleton() {
  return (
    <li className="director-card">
      <div className="collection-tile">
        <span className="director-card-head">
          <span className={`portrait ${B}`} />
          <span className="director-card-body"><Line /><Line short /></span>
        </span>
        <span className="collection-fan">{n(3).map((p) => <span key={p} className={`poster ${B}`} />)}</span>
      </div>
    </li>
  );
}

export function DirectorGridSkeleton({ count = 6 }: { count?: number }) {
  return <ul className="director-grid" aria-hidden="true">{n(count).map((i) => <DirectorCardSkeleton key={i} />)}</ul>;
}

export function CollectionListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="collection-list" aria-hidden="true">
      {n(count).map((i) => (
        <li key={i}><div className="collection-tile">
          <Line className="collection-title" /><Line short className="collection-desc" />
          <span className="collection-fan">{n(3).map((p) => <span key={p} className={`poster ${B}`} />)}</span>
        </div></li>
      ))}
    </ul>
  );
}

/** A sideways row with a heading. */
export function RowSkeleton({ count = 6, kind = "film" }: { count?: number; kind?: "film" | "director" }) {
  return (
    <section className="row skeleton-row" aria-hidden="true">
      <div className="row-head"><Line className="skeleton-heading" /></div>
      <div className="row-viewport"><ul className="row-track">
        {n(count).map((i) => (kind === "director" ? <DirectorCardSkeleton key={i} /> : <FilmCardSkeleton key={i} />))}
      </ul></div>
    </section>
  );
}

/** A page title and its intro line. */
export function HeadSkeleton({ lead = true }: { lead?: boolean }) {
  return (
    <header className="page-head skeleton-head" aria-hidden="true">
      <span className={`${B} skeleton-title`} />
      {lead && <><Line wide /><Line /></>}
    </header>
  );
}

/** Paragraphs of text, for written pages and settings. */
export function TextSkeleton({ lines = 8 }: { lines?: number }) {
  return <div className="skeleton-text" aria-hidden="true">{n(lines).map((i) => <Line key={i} short={i % 4 === 3} wide={i % 4 !== 3} />)}</div>;
}

/** Wraps a skeleton so screen readers hear one "Loading" instead of empty shapes. */
export function Loading({ label, className = "page", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`${className} skeleton-page`} aria-busy="true" aria-label={label}>
      <p className="visually-hidden" role="status">Loading {label.toLowerCase()}</p>
      {children}
    </section>
  );
}

export function FilmPageSkeleton() {
  return (
    <Loading label="Film" className="film-page">
      <div className="film-art" aria-hidden="true"><span className={`poster ${B}`} /></div>
      <div className="film-body" aria-hidden="true">
        <div className="film-head">
          <span className={`${B} skeleton-title is-big`} />
          <Line short />
        </div>
        <div className="skeleton-pills">{n(3).map((i) => <span key={i} className={`${B} skeleton-pill`} />)}</div>
        <TextSkeleton lines={6} />
        <RowSkeleton count={4} />
      </div>
    </Loading>
  );
}

export function PersonPageSkeleton() {
  return (
    <Loading label="Director" className="page profile">
      <div className="person-head" aria-hidden="true">
        <span className={`portrait ${B}`} />
        <div className="person-text"><span className={`${B} skeleton-title`} /><Line short /></div>
      </div>
      <FilmGridSkeleton count={8} />
    </Loading>
  );
}

export function WatchlistPageSkeleton() {
  return (
    <Loading label="Watchlist">
      <HeadSkeleton />
      <FilmGridSkeleton count={12} />
    </Loading>
  );
}

export function AdminSkeleton() {
  return (
    <div className="skeleton-page admin-skeleton" aria-busy="true" aria-label="Admin">
      <p className="visually-hidden" role="status">Loading</p>
      <div aria-hidden="true">
        <span className={`${B} skeleton-title`} />
        <div className="admin-panel">{n(8).map((i) => <div key={i} className="admin-row"><span className="admin-row-main"><Line /><Line short /></span></div>)}</div>
      </div>
    </div>
  );
}
