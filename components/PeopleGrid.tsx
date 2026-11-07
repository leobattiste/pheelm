"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { initials } from "@/lib/format";
import type { PersonInfo } from "@/lib/roles";
import PersonDetails from "./PersonDetails";
import Icon from "@/components/Icon";

export type PersonEntry = { info: PersonInfo; role: string };

/**
 * People with their photo, name and role. Directors go to their page; everyone else opens a sheet
 * with their details, so the film stays where it was.
 */
export default function PeopleGrid({ people }: { people: PersonEntry[] }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<PersonInfo | null>(null);

  const show = (info: PersonInfo) => {
    setOpen(info);
    requestAnimationFrame(() => sheet.current?.showModal());
  };

  return (
    <>
      <ul className="cast">
        {people.map(({ info, role }) => {
          const body = (
            <>
              {info.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="cast-photo" src={info.photo_url} alt="" loading="lazy" />
              ) : (
                <span className="cast-photo" aria-hidden="true">{initials(info.name)}</span>
              )}
              <span className="cast-text">
                <span className="cast-name">{info.name}</span>
                <span className="cast-role">{role}</span>
              </span>
            </>
          );
          return (
            <li key={info.id}>
              {info.isDirector ? (
                <Link href={`/directors/${info.slug}`}>{body}</Link>
              ) : (
                <button type="button" onClick={() => show(info)} aria-haspopup="dialog">{body}</button>
              )}
            </li>
          );
        })}
      </ul>

      <dialog
        ref={sheet}
        className="modal person-sheet"
        aria-labelledby={open ? `person-${open.id}` : undefined}
        onClose={() => setOpen(null)}
        onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}
      >
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <span />
          <button type="button" className="icon-button" onClick={() => sheet.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{open && <PersonDetails info={open} />}</div>
      </dialog>
    </>
  );
}
