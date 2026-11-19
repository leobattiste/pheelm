"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";

/** "Show all" under a film's first awards: every win and nomination in a sheet. */
export default function AwardsDialog({ total, title, children }: { total: number; title: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="button ghost small awards-all" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={() => { setOpen(true); dialog.current?.showModal(); }}>
        Show all {total}
      </button>
      <dialog ref={dialog} id={id} className="modal awards-dialog" aria-labelledby={id + "-title"} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id={id + "-title"}>{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
      </dialog>
    </>
  );
}
