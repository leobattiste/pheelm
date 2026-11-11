import Link from 'next/link';
import CommunityTile from '@/components/CommunityTile';
import DirectorCard from '@/components/DirectorCard';
import ProfileAbout from '@/components/ProfileAbout';
import Icon from '@/components/Icon';
import {getProfileCollections,getProfileCollaborations,getProfileDirectorCards,getProfileFilmCards} from '@/lib/profile-data';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Member} from '@/lib/community';

type ProfileProps={member:Member;own:boolean;db:SupabaseClient|null};

function Unavailable({section}:{section:string}) {
 return <p className="notice" role="status">{section} couldn’t load right now. Refresh the page to try again.</p>;
}

export async function ProfileWatchlists({member,own}:ProfileProps) {
 try{
  const [collections,collaborating]=await Promise.all([getProfileCollections(member.id),getProfileCollaborations(member.id)]);
  return <>
   {collections.length?<ul className="collection-list">{collections.map(c=><CommunityTile key={c.tile.id} c={c.tile} filmCount={c.count} showOwner={false}/>)}</ul>:<div className="empty-state"><Icon name="stack" className="empty-icon"/><p>Nothing here yet.</p>{own&&<><p className="muted">Make one of your watchlists public from your Watchlist and it shows up here.</p><Link className="button ghost small" href="/me">Go to your Watchlist</Link></>}</div>}
   {collaborating.length>0&&<section className="film-section member-collections" aria-labelledby="member-collab-h"><h2 id="member-collab-h">Co-curating</h2><ul className="collection-list">{collaborating.map(c=><CommunityTile key={c.tile.id} c={c.tile} filmCount={c.count}/>)}</ul></section>}
  </>;
 }catch(error){console.error('Profile watchlists failed to load.',error instanceof Error?error.message:'Unknown error');return <Unavailable section="Watchlists"/>;}
}

export async function ProfileFollowing({member,own,db}:ProfileProps) {
 try{
  if(!db)return <Unavailable section="Following"/>;
  if(!own){const {data,error}=await db.rpc('shows_following',{uid:member.id});if(error)return <Unavailable section="Following"/>;if(!data)return <p className="muted">Following is private.</p>;}
  const {data,error}=await db.from('follows').select('person_id').eq('user_id',member.id).order('created_at',{ascending:false});
  if(error)return <Unavailable section="Following"/>;
  const following=await getProfileDirectorCards((data??[]).map(row=>row.person_id));
  return following.length?<ul className="director-grid">{following.map(d=><DirectorCard key={d.id} director={d}/>)}</ul>:<div className="empty-state"><Icon name="users2" className="empty-icon"/><p>Not following any directors yet.</p>{own&&<><p className="muted">Follow directors from their pages to hear when they have a new film.</p><Link className="button ghost small" href="/directors">Browse directors</Link></>}</div>;
 }catch(error){console.error('Profile following failed to load.',error instanceof Error?error.message:'Unknown error');return <Unavailable section="Following"/>;}
}

export async function ProfileDetails({member,own,db}:ProfileProps) {
 try{
  if(!db)return <ProfileAbout member={member} watched={null}/>;
  if(!own){const {data,error}=await db.rpc('shows_watched',{uid:member.id});if(error)return <ProfileAbout member={member} watched={null}/>;if(!data)return <ProfileAbout member={member} watched={null} watchedHidden/>;}
  const {data,error}=await db.from('watched').select('film_id').eq('user_id',member.id).order('watched_at',{ascending:false});
  if(error)return <ProfileAbout member={member} watched={null}/>;
  const watched=await getProfileFilmCards((data??[]).map(row=>row.film_id));
  return <ProfileAbout member={member} watched={watched}/>;
 }catch(error){console.error('Profile watched films failed to load.',error instanceof Error?error.message:'Unknown error');return <ProfileAbout member={member} watched={null}/>;}
}

export async function ProfileBlockAction({member,viewerId,db}:{member:Member;viewerId:string;db:SupabaseClient|null}) {
 if(!db||viewerId===member.id)return null;
 const {data,error}=await db.from('blocks').select('blocked_id').eq('blocker_id',viewerId).eq('blocked_id',member.id).maybeSingle();
 if(error)return null;
 const BlockButton=(await import('@/components/BlockButton')).default;
 return <BlockButton memberId={member.id} handle={member.handle} blocked={!!data}/>;
}
