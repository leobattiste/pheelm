"use client";
import {useEffect,useState,type InputHTMLAttributes} from 'react';
import {useSessionEmail} from '@/lib/session-email';
export default function EmailInput({defaultValue,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'type'|'defaultValue'> & {defaultValue?:string}){
 const accountEmail=useSessionEmail();
 const [value,setValue]=useState(defaultValue??''),[edited,setEdited]=useState(false);
 useEffect(()=>{if(!edited)setValue(accountEmail??defaultValue??'');},[accountEmail,defaultValue,edited]);
 return <input {...props} type="email" autoComplete={props.autoComplete??'email'} value={value} onChange={event=>{setEdited(true);setValue(event.target.value);props.onChange?.(event);}}/>;
}
