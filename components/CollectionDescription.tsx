"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/**
 * A collection's description, shown to three lines. When there's more (curators can write whole
 * essays), "Read more" opens the full text in a sheet, paragraphs and all.
 */
export default function CollectionDescription({ title, text }: { title: string; text: string }) {
  const lead = useRef<HTMLParagraphElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const [long, setLong] = useState(false);

  useEffect(() => {
    const el = lead.current;
    if (!el) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 1);
    check();
    const watch = new ResizeObserver(check);
    watch.observe(el);
    return () => watch.disconnect();
  }, [text]);

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="collection-about">
      <p ref={lead} className="lead clamp-3">{text}</p>
      {long && (
        <button type="button" className="button ghost small" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
          Read more
        </button>
      )}
      <dialog ref={modal} className="modal essay-modal" aria-labelledby="about-title" onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="about-title">{title}</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body essay">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </dialog>
    </div>
  );
}
