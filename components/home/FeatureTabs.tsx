"use client";

import { useRef, useState, type KeyboardEvent } from "react";

export type HomeFeature = {
  id: string; title: string; intro: string; alt: string; shot: string;
  features: { title: string; text: string }[];
};

/**
 * "Inside Pheelm" on the home page: the four parts of Pheelm as tabs. Choosing one shows a
 * screenshot of the real page (in the visitor's theme) and three things you can do there.
 * Phones get a row of pills above the picture; wide screens a list beside it, with the open
 * part's one-line intro. Screenshots live in public/home (scripts/capture-home-screenshots.mjs).
 */
export default function FeatureTabs({ features }: { features: HomeFeature[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs, as in any tab list; Home and End jump to the ends.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = features.length - 1;
    const next = { ArrowRight: active + 1, ArrowDown: active + 1, ArrowLeft: active - 1, ArrowUp: active - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const i = (next + features.length) % features.length;
    setActive(i);
    tabs.current[i]?.focus();
  };

  return (
    <section className="hf" aria-labelledby="hf-title">
      <div className="hf-head">
        <h2 id="hf-title">Inside Pheelm</h2>
        <p>Four ways to discover, save and share films by Black directors.</p>
      </div>
      <div className="hf-grid">
        <div className="hf-tabs" role="tablist" aria-label="Parts of Pheelm" onKeyDown={onKey}>
          {features.map((f, i) => (
            <button
              key={f.id} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" className="hf-tab"
              id={`hf-tab-${f.id}`} aria-selected={i === active} aria-controls={`hf-panel-${f.id}`} tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
            >
              <span className="hf-tab-title">{f.title}</span>
              <span className="hf-tab-intro">{f.intro}</span>
            </button>
          ))}
        </div>
        <div className="hf-panels">
          {features.map((f, i) => (
            <div key={f.id} role="tabpanel" className="hf-panel" id={`hf-panel-${f.id}`} aria-labelledby={`hf-tab-${f.id}`} hidden={i !== active}>
              <p className="hf-panel-intro">{f.intro}</p>
              <figure className="hf-stage">
                <img className="shot-dark" src={`/home/${f.shot}-dark.webp`} alt={f.alt} width={1600} height={1600} loading="lazy" decoding="async" />
                <img className="shot-light" src={`/home/${f.shot}-light.webp`} alt={f.alt} width={1600} height={1600} loading="lazy" decoding="async" />
              </figure>
              <ul className="hf-list">
                {f.features.map((x) => (
                  <li key={x.title} className="hf-item">
                    <h3>{x.title}</h3>
                    <p>{x.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
