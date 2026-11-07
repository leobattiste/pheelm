"use client";

import { useRef } from "react";
import Icon from "@/components/Icon";

/** Plays the trailer in a full-screen player that closes with Escape or a click outside. */
export default function TrailerButton({ embed, title, className = "button play", label = "Play trailer", action, iconOnly = false }: { embed: string; title: string; className?: string; label?: string; action?: string; iconOnly?: boolean }) {
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
      <button type="button" className={className} onClick={open} data-action={action} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}>
        <Icon name="play" className="solid" />
        {!iconOnly && label}
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
