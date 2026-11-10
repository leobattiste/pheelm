"use client";
import { useId, useState } from 'react';
export default function ProfileBioField({bio,disabled,unlimited=false}:{bio?:string|null;disabled?:boolean;unlimited?:boolean}){
 const id=useId(),[value,setValue]=useState(bio??'');
 return <label className="field">{unlimited?'Bio':'Short bio'}<textarea name="bio" value={value} onChange={e=>setValue(unlimited?e.target.value:e.target.value.slice(0,150))} maxLength={unlimited?undefined:150} rows={unlimited?6:3} placeholder="A little about you and the films you love" disabled={disabled} aria-describedby={id}/><span id={id} className="hint bio-count">{unlimited?`${value.length} characters`:`${value.length}/150`}</span></label>;
}
