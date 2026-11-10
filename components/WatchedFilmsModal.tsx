"use client";
import {useRef,useState} from 'react';
import type {FilmCard} from '@/lib/types';
import {FilmGrid} from './FilmCard';
import Icon from './Icon';
export default function WatchedFilmsModal({films}:{films:FilmCard[]}){
 const dialog=useRef<HTMLDialogElement>(null),[shown,setShown]=useState(24);
 return <><button type="button" className="watched-count" aria-label={`${films.length} movies watched. View watched movies`} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>{films.length}</button><dialog ref={dialog} className="modal watched-films-dialog" aria-labelledby="watched-films-title" onClose={()=>setShown(24)} onClick={e=>{if(e.target===dialog.current)dialog.current?.close()}}><div className="modal-head"><h2 id="watched-films-title">Movies watched</h2><button type="button" className="icon-button" aria-label="Close watched movies" onClick={()=>dialog.current?.close()}><Icon name="close"/></button></div><div className="modal-body">{films.length?<><FilmGrid films={films.slice(0,shown)}/>{shown<films.length&&<button type="button" className="button ghost watched-load-more" onClick={()=>setShown(n=>n+24)}>Load more</button>}</>:<p className="muted">No watched movies yet.</p>}</div></dialog></>;
}
