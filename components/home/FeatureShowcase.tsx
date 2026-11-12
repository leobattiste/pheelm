"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon";

export type Feature = { title: string; text: string; icon: IconName; path: string; screen: ReactNode; example?: boolean };

/** Widths the miniature pages are laid out at before being scaled into the frame. */
const DESKTOP = 1180;
const PHONE = 430;

/**
 * One part of Pheelm: three things you can do, and a miniature of the real page for the one
 * that's selected. The miniatures are the site's own components with real data, scaled down,
 * and inert: nothing in them can be clicked or focused.
 */
export default function FeatureShowcase({ label, features }: { label: string; features: Feature[] }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const [width, setWidth] = useState(DESKTOP);
  const frame = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  // Lay the page out at a desktop or phone width, then scale it to the frame.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const page = w < 560 ? PHONE : DESKTOP;
      setWidth(page);
      setZoom(w / page);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const select = (i: number) => {
    const next = (i + features.length) % features.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); select(active + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); select(active - 1); }
    else if (e.key === "Home") { e.preventDefault(); select(0); }
    else if (e.key === "End") { e.preventDefault(); select(features.length - 1); }
  };

  return (
    <div className="showcase">
      <div className="showcase-tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
        {features.map((f, i) => (
          <button
            key={f.title}
            ref={(el) => { tabs.current[i] = el; }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-panel`}
            tabIndex={i === active ? 0 : -1}
            className="showcase-tab"
            onClick={() => setActive(i)}
          >
            <Icon name={f.icon} />
            <span className="showcase-tab-text">
              <strong>{f.title}</strong>
              <span>{f.text}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="showcase-frame" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`}>
        <div className="showcase-bar"><span aria-hidden="true">pheelm.com{features[active].path}</span>{features[active].example && <span className="status-pill">Example</span>}</div>
        <div className="showcase-viewport" ref={frame}>
          {features.map((f, i) => (
            <div
              key={f.title}
              className="showcase-screen"
              data-active={i === active || undefined}
              aria-hidden={i !== active}
              inert
              style={{ width, zoom: zoom ?? undefined, visibility: zoom === null ? "hidden" : undefined }}
            >
              {f.screen}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
