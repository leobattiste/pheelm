import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
let saved;const db={auth:{getUser:async()=>({data:{user:{id:'member'}}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{handle:'member',avatar_url:null},error:null})})}),update:changes=>({eq:async()=>{saved=changes;return{error:null}}})})};
const exports={};const code=ts.transpileModule(fs.readFileSync('app/me/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{exports,FormData,File,Buffer,require:name=>{
 if(name==='node:crypto')return{randomUUID:()=> 'test'};
 if(name==='@/lib/profile-photo')return{};
 if(name==='@/lib/countries')return{ALL_COUNTRIES:{}};
 if(name==='next/cache')return{revalidatePath:()=>{}};
 if(name==='next/navigation')return{redirect:()=>{throw Error('Unexpected redirect')}};
 if(name==='@/lib/supabase/server')return{getServerClient:async()=>db};
 throw Error(name);
}});
const form=bio=>{const f=new FormData();f.set('handle','member');f.set('display_name','Member');f.set('bio',bio);return f};
assert.equal((await exports.updatePublicName(null,form('x'.repeat(51)))).ok,false);assert.equal(saved,undefined,'oversized bio wrote to database');assert.equal((await exports.updatePublicName(null,form('x'.repeat(50)))).ok,true);assert.equal(saved.bio.length,50);assert.equal((await exports.updatePublicName(null,form('  '))).ok,true);assert.equal(saved.bio,null);console.log('PASS: profile action rejects over-limit bios, saves 50 characters and supports clearing.');
