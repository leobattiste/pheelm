import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as requireJsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const film=(id,year,status='published')=>({id,slug:id,title:id,year,status,type:'feature',countries:['US'],languages:[],genres:[],poster_url:null,color:null,runtime:90,awards:[],credits:[{role:'director',sort:2,people:{name:'Second director'}},{role:'director',sort:1,people:{name:'First director'}},{role:'cast',sort:0,people:{name:'Actor'}}]});
const films=[film('one',2001),film('two',2002),film('three',2003),film('four',2004),film('draft',2026,'draft')];
const rows={films,lists:[{id:'list',title:'A list',staff_pick:false,is_public:true,created_at:'2026-01-01',user_id:'member',list_films:films.map((f,i)=>({film_id:f.id,added_at:String(i),films:{year:f.year,status:f.status}}))}],member_profiles:[{id:'member',handle:'member'}],list_save_counts:[{list_id:'list',saves:0}],list_members:[],people:[{id:'director',slug:'director',name:'First director',country:'US',photo_url:null,in_directory:true}],credits:films.filter(f=>f.status==='published').map(f=>({person_id:'director',film_id:f.id,role:'director',films:f}))};
let queries=[];
const db={from(table){const query={table,columns:'',filters:[],start:0,end:Infinity};const builder={select(value){query.columns=value;return this;},eq(k,v){query.filters.push(['eq',k,v]);return this;},neq(k,v){query.filters.push(['neq',k,v]);return this;},in(k,v){query.filters.push(['in',k,v]);return this;},order(){return this;},range(a,b){query.start=a;query.end=b;return this;},then(resolve,reject){queries.push(query);let data=rows[table]??[];for(const[op,key,value]of query.filters){if(key.startsWith('list_films.')||key.startsWith('credits.')||key.includes('.credits.'))continue;const read=row=>key.split('.').reduce((r,k)=>r?.[k],row);data=data.filter(row=>op==='eq'?read(row)===value:op==='neq'?read(row)!==value:value.includes(read(row)));}return Promise.resolve({data:data.slice(query.start,query.end+1),error:null}).then(resolve,reject);}};return builder;}};
const data={};vm.runInNewContext(compile('lib/profile-data.ts'),{exports:data,require:name=>name==='@supabase/supabase-js'?{createClient:()=>db}:name==='./supabase/config'?{supabaseEnabled:true}:null});
const cards=await data.getProfileFilmCards(['two','draft','one']);assert.deepEqual(Array.from(cards,f=>f.id),['two','one']);assert.deepEqual(Array.from(cards[0].directors),['First director','Second director']);
queries=[];const collections=await data.getProfileCollections('member');assert.equal(collections[0].count,4);assert.deepEqual(Array.from(collections[0].tile.films,f=>f.id),['four','three','two']);const covers=queries.find(q=>q.table==='films').filters.find(([op,k])=>op==='in'&&k==='id')[2];assert.equal(covers.length,3,'collection cards must fetch only three covers');assert.ok(queries.find(q=>q.table==='lists').filters.some(([op,k,v])=>op==='eq'&&k==='is_public'&&v===true));
queries=[];await data.getProfileFilmCards([]);await data.getProfileDirectorCards([]);assert.equal(queries.length,0,'empty profiles must not query the catalog');
const directors=await data.getProfileDirectorCards(['director']);assert.equal(directors[0].films,4);assert.equal(directors[0].previews.length,3);assert.equal(directors[0].previews[0].year,2004);assert.ok(queries.every(q=>q.columns!=='*'&&!q.columns.includes('bio')&&!q.columns.includes('synopsis')),'profile reads must avoid unrelated catalog data');
let activityReads=0,cardReads=0;const panels={};const about=()=>null;
vm.runInNewContext(compile('app/[member]/ProfilePanels.tsx'),{exports:panels,console,require:name=>{
 if(name==='react/jsx-runtime')return requireJsx;
 if(name==='@/lib/profile-data')return{getProfileFilmCards:async()=>{cardReads++;return[];},getProfileDirectorCards:async()=>{cardReads++;return[];}};
 if(name==='@/components/ProfileAbout')return{default:about};
 if(name==='@/lib/profile-activity')return{getProfileActivity:async()=>[]};
 return{default:()=>null};
}});
const privateDb={rpc:async()=>({data:false,error:null}),from:()=>{activityReads++;throw Error('Private activity must not be queried');}};
const props={member:{id:'member',handle:'member'},own:false,db:privateDb};
const details=await panels.ProfileDetails(props);assert.equal(details.props.watchedHidden,true);assert.equal(details.props.watched,null);assert.match(renderToStaticMarkup(await panels.ProfileFollowing(props)),/Following is private/);assert.equal(activityReads,0);assert.equal(cardReads,0);
const failedDb={...privateDb,rpc:async()=>({data:null,error:{message:'Unavailable'}})};assert.equal((await panels.ProfileDetails({...props,db:failedDb})).props.watched,null);assert.equal(activityReads,0);assert.equal(cardReads,0);
console.log('PASS: targeted published-film reads, director ordering, accurate collection counts with three covers, empty-profile short circuits, and privacy checks before reading watched/following activity.');

