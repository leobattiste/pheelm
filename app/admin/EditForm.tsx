"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Result = { ok: boolean; message: string };

/**
 * Unsaved-changes tracking for an editor form: `dirty` once anything is typed or picked, clean again
 * after a successful save or Discard. While dirty, leaving the page (a link, the back button, closing
 * the tab) asks first.
 */
export function useUnsaved(state: Result) {
  const form = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [last, setLast] = useState(state);
  // A save that worked: what's on screen is what's saved.
  if (state !== last) {
    setLast(state);
    if (state.ok) setDirty(false);
  }

  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    // Links inside the app don't unload the page, so ask on the click itself.
    const click = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || form.current?.contains(link) || link.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) { e.preventDefault(); e.stopPropagation(); }
    };
    addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);

  const mark = () => setDirty(true);
  return {
    dirty,
    formProps: { ref: form, onInput: mark, onChange: mark },
    discard: () => { form.current?.reset(); setDirty(false); },
  };
}

/** The bar pinned to the bottom of an editor: whether there's anything to save, Discard and Save. */
export function SaveBar({ dirty, pending, onDiscard, saveLabel = "Save", children }: {
  dirty: boolean; pending: boolean; onDiscard: () => void; saveLabel?: string; children?: ReactNode;
}) {
  return (
    <div className={`admin-savebar${dirty ? " is-dirty" : ""}`}>
      <span className="admin-savebar-state" role="status">
        <span className="admin-savebar-dot" aria-hidden="true" />
        {pending ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
      </span>
      <div className="admin-savebar-actions">
        {children}
        {dirty && !pending && <button type="button" className="button ghost small" onClick={onDiscard}>Discard</button>}
        <button type="submit" className="button small" disabled={pending || !dirty}>{pending ? "Saving…" : saveLabel}</button>
      </div>
    </div>
  );
}

/** One titled part of an editor. */
export function FormSection({ id, title, hint, children }: { id: string; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="admin-form-section" id={id} aria-labelledby={`${id}-title`}>
      <header>
        <h2 id={`${id}-title`}>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      <div className="admin-form-body">{children}</div>
    </section>
  );
}

/** Jump links to an editor's sections. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="admin-section-nav" aria-label="Sections">
      {items.map((i) => <a key={i.id} href={`#${i.id}`}>{i.label}</a>)}
    </nav>
  );
}
