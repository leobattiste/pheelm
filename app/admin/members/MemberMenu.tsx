"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useResultToast } from "@/components/Toast";
import AdminMenu from "../AdminMenu";
import { setAdmin } from "../actions";
import { deleteMember } from "./actions";
import SuspendForm from "./SuspendForm";

/** The ⋯ menu on a member's page: make or remove admin, suspend or restore, and delete. */
export default function MemberMenu({ id, name, isAdmin, suspended, canChangeRole, canSuspend, canDelete }: {
  id: string; name: string; isAdmin: boolean; suspended: boolean; canChangeRole: boolean; canSuspend: boolean; canDelete: boolean;
}) {
  const suspend = useRef<HTMLDialogElement>(null);
  const remove = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteMember, null);
  useResultToast(state);
  useEffect(() => { if (state?.ok) { remove.current?.close(); router.replace("/admin/members"); } }, [state, router]);
  if (!canChangeRole && !canSuspend && !canDelete) return null;
  const close = (d: React.RefObject<HTMLDialogElement | null>) => () => d.current?.close();
  return (
    <>
      <AdminMenu label={`Actions for ${name}`}>
        {canChangeRole && (
          <form action={setAdmin}>
            <input type="hidden" name="id" value={id} /><input type="hidden" name="make" value={isAdmin ? "false" : "true"} />
            <button className="admin-menu-item"><Icon name={isAdmin ? "userMultiple" : "userAccount"} />{isAdmin ? "Remove admin" : "Make admin"}</button>
          </form>
        )}
        {canSuspend && <button type="button" className="admin-menu-item" onClick={() => suspend.current?.showModal()}><Icon name="lock" />{suspended ? "Restore member" : "Suspend member"}</button>}
        {canDelete && <button type="button" className="admin-menu-item danger-text" onClick={() => remove.current?.showModal()}><Icon name="trash" />Delete member</button>}
      </AdminMenu>
      <dialog ref={suspend} className="modal" aria-labelledby={`${id}-suspend`} onClick={(e) => { if (e.target === suspend.current) suspend.current?.close(); }}>
        <div className="modal-head"><h2 id={`${id}-suspend`}>{suspended ? "Restore member" : "Suspend member"}</h2><button type="button" className="icon-button" aria-label="Close" onClick={close(suspend)}><Icon name="close" /></button></div>
        <div className="modal-body"><SuspendForm id={id} suspended={suspended} name={name} /></div>
      </dialog>
      <dialog ref={remove} className="modal" aria-labelledby={`${id}-delete`} onClick={(e) => { if (e.target === remove.current) remove.current?.close(); }}>
        <div className="modal-head"><h2 id={`${id}-delete`}>Delete member</h2><button type="button" className="icon-button" aria-label="Close" onClick={close(remove)}><Icon name="close" /></button></div>
        <form action={action} className="form modal-body">
          <input type="hidden" name="id" value={id} />
          <p className="muted">This permanently deletes {name}&apos;s account, profile, watchlists, follows, comments and photo. They get an email saying it&apos;s gone. It can&apos;t be undone.</p>
          <label className="field">Type DELETE to confirm<input name="confirm" autoComplete="off" required /></label>
          <div className="actions"><button className="button small danger" disabled={pending}>{pending ? "Deleting…" : "Delete member"}</button></div>
        </form>
      </dialog>
    </>
  );
}
