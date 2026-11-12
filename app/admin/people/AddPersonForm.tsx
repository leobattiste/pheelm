'use client';
import {useActionState} from 'react';
import {ALL_COUNTRIES} from '@/lib/countries';
import {createPerson,type CreatePersonState} from './create-actions';
import { useResultToast } from "@/components/Toast";
export default function AddPersonForm() {
 const [state,action,pending]=useActionState<CreatePersonState,FormData>(createPerson,null);
  useResultToast(state);
 return <form action={action} className="form">
  <label className="field">Name<input name="name" autoComplete="off" required maxLength={200}/></label>
  <label className="field">Country<select aria-label="Country" name="country" defaultValue=""><option value="">Not specified</option>{Object.entries(ALL_COUNTRIES).sort((a,b)=>a[1].localeCompare(b[1])).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
  <label className="field">TMDB person ID <span className="hint">Optional. Import their biography and portrait.</span><input name="tmdb_id" inputMode="numeric" pattern="[0-9]+"/></label>
  <p className="muted">The new record stays hidden until you finish editing and enable its directory listing. Add directing credits through the relevant film’s editor. Records without directing credits can be found by choosing Everyone in Filters.</p>
  <div className="actions"><button type="submit" className="button" disabled={pending}>{pending?'Adding…':'Add director'}</button></div>
 </form>;
}
