export default function LoadingSearch() {
  return (
    <section className="page unified-search-page" aria-busy="true">
      <header className="page-head">
        <h1>Search</h1>
        <p className="muted" role="status">Loading films, directors, watchlists and members…</p>
      </header>
    </section>
  );
}
