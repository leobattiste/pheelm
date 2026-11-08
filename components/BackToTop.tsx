"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

export function BackToTopButton() {
  const top = () => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" });
    // The control disappears at the top; leave keyboard focus at the page content.
    document.querySelector<HTMLElement>("#main")?.focus({ preventScroll: true });
  };

  return (
    <button type="button" className="back-to-top" onClick={top} aria-label="Back to top" title="Back to top">
      <Icon name="arrowUp" />
    </button>
  );
}

/** A floating scroll control, hidden while the list's own bottom controls are visible. */
export default function BackToTop() {
  const path = usePathname();
  const movie = /^\/films\/[^/]+/.test(path);
  const [shownOn, setShownOn] = useState<string | null>(null);

  useEffect(() => {
    if (movie) return;
    const update = () => {
      const bottom = document.querySelector(".pagination-controls")?.getBoundingClientRect();
      const visible = bottom && bottom.top < window.innerHeight && bottom.bottom > 0;
      setShownOn(window.scrollY > 160 && !visible ? path : null);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    const main = document.querySelector("#main");
    if (main) observer.observe(main);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [path, movie]);

  if (movie || shownOn !== path) return null;
  return <div className="floating-controls"><BackToTopButton /></div>;
}
