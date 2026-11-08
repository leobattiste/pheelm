"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

/** A floating scroll control, leaving movie pages to their action bar. */
export default function BackToTop() {
  const path = usePathname();
  const movie = /^\/films\/[^/]+/.test(path);
  const [shownOn, setShownOn] = useState<string | null>(null);

  useEffect(() => {
    if (movie) return;
    const update = () => setShownOn(window.scrollY > 160 ? path : null);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [path, movie]);

  if (movie || shownOn !== path) return null;

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
