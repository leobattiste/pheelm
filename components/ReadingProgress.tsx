"use client";

import { useEffect, useRef } from "react";

/** A thin line under the header that fills as you read the essay. */
export default function ReadingProgress({ target = ".essay" }: { target?: string }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const start = window.innerHeight * 0.6;
      const total = r.height + start - window.innerHeight * 0.25;
      const done = Math.min(1, Math.max(0, (start - r.top) / total));
      bar.current?.style.setProperty("--progress", String(done));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return <div ref={bar} className="reading-progress" aria-hidden="true" />;
}
