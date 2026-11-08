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

/** Page actions and a round scroll control share the main navigation's width. */
export default function BackToTop() {
  const path = usePathname();
  const movie = /^\/films\/[^/]+/.test(path);
  const [shownOn, setShownOn] = useState<string | null>(null);
  const [more, setMore] = useState<{ path: string; button: HTMLButtonElement | null; disabled: boolean } | null>(null);

  useEffect(() => {
    if (movie) return;
    const update = () => setShownOn(window.scrollY > 160 ? path : null);
    const read = () => {
      const button = document.querySelector<HTMLButtonElement>("#main [data-load-more]");
      const disabled = button?.disabled ?? false;
      setMore(previous => previous?.path === path && previous.button === button && previous.disabled === disabled ? previous : { path, button, disabled });
    };
    update();
    read();
    window.addEventListener("scroll", update, { passive: true });
    const observer = new MutationObserver(read);
    const main = document.querySelector("#main");
    if (main) observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    return () => { window.removeEventListener("scroll", update); observer.disconnect(); };
  }, [path, movie]);

  if (movie || shownOn !== path) return null;
  const source = more?.path === path ? more : null;

  return (
    <div className="floating-controls">
      {source?.button && <button type="button" className="floating-load-more" disabled={source.disabled} onClick={() => source.button?.click()}>Load more</button>}
      <BackToTopButton />
    </div>
  );
}
