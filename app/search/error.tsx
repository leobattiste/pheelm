"use client";

export default function SearchError({ reset }: { reset: () => void }) {
  return (
    <section className="page unified-search-page">
      <header className="page-head">
        <h1>Search couldn’t load</h1>
        <p className="lead">Please try again in a moment.</p>
      </header>
      <button type="button" className="button" onClick={reset}>Try again</button>
    </section>
  );
}
