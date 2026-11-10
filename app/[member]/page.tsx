import { Suspense } from 'react';
import { ProfilePanelSkeleton } from '@/components/ProfileSkeleton';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { profileMetadata, profileStructuredData } from '@/lib/profile-seo';
import { getMemberProfile } from '@/lib/community';
import { getServerClient } from '@/lib/supabase/server';
import { initials } from '@/lib/format';
import { VERIFIED } from '@/lib/site';
import UserAvatar from '@/components/UserAvatar';
import ProfileEditor from '@/components/ProfileEditor';
import MoreMenu from '@/components/MoreMenu';
import ShareButton from '@/components/ShareButton';
import VerifiedBadge from '@/components/VerifiedBadge';
import Tabs from '@/components/Tabs';
import { ProfileWatchlists, ProfileFollowing, ProfileDetails, ProfileBlockAction } from './ProfilePanels';

export const dynamic = 'force-dynamic';
type Params = {params:Promise<{member:string}>};
function handleOf(segment:string) {
 try{const value=decodeURIComponent(segment);return /^@[a-z0-9_]{3,24}$/i.test(value)?value.slice(1).toLowerCase():null;}catch{return null;}
}
export async function generateMetadata({params}:Params):Promise<Metadata> {
 const handle=handleOf((await params).member);
 return profileMetadata(handle?await getMemberProfile(handle):null);
}
export default async function MemberPage({params}:Params) {
 const handle=handleOf((await params).member);if(!handle)notFound();
 const db=await getServerClient();
 const [publicMember,viewerResult]=await Promise.all([getMemberProfile(handle),db?db.auth.getUser():null]);
 if(!publicMember)notFound();
 // Do not mutate the profile object shared with metadata within this request.
 const member={...publicMember},viewer=viewerResult?.data.user;
 const own=viewer?.id===member.id;
 if(own&&db){const {data}=await db.from('profiles').select('display_name,country,bio,avatar_url,social_platform,social_url,website_url').eq('id',member.id).maybeSingle();if(data)Object.assign(member,data);}
 if(member.is_private&&!own)return <section className="page"><header className="person-head"><span className="portrait portrait-initials" aria-hidden="true">{initials(member.handle)}</span><div className="person-text"><h1>@{member.handle}</h1><p className="person-sub">This profile is private.</p></div></header></section>;
 const name=member.display_name||`@${member.handle}`;
 return <section className="page member-page">
  {!member.is_private&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(profileStructuredData(member)).replace(/</g,'\\u003c')}}/>}
  <header className="person-head">
   <MoreMenu corner label="Profile actions">
    {own&&<ProfileEditor links={member} bio={member.bio??null} handle={member.handle} displayName={member.display_name} isPrivate={!!member.is_private} country={member.country??null} avatarUrl={member.avatar_url??null}/>}
    {!member.is_private&&<ShareButton item title={`${name} on Pheelm`}/>}
    {viewer&&!own&&<Suspense fallback={null}><ProfileBlockAction member={member} viewerId={viewer.id} db={db}/></Suspense>}
   </MoreMenu>
   <UserAvatar person={member} className="portrait"/>
   <div className="person-text"><h1>{name}{VERIFIED[member.handle]&&<VerifiedBadge title={VERIFIED[member.handle]}/>}</h1><p className="person-sub">@{member.handle}</p>{own&&member.is_private&&<p className="person-sub">Private: only you can see this page.</p>}</div>
  </header>
  <Tabs tabs={[
   {id:'watchlist',label:'Watchlist',panel:<Suspense fallback={<ProfilePanelSkeleton view="watchlists"/>}><ProfileWatchlists member={member} own={own} db={db}/></Suspense>},
   {id:'following',label:'Following',panel:<Suspense fallback={<ProfilePanelSkeleton view="following"/>}><ProfileFollowing member={member} own={own} db={db}/></Suspense>},
   {id:'about',label:'About',panel:<Suspense fallback={<ProfilePanelSkeleton view="about"/>}><ProfileDetails member={member} own={own} db={db}/></Suspense>},
  ]}/>
 </section>;
}
