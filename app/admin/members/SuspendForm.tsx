"use client";

import { useActionState } from "react";
import { restoreMember, suspendMember } from "./actions";
import { useResultToast } from "@/components/Toast";

/** Suspend with a reason (and optionally hide their watchlists), or lift a suspension. */
export default function SuspendForm({ id, suspended, name }: { id: string; suspended: boolean; name: string }) {
  const [state, action, pending] = useActionState(suspended ? restoreMember : suspendMember, null);
  useResultToast(state);
  return (
    <form action={action} className="form">
      <input type="hidden" name="id" value={id} />
      {suspended ? (
        <p className="muted">{name} can&apos;t sign in or post. Restoring lets them back in.</p>
      ) : (
        <>
          <p className="muted">Suspending stops {name} from signing in, commenting, liking, changing watchlists and submitting films. Nothing is deleted.</p>
          <label className="field">Reason <span className="field-hint">Only admins see this</span>
            <textarea name="reason" rows={2} maxLength={500} />
          </label>
          <label className="check"><input type="checkbox" name="hide_watchlists" /> Also hide their public watchlists</label>
        </>
      )}
      <div className="actions">
        <button className={suspended ? "button small" : "button small danger"} disabled={pending}>
          {pending ? "Saving…" : suspended ? "Restore member" : "Suspend member"}
        </button>
      </div>
    </form>
  );
}
