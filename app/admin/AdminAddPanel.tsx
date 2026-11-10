'use client';
import {useId,useRef,type ReactNode} from 'react';
import Icon from '@/components/Icon';
export default function AdminAddPanel({label,children}:{label:string;children:ReactNode}) {
 const dialog=useRef<HTMLDialogElement>(null),id=useId();
 return <><button type="button" className="button ghost admin-add-control" aria-label={label} title={label} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}><Icon name="plus"/></button>
  <dialog ref={dialog} className="modal admin-add-dialog" aria-labelledby={id} onClick={e=>{if(e.target===dialog.current)dialog.current?.close();}}>
   <div className="modal-head"><h2 id={id}>{label}</h2><button type="button" className="icon-button" aria-label="Close add dialog" onClick={()=>dialog.current?.close()}><Icon name="close"/></button></div>
   <div className="modal-body admin-add-content">{children}</div>
  </dialog></>;
}