const hiddenMember={id:'member',handle:'member',display_name:null,is_private:true,bio:'PRIVATE BIO'};let viewer=null;
const pageDb={auth:{getUser:async()=>({data:{user:viewer}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{display_name:'Owner name',bio:'Owner bio'},error:null})})})})};
const bioRules={};vm.runInNewContext(compile('lib/profile-bio.ts'),{exports:bioRules});
const pageExports={};vm.runInNewContext(compile('app/[member]/page.tsx'),{exports:pageExports,require:name=>{
 if(name==='react/jsx-runtime')return requireJsx;if(name==='react')return{Suspense:Symbol.for('react.suspense')};
 if(name==='next/navigation')return{notFound:()=>{throw Error('Not found');}};
 if(name==='@/lib/profile-bio')return bioRules;
 if(name==='@/lib/community')return{getMemberProfile:async()=>hiddenMember};
 if(name==='@/lib/supabase/server')return{getServerClient:async()=>pageDb};
 if(name==='@/lib/format')return{initials:()=> 'M'};if(name==='@/lib/site')return{VERIFIED:{}};
 if(name==='@/lib/profile-seo')return{profileStructuredData:()=>null};
 if(name==='./ProfilePanels')return{ProfileWatchlists:()=>null,ProfileFollowing:()=>null,ProfileDetails:()=>null,ProfileBlockAction:()=>null};
 return{default:()=>null};
}});
const privatePage=renderToStaticMarkup(await pageExports.default({params:Promise.resolve({member:'@member'})}));assert.match(privatePage,/This profile is private/);assert.equal(privatePage.includes('PRIVATE BIO'),false);
viewer={id:'member'};await pageExports.default({params:Promise.resolve({member:'@member'})});assert.equal(hiddenMember.display_name,null,'owner rendering must not mutate the object shared with metadata');assert.equal(hiddenMember.bio,'PRIVATE BIO');
console.log('PASS: private profiles reveal no details to visitors and owner rendering does not mutate shared metadata.');

// Activity: newest first across watchlists, comments, watched films and follows; comments on
// something the visitor can't see (it comes back without its film or watchlist) are left out.
const activityRows={
 lists:[{id:'l1',slug:'black-futures',title:'Black Futures',created_at:'2026-11-03'}],
 list_comments:[{id:'c1',list_id:null,film_id:'f1',created_at:'2026-11-05',lists:null,films:{title:'Atlantics',slug:'atlantics'}},{id:'c2',list_id:'hidden',film_id:null,created_at:'2026-11-06',lists:null,films:null}],
 watched:[{film_id:'f2',watched_at:'2026-11-04',films:{title:'Moonlight',slug:'moonlight'}}],
 follows:[{person_id:'p1',created_at:'2026-11-01',people:{name:'Mati Diop',slug:'mati-diop',in_directory:true}}],
};
const activityDb={from(table){const b={select(){return b;},eq(){return b;},is(){return b;},order(){return b;},limit(){return b;},then(ok,no){return Promise.resolve({data:activityRows[table]??[],error:null}).then(ok,no);}};return b;}};
const activityLib={},commentsLib={},linksLib={};
vm.runInNewContext(compile('lib/watchlist-links.ts'),{exports:linksLib});
vm.runInNewContext(compile('lib/comments.ts'),{exports:commentsLib,require:()=>({})});
vm.runInNewContext(compile('lib/profile-activity.ts'),{exports:activityLib,require:name=>name==='./comments'?commentsLib:name==='./watchlist-links'?linksLib:{}});
const activity=await activityLib.getProfileActivity(activityDb,'member');
assert.deepEqual(Array.from(activity,a=>`${a.verb} ${a.title}`),['Commented on Atlantics','Watched Moonlight','Created Black Futures','Followed Mati Diop']);
assert.equal(activity[0].href,'/films/atlantics#comment-c1');assert.equal(activity[3].href,'/directors/mati-diop');
assert.equal((await activityLib.getProfileActivity(null,'member')).length,0);
console.log('PASS: profile activity is newest first, links to each thing, and leaves out comments the visitor cannot see.');
