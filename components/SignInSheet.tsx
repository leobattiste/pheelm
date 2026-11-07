"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SignInForm, { type SignInMode } from "./SignInForm";
import Icon from "@/components/Icon";

/**
 * Opens the sign-in sheet from anywhere ("Sign in" in the menu, or "Follow", "Save" and
 * "Watchlist" when signed out). Returns false when the sheet isn't on the page, so callers can
 * follow their link instead.
 */
export function openSignIn(mode: SignInMode = "signin", next?: string) {
  if (typeof window === "undefined" || !(window as { __pheelmSignIn?: boolean }).__pheelmSignIn) return false;
  window.dispatchEvent(new CustomEvent("open-signin", { detail: { mode, next } }));
  return true;
}

/** The sign-in sheet, kept in the header so any button on the page can open it. */
export default function SignInSheet() {
  const path = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<SignInMode>("signin");
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    (window as { __pheelmSignIn?: boolean }).__pheelmSignIn = true;
    const open = (e: Event) => {
      const d = (e as CustomEvent<{ mode?: SignInMode; next?: string }>).detail ?? {};
      setMode(d.mode === "signup" ? "signup" : "signin");
      setNext(d.next && d.next.startsWith("/") && !d.next.startsWith("//") ? d.next : null);
      if (!sheet.current?.open) sheet.current?.showModal();
    };
    window.addEventListener("open-signin", open);
    return () => { (window as { __pheelmSignIn?: boolean }).__pheelmSignIn = false; window.removeEventListener("open-signin", open); };
  }, []);

  useEffect(() => { sheet.current?.close(); }, [path]);

  return (
    <dialog ref={sheet} className="modal signin-sheet" aria-labelledby="signin-title" onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}>
      <div className="modal-head">
        <span className="sheet-handle" aria-hidden="true" />
        <span />
        <button type="button" className="icon-button" onClick={() => sheet.current?.close()} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">
        <SignInForm key={mode} mode={mode} next={next ?? (path === "/" ? "/films" : path || "/")} titleId="signin-title" onDone={() => sheet.current?.close()} />
      </div>
    </dialog>
  );
}
