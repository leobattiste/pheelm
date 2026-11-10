import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
let saved;const db={auth:{getUser:async()=>({data:{user:{id:'member'}}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{handle:'member',avatar_url:null},error:null})})}),update:changes=>({eq:async()=>{saved=changes;return{error:null}}})})};
const links={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/profile-links.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:links,URL});
const exports={};const code=ts.transpileModule(fs.readFileSync('app/me/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{exports,FormData,File,Buffer,require:name=>{
 if(name==='node:crypto')return{randomUUID:()=> 'test'};
 if(name==='@/lib/profile-photo')return{};
 if(name==='@/lib/profile-links')return links;
 if(name==='@/lib/countries')return{ALL_COUNTRIES:{}};
 if(name==='next/cache')return{revalidatePath:()=>{}};
 if(name==='next/navigation')return{redirect:()=>{throw Error('Unexpected redirect')}};
 if(name==='@/lib/supabase/server')return{getServerClient:async()=>db};
 throw Error(name);
}});
const form=bio=>{const f=new FormData();f.set('handle','member');f.set('display_name','Member');f.set('bio',bio);return f};
assert.equal((await exports.updatePublicName(null,form('x'.repeat(151)))).ok,false);assert.equal(saved,undefined,'oversized bio wrote to database');assert.equal((await exports.updatePublicName(null,form('x'.repeat(150)))).ok,true);assert.equal(saved.bio.length,150);assert.equal((await exports.updatePublicName(null,form('  '))).ok,true);assert.equal(saved.bio,null);console.log('PASS: profile action rejects over-limit bios, saves 150 characters and supports clearing.');

const good=form('bio');good.set('social_platform','instagram');good.set('social_url','https://instagram.com/member');good.set('website_url','example.com');assert.equal((await exports.updatePublicName(null,good)).ok,true);assert.equal(saved.social_url,'https://instagram.com/member');assert.equal(saved.website_url,'https://example.com/');saved=undefined;good.set('social_url','https://evil.example/instagram');assert.equal((await exports.updatePublicName(null,good)).ok,false);assert.equal(saved,undefined);for(const url of ['javascript:alert(1)','data:text/html,bad','https://user:pass@example.com'])assert.throws(()=>links.websiteUrl(url));assert.throws(()=>links.socialLink('instagram','https://instagram.com.evil.example/'));console.log('PASS: profile social host validation, website normalization and unsafe-link rejection.');

for(const [platform,username,expected] of [
 ['instagram','@member','https://instagram.com/member'],['tiktok','member','https://tiktok.com/@member'],['youtube','member','https://youtube.com/@member'],['linkedin','member','https://linkedin.com/in/member'],['bluesky','member.bsky.social','https://bsky.app/profile/member.bsky.social']
]){assert.equal(links.socialLink(platform,username).url,expected);assert.equal(links.socialUsername(platform,expected),username.replace(/^@/,''));}
for(const username of ['bad/name','bad name','javascript:alert(1)','evil.example/path'])assert.throws(()=>links.socialLink('instagram',username));
console.log('PASS: social usernames create canonical platform links and reject invalid handles.');
