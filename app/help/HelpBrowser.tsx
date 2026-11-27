"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { HELP_CATEGORIES, type HelpQuestion } from "./help-content";

type HelpEntry = HelpQuestion & { category: string; categoryTitle: string };

const ALL_QUESTIONS: HelpEntry[] = HELP_CATEGORIES.flatMap((group) =>
  group.questions.map((question) => ({
    ...question,
    category: group.id,
    categoryTitle: group.title,
  })),
);
const QUESTION_BY_ID = new Map(ALL_QUESTIONS.map((question) => [question.id, question]));

export default function HelpBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const pendingScroll = useRef<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return ALL_QUESTIONS.filter((question) => {
      if (category !== "all" && question.category !== category) return false;
      if (!words.length) return true;
      const searchable = (question.categoryTitle + " " + question.question + " " + question.answer).toLocaleLowerCase();
      return words.every((word) => searchable.includes(word));
    });
  }, [query, category]);

  const resetHash = () => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  const clearSearch = () => {
    setQuery("");
    setCategory("all");
    setOpen(null);
    resetHash();
    searchInput.current?.focus();
  };

  const selectCategory = (id: string) => {
    setCategory(id);
    setOpen(null);
    window.history.replaceState(null, "", window.location.pathname + window.location.search + (id === "all" ? "" : "#" + id));
  };

  const toggleQuestion = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    window.history.replaceState(null, "", window.location.pathname + window.location.search + (next ? "#" + next : ""));
  };

  // Keep existing /help#category links working and make every /help#question-id a direct link.
  useEffect(() => {
    const syncHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const question = QUESTION_BY_ID.get(id);
      if (question) {
        pendingScroll.current = id;
        setQuery("");
        setCategory("all");
        setOpen(id);
      } else if (HELP_CATEGORIES.some((group) => group.id === id)) {
        pendingScroll.current = null;
        setQuery("");
        setCategory(id);
        setOpen(null);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

  useEffect(() => {
    const target = pendingScroll.current;
    if (target && open === target && document.getElementById(target)) {
      document.getElementById(target)?.scrollIntoView({ block: "center" });
      pendingScroll.current = null;
    }
  }, [open, category, query]);

  const renderQuestion = (item: HelpEntry, showCategory = false) => (
    <div key={item.id} className="help-item" id={item.id}>
      {showCategory && <p className="help-result-category">{item.categoryTitle}</p>}
      <h3>
        <button type="button" aria-expanded={open === item.id} aria-controls={"help-answer-" + item.id} onClick={() => toggleQuestion(item.id)}>
          <span>{item.question}</span>
          <Icon name={open === item.id ? "close" : "plus"} size={19} />
        </button>
      </h3>
      {open === item.id && (
        <div className="help-answer" id={"help-answer-" + item.id}>
          <p>{item.answer}</p>
          <div className="help-answer-actions">
            <Link href={item.href}>{item.linkLabel}<Icon name="arrowRight" size={17} /></Link>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="help-browser">
      <div className="toolbar catalog-toolbar help-toolbar">
        <div className="catalog-search-control">
          <form className="search-bar" role="search" onSubmit={(event) => event.preventDefault()}>
            <Icon name="search" />
            <label htmlFor="help-q" className="visually-hidden">Search for help</label>
            <input
              ref={searchInput}
              id="help-q"
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setOpen(null); resetHash(); }}
              placeholder="Search for help"
              autoComplete="off"
            />
            {query && <button type="button" className="catalog-clear-query" aria-label="Clear search" onClick={clearSearch}><Icon name="close" /></button>}
          </form>
        </div>
        <button
          type="button"
          className={"button ghost filter-button" + (category !== "all" ? " has-count" : "")}
          aria-haspopup="dialog"
          aria-controls="help-filters"
          aria-expanded={filtersOpen}
          onClick={() => { setFiltersOpen(true); filterDialog.current?.showModal(); }}
        >
          <Icon name="filter" />
          <span className="filter-label">Filters</span>
          {category !== "all" && <span className="badge" aria-label="1 active filter">1</span>}
        </button>
      </div>

      {(searching || category !== "all") && (
        <div className="help-results-head">
          <p className="muted help-count" aria-live="polite">
            {searching ? results.length + (results.length === 1 ? " answer found" : " answers found") : results.length + (results.length === 1 ? " answer" : " answers")}
          </p>
          <button type="button" className="help-reset" onClick={clearSearch}>Clear</button>
        </div>
      )}

      {results.length === 0 ? (
        <section className="empty-state" aria-live="polite">
          <h2>No answers found</h2>
          <p className="muted">Try another search or browse all topics.</p>
          <button type="button" className="button ghost small" onClick={clearSearch}>Browse all topics</button>
        </section>
      ) : searching ? (
        <section className="help-group" aria-label="Search results">
          <div className="help-questions">{results.map((item) => renderQuestion(item, true))}</div>
        </section>
      ) : (
        HELP_CATEGORIES.filter((group) => category === "all" || group.id === category).map((group) => (
          <section key={group.id} className="help-group" aria-labelledby={"help-heading-" + group.id}>
            <h2 id={"help-heading-" + group.id}>{group.title}</h2>
            <div className="help-questions">
              {group.questions.map((question) => {
                const item = QUESTION_BY_ID.get(question.id);
                return item ? renderQuestion(item) : null;
              })}
            </div>
          </section>
        ))
      )}

      <dialog
        ref={filterDialog}
        id="help-filters"
        className="modal catalog-filter-dialog"
        aria-labelledby="help-filters-title"
        onClose={() => setFiltersOpen(false)}
        onClick={(event) => { if (event.target === filterDialog.current) filterDialog.current?.close(); }}
      >
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="help-filters-title">Filters</h2>
          <button type="button" className="icon-button" aria-label="Close filters" onClick={() => filterDialog.current?.close()}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <fieldset className="filter-field feed-choice">
            <legend>Topic</legend>
            <div className="chip-row filter-choices">
              {[{ id: "all", title: "All topics" }, ...HELP_CATEGORIES].map((group) => (
                <button key={group.id} type="button" className="button ghost" aria-pressed={category === group.id} onClick={() => selectCategory(group.id)}>
                  {group.title}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" disabled={category === "all"} onClick={() => selectCategory("all")}>Reset</button>
          <button type="button" className="button" onClick={() => filterDialog.current?.close()}>
            Show {results.length} {results.length === 1 ? "answer" : "answers"}
          </button>
        </div>
      </dialog>

    </div>
  );
}
