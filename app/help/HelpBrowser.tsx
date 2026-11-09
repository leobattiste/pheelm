"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { HELP_CATEGORIES } from "./help-content";

export default function HelpBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const questionCount = HELP_CATEGORIES.reduce((sum, group) => sum + group.questions.length, 0);
  const results = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return HELP_CATEGORIES.map((group) => ({
      ...group,
      questions: (category === "all" || group.id === category ? group.questions : []).filter((item) => {
        const content = (group.title + " " + item.question + " " + item.answer).toLocaleLowerCase();
        return terms.every((term) => content.includes(term));
      }),
    })).filter((group) => group.questions.length > 0);
  }, [query, category]);
  const total = results.reduce((sum, group) => sum + group.questions.length, 0);
  const select = (id: string) => { setCategory(id); setOpen(null); setShowAll(false); };
  useEffect(() => {
    const sync = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      for (const group of HELP_CATEGORIES) {
        if (group.id === id) { setCategory(id); setQuery(""); setOpen(null); setShowAll(false); return; }
        if (group.questions.some((question) => question.id === id)) {
          setCategory(group.id); setQuery(""); setShowAll(true); setOpen(id);
          window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "center" }), 20);
          return;
        }
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return (
    <div className="help-browser">
      <div className="help-search">
        <Icon name="search" size={21} />
        <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(true); setOpen(null); }} placeholder="Search help articles" aria-label="Search help articles" />
        {query && <button type="button" className="help-clear" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="close" size={18} /></button>}
      </div>
      <div className="help-categories" role="group" aria-label="Help topics">
        <button type="button" className="chip" aria-pressed={category === "all"} onClick={() => select("all")}>All topics</button>
        {HELP_CATEGORIES.map((group) => (
          <button type="button" key={group.id} className="chip" aria-pressed={category === group.id} onClick={() => select(group.id)}>{group.title}</button>
        ))}
      </div>
      <p className="muted help-count" aria-live="polite">{query || category !== "all" ? `${total} ${total === 1 ? "answer" : "answers"} found` : `${questionCount} answers across ${HELP_CATEGORIES.length} topics`}</p>
      {results.length ? results.map((group) => {
        const visible = query || category !== "all" || showAll ? group.questions : group.questions.slice(0, 4);
        return (
          <section key={group.id} className="help-group" aria-labelledby={`help-heading-${group.id}`}>
            <h2 id={`help-heading-${group.id}`}>{group.title}</h2>
            <div className="help-questions">
              {visible.map((item) => (
                <div key={item.id} className="help-item" id={item.id}>
                  <h3>
                    <button type="button" aria-expanded={open === item.id} aria-controls={`help-answer-${item.id}`} onClick={() => { const next = open === item.id ? null : item.id; setOpen(next); if (next) history.replaceState(null, "", `#${next}`); }}>
                      <span>{item.question}</span><Icon name={open === item.id ? "close" : "plus"} size={19} />
                    </button>
                  </h3>
                  {open === item.id && <div className="help-answer" id={`help-answer-${item.id}`}>
                    <p>{item.answer}</p>
                    <Link href={item.href}>Go to related page <Icon name="arrowRight" size={17} /></Link>
                  </div>}
                </div>
              ))}
            </div>
            {!query && category === "all" && !showAll && group.questions.length > 4 && <button type="button" className="help-more" onClick={() => select(group.id)}>View all {group.questions.length} questions <Icon name="arrowRight" size={17} /></button>}
          </section>
        );
      }) : (
        <section className="empty-state" aria-live="polite"><h2>No answers found</h2><p className="muted">Try a different search or browse all topics.</p><button className="button ghost small" type="button" onClick={() => { setQuery(""); select("all"); }}>Browse all topics</button></section>
      )}
      {category === "all" && !query && !showAll && <button className="button ghost help-all" type="button" onClick={() => setShowAll(true)}>Show all {questionCount} questions</button>}
      {category !== "all" && !query && <button className="button ghost help-all" type="button" onClick={() => select("all")}>Back to all topics</button>}
      <section className="help-contact" aria-labelledby="help-contact-heading">
        <h2 id="help-contact-heading">Still need help?</h2>
        <p>Can't find what you're looking for? We can help with questions, technical issues and corrections.</p>
        <div className="actions"><Link className="button" href="/contact">Contact us</Link><Link className="button ghost" href="/feedback">Give feedback</Link></div>
      </section>
    </div>
  );
}
