"use client";

import { useRef } from "react";

/** Plays the trailer in a full-screen player that closes with Escape or a click outside. */
export default function TrailerButton({ embed, title, className = "button play", label = "Play trailer" }: { embed: string; title: string; className?: string; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const open = () => {
    if (frame.current) frame.current.src = `${embed}${embed.includes("?") ? "&" : "?"}autoplay=1`;
    dialog.current?.showModal();
  };
  const close = () => {
    dialog.current?.close();
  };

  return (
    <>
      <button type="button" className={className} onClick={open}>
        <svg className="solid" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4.5v11l9-5.5z" /></svg>
        {label}
      </button>
      <dialog
        ref={dialog}
        className="trailer-dialog"
        aria-label={`${title} trailer`}
        onClose={() => {
          // Stop the video when the player closes.
          if (frame.current) frame.current.src = "about:blank";
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="trailer-frame">
          <iframe ref={frame} title={`${title} trailer`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        </div>
        <button type="button" className="trailer-close" onClick={close}>Close</button>
      </dialog>
    </>
  );
}
