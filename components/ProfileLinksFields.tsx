"use client";
import {useState} from 'react';
import {SOCIAL_PLATFORMS,type ProfileLinks} from '@/lib/profile-links';
export default function ProfileLinksFields({links,disabled}:{links?:ProfileLinks;disabled?:boolean}){
 const [platform,setPlatform]=useState(links?.social_platform??'');
 return <><label className="field">Social platform<select aria-label="Social platform" name="social_platform" value={platform} onChange={e=>setPlatform(e.target.value)} disabled={disabled}><option value="">None</option>{SOCIAL_PLATFORMS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>{platform?<label className="field">Social profile link<input key={platform} type="url" name="social_url" defaultValue={links?.social_platform===platform?links.social_url??'':''} maxLength={500} placeholder={`https://${SOCIAL_PLATFORMS.find(p=>p.id===platform)?.hosts[0]}/yourprofile`} autoComplete="url" disabled={disabled}/></label>:<input type="hidden" name="social_url" value=""/>}<label className="field">Website<input type="url" name="website_url" defaultValue={links?.website_url??''} maxLength={500} placeholder="https://yourwebsite.com" autoComplete="url" disabled={disabled}/></label></>;
}
