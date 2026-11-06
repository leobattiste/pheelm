"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import SignInForm from "./SignInForm";

/**
 * Opens the sign-in sheet from anywhere ("Sign in" in the menu, or "Follow", "Save" and
 * "Watchlist" when signed out). Returns false when the sheet isn't on the page, so callers can
 * follow their link instead.
 */
export function openSignIn() {
  if (typeof window === "undefined" || !(window as { __pheelmSignIn?: boolean }).__pheelmSignIn) return false;
  window.dispatchEvent(new Event("open-signin"));
  return true;
}

/** The sign-in sheet, kept in the header so any button on the page can open it. */
export default function SignInSheet() {
  const path = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    (window as { __pheelmSignIn?: boolean }).__pheelmSignIn = true;
    const open = () => sheet.current?.showModal();
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
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
      </div>
      <div className="modal-body">
        <SignInForm next={path || "/"} titleId="signin-title" onDone={() => sheet.current?.close()} />
      </div>
    </dialog>
  );
}
