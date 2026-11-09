"use client";
import {useActionState} from 'react';
import {replyByEmail} from './email-actions';
export default function EmailReply({messageId}:{messageId:string}){const[state,action,pending]=useActionState(replyByEmail,null);return <details><summary>Reply through Pheelm</summary><form action={action} className="form"><input type="hidden" name="message_id" value={messageId}/><label className="field">Your reply<textarea name="reply" maxLength={5000} required rows={4}/></label><button className="button" disabled={pending||state?.ok}>{pending?'Queuing…':state?.ok?'Reply queued':'Send reply'}</button>{state&&<p role="status" className={state.ok?'notice ok':'notice error'}>{state.message}</p>}</form></details>}
