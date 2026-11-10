type View = 'watchlists' | 'following' | 'about';

/** Match the real card geometry while profile data streams into each tab. */
export function ProfilePanelSkeleton({view='watchlists'}:{view?:View}) {
 if(view==='about')return <div className="profile-skeleton profile-skeleton-details" aria-label="About" aria-busy="true"><div aria-hidden="true">{[0,1,2,3].map(i=><div className="profile-skeleton-field" key={i}><span className="profile-skeleton-block profile-skeleton-line profile-skeleton-short"/><span className="profile-skeleton-block profile-skeleton-line"/></div>)}</div></div>;
 return <div className="profile-skeleton" aria-label={view==='following'?'Following':'Watchlists'} aria-busy="true"><ul className={view==='following'?'director-grid':'collection-list'} aria-hidden="true">{[0,1,2,3,4,5].map(i=><li key={i} className={view==='following'?'director-card':undefined}><div className="collection-tile">
  {view==='following'?<span className="director-card-head"><span className="portrait profile-skeleton-block"/><span className="director-card-body"><span className="profile-skeleton-block profile-skeleton-line"/><span className="profile-skeleton-block profile-skeleton-line profile-skeleton-short"/></span></span>:<><span className="collection-title profile-skeleton-block profile-skeleton-line"/><span className="collection-desc profile-skeleton-block profile-skeleton-line profile-skeleton-short"/></>}
  <span className="collection-fan">{[0,1,2].map(p=><span key={p} className="poster profile-skeleton-block"/>)}</span>
 </div></li>)}</ul></div>;
}

export default function ProfileSkeleton() {
 return <section className="page member-page profile-skeleton-page" aria-label="Profile" aria-busy="true">
  <div className="person-head" aria-hidden="true"><span className="portrait profile-skeleton-block"/><div className="person-text"><span className="profile-skeleton-block profile-skeleton-name"/><span className="profile-skeleton-block profile-skeleton-line profile-skeleton-short"/></div></div>
  <div className="profile-tabs profile-skeleton-tabs" aria-hidden="true">{[0,1,2].map(i=><span className="profile-skeleton-block profile-skeleton-tab" key={i}/>)}</div>
  <div className="tab-panel"><ProfilePanelSkeleton/></div>
 </section>;
}
