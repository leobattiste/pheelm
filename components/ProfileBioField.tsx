"use client";
import { useId, useState } from 'react';
export default function ProfileBioField({bio,disabled}:{bio?:string|null;disabled?:boolean}){
 const id=useId(),[value,setValue]=useState(bio??'');
 return <label className="field">Short bio<textarea name="bio" value={value} onChange={e=>setValue(e.target.value.slice(0,150))} maxLength={150} rows={3} placeholder="A little about you and the films you love" disabled={disabled} aria-describedby={id}/><span id={id} className="hint bio-count">{value.length}/150</span></label>;
}
