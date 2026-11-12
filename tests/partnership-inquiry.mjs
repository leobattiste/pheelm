import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const partnership={},links={},navigation={};vm.runInNewContext(compile('lib/partnership.ts'),{exports:partnership});vm.runInNewContext(compile('lib/safe-navigation.ts'),{exports:navigation,URL,decodeURIComponent});vm.runInNewContext(compile('lib/profile-links.ts'),{exports:links,URL});
let saved=[],failures=0;const db={from:table=>({insert:async row=>{saved.push({table,row});return{error:failures-->0?{code:'PGRST204'}:null};}})};
const exports={};vm.runInNewContext(compile('app/platform-actions.ts'),{exports,FormData,require:name=>{
 if(name==='@/lib/partnership')return partnership;if(name==='@/lib/safe-navigation')return navigation;if(name==='@/lib/profile-links')return links;
 if(name==='@/lib/supabase/server')return{getServerClient:async()=>db};if(name==='@/lib/turnstile')return{passesTurnstile:async()=>true};throw Error(name);
}});
const form=()=>{const f=new FormData();for(const[k,v]of Object.entries({topic:'partnership',name:'Test Organizer',email:'organizer@example.invalid',organization:'Cinema Project',partnership_type:'Film festival or screening',partnership_url:'https://example.com/project',body:'A screening proposal.'}))f.set(k,v);return f;};
for(const[field,value]of [['name',''],['partnership_type','Unknown'],['partnership_url','javascript:alert(1)'],['body','x'.repeat(4001)]]){const f=form();f.set(field,value);saved=[];assert.equal((await exports.sendMessage(null,f)).ok,false);assert.equal(saved.length,0);}
let result=await exports.sendMessage(null,form());assert.equal(result.message,partnership.PARTNERSHIP_SUCCESS);assert.equal(saved.at(-1).table,'messages');assert.equal(saved.at(-1).row.organization,'Cinema Project');assert.equal(saved.at(-1).row.body,'A screening proposal.');assert.equal(saved.at(-1).row.partnership_type,'Film festival or screening');assert.equal(saved.at(-1).row.website,'https://example.com/project');assert.match(saved.at(-1).row.body,/A screening proposal/);
saved=[];failures=1;assert.equal((await exports.sendMessage(null,form())).ok,true);assert.equal(saved.length,2);assert.match(saved[1].row.body,/Website or social media/);
saved=[];failures=3;assert.equal((await exports.sendMessage(null,form())).ok,false);
const contact=form();contact.set('topic','general');contact.set('name','');contact.delete('partnership_type');contact.delete('partnership_url');saved=[];failures=0;assert.equal((await exports.sendMessage(null,contact)).ok,true);assert.equal(saved[0].row.body,'A screening proposal.');
console.log('PASS: partnership validation, structured inbox fields with a text fallback, retry preservation, exact success copy, database errors and ordinary contact messages.');
