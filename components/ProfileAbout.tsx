import type {Member} from '@/lib/community';
import type {FilmCard} from '@/lib/types';
import {countryName} from '@/lib/format';
import {SOCIAL_PLATFORMS,socialLink,websiteUrl} from '@/lib/profile-links';
import type {Activity} from '@/lib/profile-activity';
import ProfileActivity from './ProfileActivity';
import Icon from './Icon';
import WatchedFilmsModal from './WatchedFilmsModal';
export default function ProfileAbout({member,watched,watchedHidden=false,activity=null}:{member:Member;watched:FilmCard[]|null;watchedHidden?:boolean;activity?:Activity[]|null}){
 let social:null|{label:string;icon:typeof SOCIAL_PLATFORMS[number]['icon'];url:string}=null,website:string|null=null;
 try{const checked=socialLink(member.social_platform??'',member.social_url??'');const platform=SOCIAL_PLATFORMS.find(p=>p.id===checked.platform);if(platform&&checked.url)social={label:platform.label,icon:platform.icon,url:checked.url};}catch{}
 try{website=websiteUrl(member.website_url??'');}catch{}
 return <section className="profile-about" aria-label="About this member"><dl className="profile-about-fields"><div><dt>Bio</dt><dd className="member-bio" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{member.bio||'Not provided'}</dd></div><div><dt>Country</dt><dd>{member.country?countryName(member.country):'Not provided'}</dd></div><div><dt>Watched</dt><dd>{watchedHidden?<span className="muted">Private</span>:watched?<WatchedFilmsModal films={watched}/>:<span className="muted">Unavailable</span>}</dd></div>{activity&&<div><dt>Activity</dt><dd><ProfileActivity items={activity}/></dd></div>}{(social||website)&&<div><dt>Links</dt><dd className="profile-about-links">{social&&<a className="profile-about-link platform-link" href={social.url} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={`${social.label} profile`} title={social.label}><Icon name={social.icon}/></a>}{website&&<a className="profile-about-link" href={website} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label="Website" title="Website"><Icon name="globe"/></a>}</dd></div>}</dl></section>;
}
