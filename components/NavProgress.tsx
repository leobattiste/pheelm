"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Shows that something is loading: the top edge of the menu bar fills with a white line from left
 * to right, at the same weight as its border. It starts when someone taps a link to another page,
 * or while the site waits on its server (a page loading, a save, any action), and finishes when the
 * new page is in place or the server has answered. The line itself is <NavProgressLine /> (its own
 * file, so bars can include it without this controller); this only sets html[data-nav].
 */
export default function NavProgress() {
  return <Suspense fallback={null}><Controller /></Suspense>;
}

let pending = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let safety: ReturnType<typeof setTimeout> | null = null;

function start() {
  const root = document.documentElement;
  if (hideTimer) clearTimeout(hideTimer);
  if (safety) clearTimeout(safety);
  root.dataset.nav = "loading";
  // Never leave the line hanging if something goes quiet.
  safety = setTimeout(done, 15000);
}

function done() {
  const root = document.documentElement;
  if (root.dataset.nav !== "loading") return;
  if (safety) clearTimeout(safety);
  root.dataset.nav = "done";
  hideTimer = setTimeout(() => { if (root.dataset.nav === "done") delete root.dataset.nav; }, 650);
}

/** True for the requests Next makes for a page or an action, not for prefetching. */
function isNextRequest(input: RequestInfo | URL, init?: RequestInit) {
  const read = (name: string) => {
    const h = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    if (!h) return null;
    if (h instanceof Headers) return h.get(name);
    if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? null;
    const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? (h as Record<string, string>)[key] : null;
  };
  if (read("next-router-prefetch")) return false;
  return !!(read("next-action") || read("rsc"));
}

function Controller() {
  const path = usePathname();
  const search = useSearchParams().toString();

  // A new page is in place.
  useEffect(() => { done(); }, [path, search]);

  useEffect(() => {
    // Taps on links to another page on Pheelm.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    document.addEventListener("click", onClick);

    // Waiting on the server: pages, saves and other actions.
    const original = window.fetch;
    let wait: ReturnType<typeof setTimeout> | null = null;
    window.fetch = async (input, init) => {
      if (!isNextRequest(input, init)) return original(input, init);
      pending++;
      // Quick answers don't flash the line.
      if (!wait && document.documentElement.dataset.nav !== "loading") wait = setTimeout(() => { wait = null; if (pending > 0) start(); }, 150);
      try {
        return await original(input, init);
      } finally {
        pending = Math.max(0, pending - 1);
        if (!pending) {
          if (wait) { clearTimeout(wait); wait = null; }
          done();
        }
      }
    };
    return () => { document.removeEventListener("click", onClick); window.fetch = original; };
  }, []);

  return null;
}
