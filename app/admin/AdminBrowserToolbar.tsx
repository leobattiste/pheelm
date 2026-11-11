"use client";

import {useEffect,useId,useRef,useState,useTransition,type ReactNode,type FormEvent} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/Icon';
import FilterSelect from '@/components/FilterSelect';

type Filter={name:string;label:string;value:string;options:{value:string;label:string}[]};
type Props={action:string;query?:string;placeholder:string;filters?:Filter[];pageSize?:string;compact?:boolean;addControl?:ReactNode;panelTools?:ReactNode;selectionControls?:ReactNode;allowAll?:boolean;count?:number;noun?:string};

export default function AdminBrowserToolbar({action,query='',placeholder,filters=[],pageSize='40',compact=false,addControl,panelTools,selectionControls,allowAll=true,count,noun='results'}:Props){
 const modal=useRef<HTMLDialogElement>(null),form=useRef<HTMLFormElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const title=useId(),formId=title+'-form',dialogId=title+'-dialog';
 const router=useRouter(),pathname=usePathname(),navigation=useSearchParams().toString();
 const [term,setTerm]=useState(query),[open,setOpen]=useState(false),[dirty,setDirty]=useState(false),[pending,startTransition]=useTransition();
 const criteria=filters.filter(filter=>filter.name!=='sort'),display=filters.filter(filter=>filter.name==='sort');
 const isActive=(filter:Filter)=>!!filter.value&&filter.value!==filter.options[0]?.value;
 const active=criteria.filter(isActive),primary=criteria.length>4?criteria.slice(0,2):criteria,advanced=criteria.length>4?criteria.slice(2):[];
 const navigate=(params:URLSearchParams)=>{params.delete('page');params.delete('updated');params.delete('error');const search=params.toString();startTransition(()=>router.replace(search?`${action}?${search}`:action,{scroll:false}));};
 useEffect(()=>setTerm(query),[query]);
 useEffect(()=>{modal.current?.close();},[pathname,navigation]);
 useEffect(()=>{
  if(term.trim()===query||open||pending)return;
  timer.current=setTimeout(()=>{const params=new URLSearchParams(window.location.search);if(term.trim())params.set('q',term.trim());else params.delete('q');navigate(params);},350);
  return()=>{if(timer.current)clearTimeout(timer.current);};
 },[term,query,open,pending,pathname,router]); // eslint-disable-line react-hooks/exhaustive-deps
 const show=()=>{form.current?.reset();setDirty(false);setOpen(true);modal.current?.showModal();};
 const close=()=>modal.current?.close();
 const onClose=()=>{if(modal.current?.open)return;modal.current?.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog=>dialog.close());setOpen(false);setDirty(false);form.current?.reset();};
 const clearParams=()=>{const params=new URLSearchParams();if(term.trim())params.set('q',term.trim());if(pageSize!=='40')params.set('limit',pageSize);for(const filter of display)if(isActive(filter))params.set(filter.name,filter.value);return params;};
 const without=(name?:string)=>{const params=clearParams();for(const filter of criteria)if(filter.name!==name&&isActive(filter))params.set(filter.name,filter.value);return params;};
 const url=(params:URLSearchParams)=>params.size?`${action}?${params}`:action;
 const changed=()=>{const data=new FormData(form.current!);setDirty(filters.some(filter=>data.get(filter.name)!==filter.value)||(compact&&data.get('limit')!==pageSize));};
 const resetDraft=()=>{for(const filter of filters){const select=form.current?.elements.namedItem(filter.name) as HTMLSelectElement|null;if(select)select.value=filter.options[0]?.value??'';}const size=form.current?.elements.namedItem('limit') as HTMLSelectElement|null;if(compact&&size)size.value='40';changed();};
 const apply=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(timer.current)clearTimeout(timer.current);
  const data=new FormData(event.currentTarget),params=new URLSearchParams();
  if(term.trim())params.set('q',term.trim());
  for(const filter of filters){const value=String(data.get(filter.name)??'');if(value&&value!==filter.options[0]?.value)params.set(filter.name,value);}
  const limit=String(data.get('limit')??pageSize);if(limit!=='40')params.set('limit',limit);
  close();navigate(params);
 };
 const renderFilter=(filter:Filter)=><FilterSelect key={filter.name+':'+filter.value} label={filter.label} name={filter.name} defaultValue={filter.value}>{filter.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</FilterSelect>;
 const chips=active.length>0?<ul className="chip-list catalog-active-filters" aria-label="Active filters">{active.map(filter=><li key={filter.name}><Link className="chip" href={url(without(filter.name))} aria-label={`Remove ${filter.label} filter`} onClick={close}>{filter.options.find(option=>option.value===filter.value)?.label??filter.value}<Icon name="close" className="x"/></Link></li>)}{!compact&&<li><Link className="link-button" href={url(clearParams())}>Clear filters</Link></li>}</ul>:null;
 return <div className={'admin-browser-tools browser'+(compact?' admin-catalog-tools':'')} aria-busy={pending}>
  <div className="toolbar catalog-toolbar">
   <form action={action} method="get" role="search" className="catalog-search-control" onSubmit={event=>{event.preventDefault();const params=new URLSearchParams(window.location.search);if(term.trim())params.set('q',term.trim());else params.delete('q');navigate(params);}}><div className="search-bar"><Icon name="search"/><label className="visually-hidden" htmlFor={title+'-search'}>{placeholder}</label><input type="search" name="q" id={title+'-search'} autoComplete="off" value={term} onChange={event=>setTerm(event.currentTarget.value)} placeholder={placeholder} maxLength={100}/>{term&&<button type="button" className="catalog-clear-query" aria-label="Clear search" onClick={()=>setTerm('')}><Icon name="close"/></button>}</div></form>
   {addControl}
   {filters.length>0&&<button type="button" className={'button ghost filter-button'+(active.length?' has-count':'')} aria-label="Filters" title="Filters and catalog actions" aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={open} disabled={pending} onClick={show}><Icon name="filter"/>{!compact&&<span className="filter-label">Filters</span>}{active.length>0&&<span className="badge" aria-label={`${active.length} active filters`}>{active.length}</span>}</button>}
  </div>
  {!compact&&chips}
  {filters.length>0&&<dialog ref={modal} id={dialogId} className="modal catalog-filter-dialog admin-filter-dialog" aria-labelledby={title} onClose={event=>{if(event.target===event.currentTarget)onClose();}} onClick={event=>{if(event.target===modal.current)close();}}>
   <div className="modal-head"><h2 id={title}>Filters</h2><button type="button" className="icon-button" aria-label="Close filters" onClick={close}><Icon name="close"/></button></div>
   <div className="modal-body admin-filter-content">
    {compact&&chips}
    <form ref={form} id={formId} action={action} method="get" className="admin-filter-form" onSubmit={apply} onChange={changed}>
     <input type="hidden" name="q" value={term}/>
     {!compact&&pageSize!=='40'&&<input type="hidden" name="limit" value={pageSize}/>}
     <fieldset className="admin-filter-fields"><legend className="visually-hidden">Filter records</legend>{primary.map(renderFilter)}</fieldset>
     {advanced.length>0&&<details className="admin-filter-section" open={advanced.some(isActive)}><summary>More filters<Icon name="arrowDown"/></summary><div className="admin-filter-fields">{advanced.map(renderFilter)}</div></details>}
     {(display.length>0||compact)&&<details className="admin-filter-section" open={display.some(isActive)||pageSize!=='40'}><summary>Display<Icon name="arrowDown"/></summary><div className="admin-filter-fields">{display.map(renderFilter)}{compact&&<FilterSelect label="Items per page" name="limit" defaultValue={pageSize} key={pageSize}>{['20','40','80',...(allowAll?['all']:[])].map(value=><option key={value} value={value}>{value==='all'?'All':value}</option>)}</FilterSelect>}</div></details>}
    </form>
    {typeof count==='number'&&(query||active.length>0)&&!dirty&&term.trim()===query&&<p className="admin-filter-count muted" role="status">{count.toLocaleString()} matching {noun}</p>}
    {panelTools&&<details className="admin-filter-section admin-filter-tools"><summary>Catalog tools<Icon name="arrowDown"/></summary><div className="actions admin-filter-links">{panelTools}</div></details>}
    {selectionControls}
   </div>
   <div className="modal-foot"><button type="button" className="button ghost" disabled={!dirty&&!filters.some(isActive)&&pageSize==='40'} onClick={resetDraft}>Reset</button><button className="button" type="submit" form={formId} disabled={pending}>{pending?'Updating…':'Show results'}</button></div>
  </dialog>}
 </div>;
}
