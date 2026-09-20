import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {slotPosition} from '../public/world.js';
let processRef,dir,cookie,secondCookie;
const base='http://127.0.0.1:4187';
const payload={name:'검증용 하객',message:'언제나 행복하세요!',side:'both',consent:true,avatar:{outfit:10,hair:10,skin:1,accessory:4,action:'dance'}};
async function request(path,method='GET',body,session=cookie,key='test-request-123456'){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(session?{Cookie:session}:{}),'Idempotency-Key':key},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
before(async()=>{dir=await mkdtemp(join(tmpdir(),'wedding-garden-test-'));processRef=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'4187',GARDEN_DB:join(dir,'test.sqlite')},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{processRef.stdout.on('data',b=>{if(b.toString().includes('ready'))resolve()});processRef.on('error',reject);processRef.on('exit',code=>reject(new Error(`server exited ${code}`)))});cookie=(await request('/api/config')).cookie;secondCookie=(await request('/api/config','GET',undefined,'')).cookie;});
after(async()=>{processRef?.kill();await new Promise(r=>processRef?.once('exit',r));await rm(dir,{recursive:true,force:true})});
test('validates blank messages, consent, max length and malformed objects',async()=>{
 for(const invalid of [null,[],{...payload,name:' '},{...payload,name:'가'.repeat(21)},{...payload,message:'나'.repeat(121)},{...payload,consent:false},{...payload,avatar:null},{...payload,side:'stranger'}])assert.equal((await request('/api/guests','POST',invalid)).status,400);
});
let id;
function slowPatch(path,value,during,session=cookie){return new Promise((resolve,reject)=>{
 const bytes=Buffer.from(JSON.stringify(value));
 const req=http.request(base+path,{method:'PATCH',headers:{'Content-Type':'application/json','Content-Length':bytes.length,Cookie:session}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))}))});
 req.on('error',reject);req.flushHeaders();req.write(bytes.subarray(0,5));setTimeout(async()=>{try{await during();req.end(bytes.subarray(5))}catch(error){req.destroy();reject(error)}},40);
})}
test('concurrent retries create exactly one guest and replay the same ID',async()=>{const results=await Promise.all([request('/api/guests','POST',payload),request('/api/guests','POST',payload)]);assert.deepEqual(results.map(x=>x.status).sort(),[200,201]);assert.equal(results[0].data.guest.id,results[1].data.guest.id);id=results[0].data.guest.id;const list=await request('/api/guests');assert.equal(list.data.total,1);assert.equal(list.data.guests[0].isMine,true)});
test('same request key rejects a changed payload',async()=>assert.equal((await request('/api/guests','POST',{...payload,message:'다른 내용'})).status,409));
test('shared read visibility and owner-only mutations',async()=>{const list=await request('/api/guests','GET',undefined,secondCookie);assert.equal(list.data.total,1);assert.equal(list.data.guests[0].isMine,false);assert.equal(list.data.guests[0].owner,undefined);assert.equal((await request(`/api/guests/${id}`,'PATCH',payload,secondCookie)).status,403);assert.equal((await request(`/api/guests/${id}`,'DELETE',{},secondCookie)).status,403)});
test('edits, avatar action and final position persist across reads',async()=>{assert.equal((await request(`/api/guests/${id}`,'PATCH',{...payload,message:'수정된 축하',avatar:{...payload.avatar,action:'clap'}})).status,200);assert.equal((await request(`/api/guests/${id}/position`,'PATCH',{x:820,y:720})).status,200);const g=(await request('/api/guests')).data.guests[0];assert.equal(g.message,'수정된 축하');assert.equal(g.avatar.action,'clap');assert.equal(g.x,820);assert.equal(g.y,720)});
test('action changes preserve another tab’s current message and outfit',async()=>{const result=await request(`/api/guests/${id}/action`,'PATCH',{action:'wave',message:'오래된 내용',avatar:{outfit:0}});assert.equal(result.status,200);assert.equal(result.data.guest.message,'수정된 축하');assert.equal(result.data.guest.avatar.outfit,10);assert.equal(result.data.guest.avatar.action,'wave');assert.equal((await request(`/api/guests/${id}/action`,'PATCH',{action:'unknown'})).status,400)});
test('an outfit edit during a slow action request is preserved',async()=>{const bytes=Buffer.from('{"action":"dance"}');const pending=new Promise((resolve,reject)=>{const req=http.request(`${base}/api/guests/${id}/action`,{method:'PATCH',headers:{'Content-Type':'application/json','Content-Length':bytes.length,Cookie:cookie}},res=>{const parts=[];res.on('data',c=>parts.push(c));res.on('end',()=>resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))))});req.on('error',reject);req.flushHeaders();req.write(bytes.subarray(0,5));setTimeout(async()=>{try{await request(`/api/guests/${id}`,'PATCH',{...payload,avatar:{...payload.avatar,outfit:7}});req.end(bytes.subarray(5))}catch(e){reject(e)}},40)});const result=await pending;assert.equal(result.guest.avatar.outfit,7);assert.equal(result.guest.avatar.action,'dance')});
test('cross-origin mutation is rejected',async()=>{const r=await fetch(`${base}/api/guests/${id}`,{method:'DELETE',headers:{Origin:'https://not-this-site.example','Content-Type':'application/json',Cookie:cookie},body:'{}'});assert.equal(r.status,403)});
test('late action and position requests cannot overwrite later choices',async()=>{
 const clientId='a1234567-b123-c123-d123-e12345678901';
 for(const [channel,older,newer] of [['action',{action:'wave'},{action:'clap'}],['position',{x:768,y:500},{x:820,y:720}]]){
  const bytes=Buffer.from(JSON.stringify({...older,clientId,version:1}));
  const response=await new Promise((resolve,reject)=>{
   const req=http.request(`${base}/api/guests/${id}/${channel}`,{method:'PATCH',headers:{'Content-Type':'application/json','Content-Length':bytes.length,Cookie:cookie}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))))});
   req.on('error',reject);req.flushHeaders();req.write(bytes.subarray(0,5));
   setTimeout(async()=>{try{const latest=await request(`/api/guests/${id}/${channel}`,'PATCH',{...newer,clientId,version:2});assert.equal(latest.status,200);req.end(bytes.subarray(5))}catch(error){req.destroy();reject(error)}},40);
  });
  assert.equal(response.applied,false);
 }
 const guest=(await request('/api/guests')).data.guests.find(g=>g.id===id);
 assert.equal(guest.avatar.action,'clap');assert.equal(guest.x,820);assert.equal(guest.y,720);
});
test('profile edits and action requests share the latest action order',async()=>{
 const clientId='b1234567-b123-c123-d123-e12345678901';
 const delayed=await slowPatch(`/api/guests/${id}/action`,{action:'wave',clientId,version:1},async()=>{
  const edited=await request(`/api/guests/${id}`,'PATCH',{...payload,avatar:{...payload.avatar,outfit:7,action:'dance'},clientId,version:2});assert.equal(edited.status,200);
 });
 assert.equal(delayed.data.applied,false);assert.equal(delayed.data.guest.avatar.action,'dance');
 const edited=await slowPatch(`/api/guests/${id}`,{...payload,avatar:{...payload.avatar,outfit:12,action:'wave'},clientId,version:3},async()=>{assert.equal((await request(`/api/guests/${id}/action`,'PATCH',{action:'clap',clientId,version:4})).status,200)});
 assert.equal(edited.status,200);assert.equal(edited.data.guest.avatar.action,'clap');assert.equal(edited.data.guest.avatar.outfit,12);
});
test('multiple accessories persist and action-only edits preserve the combination',async()=>{
 const result=await request(`/api/guests/${id}`,'PATCH',{...payload,avatar:{...payload.avatar,accessories:[1,3,4,8,10,14,15,-1,99]}});
 assert.deepEqual(result.data.guest.avatar.accessories,[3,4,8,10,14,15]);
 const changed=await request(`/api/guests/${id}/action`,'PATCH',{action:'clap'});assert.deepEqual(changed.data.guest.avatar.accessories,[3,4,8,10,14,15]);
 const cleared=await request(`/api/guests/${id}`,'PATCH',{...payload,avatar:{...payload.avatar,accessory:4,accessories:[]}});assert.deepEqual(cleared.data.guest.avatar.accessories,[]);assert.equal(cleared.data.guest.avatar.accessory,0);
});
test('deletion removes shared guest and old request cannot recreate it',async()=>{assert.equal((await request(`/api/guests/${id}`,'DELETE',{})).status,200);assert.equal((await request('/api/guests')).data.total,0);assert.equal((await request('/api/guests','POST',payload)).status,410)});
test('repeating a completed deletion succeeds while missing updates remain not-found',async()=>{
 const result=await request(`/api/guests/${id}`,'DELETE',{});assert.equal(result.status,200);assert.equal(result.data.ok,true);
 assert.equal((await request(`/api/guests/${id}`,'PATCH',payload)).status,404);
 assert.equal((await request(`/api/guests/${id}/action`,'DELETE',{})).status,404);
});
test('UTF-8 Korean characters survive a request split inside a character',async()=>{const bytes=Buffer.from(JSON.stringify({...payload,name:'김민지'}));const split=bytes.indexOf(Buffer.from('김'))+1;const response=await new Promise((resolve,reject)=>{const req=http.request(base+'/api/guests',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':bytes.length,Cookie:secondCookie,'Idempotency-Key':'utf8-boundary-test'}},res=>{const parts=[];res.on('data',c=>parts.push(c));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(parts).toString('utf8'))}))});req.on('error',reject);req.flushHeaders();req.write(bytes.subarray(0,split));setTimeout(()=>req.end(bytes.subarray(split)),40)});assert.equal(response.status,201);assert.equal(response.data.guest.name,'김민지');await request(`/api/guests/${response.data.guest.id}`,'DELETE',{},secondCookie)});
test('deleting an early guest keeps extended positions and reuses the empty slot',async()=>{
 const registered=[];
 for(let i=0;i<21;i++){const session=(await request('/api/config','GET',undefined,'')).cookie;const result=await request('/api/guests','POST',{...payload,name:`자리 확인 ${i}`},session,`slot-test-key-${i}`);assert.equal(result.status,201);registered.push({...result.data.guest,session})}
 const last=registered[20];assert.equal(last.slot,20);assert.equal(last.y,slotPosition(20).y);
 await request(`/api/guests/${registered[0].id}`,'DELETE',{},registered[0].session);
 assert.equal((await request(`/api/guests/${last.id}/position`,'PATCH',{x:last.x,y:last.y},last.session)).status,200);
 const list=(await request('/api/guests')).data;assert.equal(list.worldHeight,2048);assert.equal(list.guests.find(g=>g.id===last.id).y,last.y);
 const session=(await request('/api/config','GET',undefined,'')).cookie;
 const replacement=await request('/api/guests','POST',payload,session,'slot-gap-replacement');assert.equal(replacement.status,201);assert.equal(replacement.data.guest.slot,0);
 const updated=(await request('/api/guests')).data.guests;assert.equal(new Set(updated.map(g=>g.slot)).size,21);assert.equal(updated.find(g=>g.id===last.id).y,last.y);
 for(const guest of registered.slice(1))await request(`/api/guests/${guest.id}`,'DELETE',{},guest.session);
 await request(`/api/guests/${replacement.data.guest.id}`,'DELETE',{},session);
});
test('deleting during a profile request returns not-found instead of a server error',async()=>{
 const session=(await request('/api/config','GET',undefined,'')).cookie;
 const created=await request('/api/guests','POST',payload,session,'delete-profile-race'),guestId=created.data.guest.id;
 const updated=await slowPatch(`/api/guests/${guestId}`,payload,async()=>{assert.equal((await request(`/api/guests/${guestId}`,'DELETE',{},session)).status,200)},session);
 assert.equal(updated.status,404);assert.equal(updated.data.error,'메시지를 찾을 수 없어요.');
});
test('retired reactions normalize in saved profiles and explicit reaction requests reject them',async()=>{
 for(const action of ['bow','jump','heart','spin']){
  const session=(await request('/api/config','GET',undefined,'')).cookie;
  const created=await request('/api/guests','POST',{...payload,avatar:{...payload.avatar,action}},session,`retired-create-${action}`);
  assert.equal(created.status,201);assert.equal(created.data.guest.avatar.action,'idle');
  const guestId=created.data.guest.id;
  try{
   assert.equal((await request(`/api/guests/${guestId}/action`,'PATCH',{action:'clap'},session)).status,200);
   const rejected=await request(`/api/guests/${guestId}/action`,'PATCH',{action},session);
   assert.equal(rejected.status,400);
   assert.equal((await request('/api/guests','GET',undefined,session)).data.guests.find(g=>g.id===guestId).avatar.action,'clap');
   const edited=await request(`/api/guests/${guestId}`,'PATCH',{...payload,avatar:{...payload.avatar,action}},session);
   assert.equal(edited.status,200);assert.equal(edited.data.guest.avatar.action,'idle');
  }finally{await request(`/api/guests/${guestId}`,'DELETE',{},session)}
 }
});
test('legacy stored reactions read as idle without rewriting the saved guest',async()=>{
 const session=(await request('/api/config','GET',undefined,'')).cookie;
 const created=await request('/api/guests','POST',payload,session,'retired-legacy-read'),guestId=created.data.guest.id;
 assert.equal(created.status,201);
 // Only this suite's throwaway database is edited to represent a pre-upgrade record.
 const fixtureDb=new DatabaseSync(join(dir,'test.sqlite'));
 try{
  for(const action of ['bow','jump','heart','spin']){
   const storedAvatar=JSON.stringify({...created.data.guest.avatar,action});
   fixtureDb.prepare('UPDATE guests SET avatar=? WHERE id=?').run(storedAvatar,guestId);
   const guest=(await request('/api/guests','GET',undefined,session)).data.guests.find(g=>g.id===guestId);
   assert.equal(guest.avatar.action,'idle');assert.equal(guest.avatar.outfit,payload.avatar.outfit);assert.equal(guest.message,payload.message);
   assert.equal(fixtureDb.prepare('SELECT avatar FROM guests WHERE id=?').get(guestId).avatar,storedAvatar);
  }
 }finally{fixtureDb.close();await request(`/api/guests/${guestId}`,'DELETE',{},session)}
});
