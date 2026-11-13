"use client";

import { useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import { toast } from "./Toast";
import { openSignIn } from "./SignInSheet";

const REASONS = ["Spam or advertising", "Offensive or hateful", "Not about films by Black directors", "Something else"];

/** A quiet "Report" link that lets members flag a community collection for the admins. */
export default function ReportCollection({ listId }: { listId: string }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = getBrowserClient();
    if (!db) return setState("error");
    // Reports come from members, so one person can't flood the admins.
    const { data: { session } } = await db.auth.getSession();
    if (!session) { sheet.current?.close(); toast("Sign in to report a watchlist."); openSignIn("signin"); return; }
    setState("sending");
    const { error } = await db.from("list_reports").insert({ list_id: listId, reason: [reason, detail.trim()].filter(Boolean).join(": ").slice(0, 500) });
    setState(error ? "error" : "sent");
    if (error) toast.error("That didn’t send. Try again.");
    else { toast.success("Thanks, we’ll take a look"); sheet.current?.close(); }
  };

  return (
    <>
      <button type="button" className="button ghost" onClick={() => sheet.current?.showModal()}>
        <Icon name="flag" />
        Report
      </button>
      <dialog ref={sheet} className="modal" aria-labelledby="report-title" onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="report-title">Report this watchlist</h2>
          <button type="button" className="icon-button" onClick={() => sheet.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          {state === "sent" ? (
            <p className="notice ok" role="status">Thanks. We&rsquo;ll take a look.</p>
          ) : (
            <form onSubmit={send} className="form report-form">
              <fieldset className="report-reasons">
                <legend className="visually-hidden">Reason</legend>
                {REASONS.map((r) => (
                  <label key={r} className="check"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {r}</label>
                ))}
              </fieldset>
              <label className="field">Anything to add? <span className="hint">optional</span><textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={400} /></label>
              {state === "error" && <p className="notice error" role="alert">That didn&rsquo;t send. Try again.</p>}
              <div className="actions"><button className="button" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send report"}</button></div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
