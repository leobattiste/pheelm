"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "pheelm:install-dismissed";
const WAIT_MS = 6000;
const QUIET_DAYS = 30;
// Pages where a banner would get in the way.
const SKIP = /^\/(admin|login|auth|account|offline)(\/|$)/;

/**
 * Registers the service worker, and on phones, a few seconds after someone arrives, offers to add
 * Pheelm to their home screen: Android gets the browser's own install prompt, iPhone and iPad a
 * line on how to do it from the Share menu. Closing it keeps it away for a month; it never shows
 * once Pheelm is installed.
 */
export default function InstallBanner() {
  const path = usePathname();
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [showHow, setShowHow] = useState(false);
  const prompt = useRef<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const phone = window.matchMedia("(pointer: coarse) and (max-width: 899px)").matches;
    if (standalone || !phone || SKIP.test(path)) return;
    try {
      const last = Number(localStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < QUIET_DAYS * 24 * 60 * 60 * 1000) return;
    } catch {}

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      prompt.current = e as InstallEvent;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const timer = window.setTimeout(() => {
      if (ios) setMode("ios");
      else if (prompt.current) setMode("android");
    }, WAIT_MS);
    const onInstalled = () => setMode(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [path]);

  const close = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    setMode(null);
  };

  const install = async () => {
    if (mode === "ios") { setShowHow(true); return; }
    const e = prompt.current;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    prompt.current = null;
    if (outcome === "accepted") setMode(null);
    else close();
  };

  if (!mode) return null;

  return (
    <aside className="install-banner" role="dialog" aria-label="Add Pheelm to your home screen">
      <img className="install-icon" src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="install-text">
        <strong>Add Pheelm to your home screen</strong>
        {showHow ? (
          <span>
            Tap <IosShare /> <b>Share</b>, then <b>Add to Home Screen</b>.
          </span>
        ) : (
          <span>Open it like an app, full screen and quicker.</span>
        )}
      </div>
      {!showHow && <button type="button" className="button small" onClick={install}>{mode === "ios" ? "How" : "Install"}</button>}
      <button type="button" className="icon-button install-close" onClick={close} aria-label="Not now">
        <Icon name="close" />
      </button>
    </aside>
  );
}

/** The iPhone's Share symbol (a box with an arrow out of it), so the step looks like the button. */
function IosShare() {
  return (
    <svg className="install-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 14.5V3M8.5 6.5 12 3l3.5 3.5M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}
