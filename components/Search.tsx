"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Navigate to the full search page from existing search buttons and integrations. */
export const openSearch = (query?: string) => {
  if (typeof window === "undefined") return false;
  return window.dispatchEvent(new CustomEvent("open-search", { detail: { q: query } }));
};

/** Keeps the global search shortcuts without rendering a second search interface. */
export default function Search() {
  const router = useRouter();

  useEffect(() => {
    const open = (event?: Event) => {
      const detail = (event as CustomEvent<{ q?: unknown; query?: unknown } | string> | undefined)?.detail;
      const value = typeof detail === "string" ? detail : detail?.q ?? detail?.query;
      const explicit = typeof value === "string" ? value : undefined;
      if (window.location.pathname === "/search" && explicit === undefined) {
        const input = document.querySelector<HTMLInputElement>('main input[type="search"]');
        input?.focus();
        input?.select();
        return;
      }
      // Carry a query across from the film/director browsers when opening global search.
      const current = /^\/(films|directors|search)\/?$/.test(window.location.pathname)
        ? new URLSearchParams(window.location.search).get("q") ?? ""
        : "";
      const query = (explicit ?? current).trim().slice(0, 200);
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      try { sessionStorage.setItem("pheelm:search-focus", "1"); } catch {}
      router.push(params.size ? `/search?${params}` : "/search");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey) return;
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
      const command = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !typing;
      if (!command && !slash) return;
      event.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-search", open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-search", open);
    };
  }, [router]);

  return null;
}
