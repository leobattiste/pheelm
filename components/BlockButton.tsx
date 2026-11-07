"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";

/**
 * "Block" in a member's profile menu. Blocking stops them commenting on your collections, asking to
 * co-curate or being invited, and notifying you; their comments disappear for you. They aren't told.
 */
export default function BlockButton({ memberId, handle, blocked: initial }: { memberId: string; handle: string; blocked: boolean }) {
  const router = useRouter();
  const modal = useRef<HTMLDialogElement>(null);
  const [blocked, setBlocked] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (block: boolean) => {
    const db = getBrowserClient();
    if (!db) return;
    setBusy(true);
    setError("");
    const { data } = await db.auth.getSession();
    const me = data.session?.user.id;
    if (!me) { setBusy(false); return; }
    const { error: e } = block
      ? await db.from("blocks").insert({ blocker_id: me, blocked_id: memberId })
      : await db.from("blocks").delete().eq("blocker_id", me).eq("blocked_id", memberId);
    setBusy(false);
    if (e) { setError("That didn't go through. Try again."); return; }
    setBlocked(block);
    modal.current?.close();
    router.refresh();
  };

  if (blocked) {
    return (
      <button type="button" className="button ghost" onClick={() => run(false)} disabled={busy}>
        <Icon name="lock" />
        Unblock @{handle}
      </button>
    );
  }

  return (
    <>
      <button type="button" className="button ghost danger-text" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
        <Icon name="lock" />
        Block @{handle}
      </button>
      <dialog ref={modal} className="modal" aria-labelledby={`block-${memberId}`} onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id={`block-${memberId}`}>Block @{handle}?</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <p>They won&rsquo;t be able to comment on your collections, co-curate with you or notify you, and you won&rsquo;t see their comments. They aren&rsquo;t told. You can unblock them any time in Settings.</p>
          {error && <p className="notice error" role="alert">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={() => modal.current?.close()}>Cancel</button>
          <button type="button" className="button danger" onClick={() => run(true)} disabled={busy}>{busy ? "Blocking…" : "Block"}</button>
        </div>
      </dialog>
    </>
  );
}
