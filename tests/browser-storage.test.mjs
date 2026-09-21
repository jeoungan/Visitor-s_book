import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserStorage,BROWSER_STORAGE_KEY} from '../public/browser-storage.js';
import {walkable} from '../public/navigation.js';

const clientId='12345678-1234-1234-1234-123456789abc';
const values={name:'민지',message:'오래오래 행복하세요!',side:'both',consent:true,avatar:{outfit:10,hair:12,skin:2,hairColor:'#abcdef',outfitColor:'#123456',recolor:true,accessories:[2,4,8,12,14,15],action:'wave'}};
const post=(value=values,key='request-number-1')=>({method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(value)});
const patch=value=>({method:'PATCH',body:JSON.stringify(value)});
const status=code=>error=>error.status===code;
function fixture(){
 const items=new Map();let sequence=0,writeError=null,readError=null;
 const storage={getItem(key){if(readError)throw readError;return items.get(key)??null},setItem(key,value){if(writeError)throw writeError;items.set(key,value)}};
 const options={storage,now:()=>`2026-09-21T00:00:${String(sequence).padStart(2,'0')}.000Z`,randomId:()=>String(++sequence).padStart(24,'0'),locks:null};
 return{api:createBrowserStorage(options),reload:()=>createBrowserStorage(options),items,failWrites(error){writeError=error},failReads(error){readError=error}};
}

test('Pages configuration explicitly identifies browser-only storage without requiring its availability',async()=>{
 const api=createBrowserStorage({storage:()=>{throw new Error('blocked')},locks:null});
 assert.deepEqual(await api('/api/config'),{title:'강정이네 웨딩 가든',invitationUrl:null,photoMode:'local-palette',sharedStorage:false,storageMode:'browser'});
 await assert.rejects(api('/api/guests'),error=>error.status===503&&/브라우저 저장소/.test(error.message));
});

test('a browser guest survives reload and preserves outfit, colors, accessories and ownership',async()=>{
 const h=fixture();assert.deepEqual(await h.api('/api/guests'),{guests:[],total:0,worldHeight:1024});
 const {guest}=await h.api('/api/guests',post());
 assert.equal(guest.isMine,true);assert.equal(guest.name,values.name);assert.equal(guest.slot,0);assert.equal(guest.avatar.accessory,2);
 assert.deepEqual(guest.avatar.accessories,values.avatar.accessories);assert.equal(guest.avatar.hair,12);assert.equal(guest.avatar.outfitColor,'#123456');assert.equal(guest.avatar.action,'wave');
 assert.equal(walkable(guest.x,guest.y),true);
 const saved=await h.reload()('/api/guests');assert.deepEqual(saved.guests,[guest]);assert.equal(saved.total,1);
 guest.avatar.accessories.length=0;assert.equal((await h.api('/api/guests')).guests[0].avatar.accessories.length,6);
 await assert.rejects(h.api('/api/guests',post(values,'different-request')),status(409));
});

test('registration retries are idempotent across reloads and changed payloads conflict',async()=>{
 const h=fixture(),first=await h.api('/api/guests',post());
 assert.deepEqual(await h.reload()('/api/guests',post()),first);
 await assert.rejects(h.api('/api/guests',post({...values,name:'다른 이름'})),status(409));
 assert.equal((await h.api('/api/guests')).total,1);
});

test('deletion persists and retry receipts cannot recreate a deleted message',async()=>{
 const h=fixture(),{guest}=await h.api('/api/guests',post());
 const path=`/api/guests/${guest.id}`;
 assert.deepEqual(await h.api(path,{method:'DELETE'}),{ok:true});
 assert.deepEqual(await h.reload()(path,{method:'DELETE'}),{ok:true});
 assert.equal((await h.reload()('/api/guests')).total,0);
 await assert.rejects(h.reload()('/api/guests',post()),status(410));
 const replacement=await h.api('/api/guests',post(values,'replacement-key'));
 assert.notEqual(replacement.guest.id,guest.id);
 await assert.rejects(h.api('/api/guests',post()),status(410));
 await assert.rejects(h.api(path+'/action',patch({action:'clap'})),status(404));
});

test('profile edits persist and removed actions normalize to the resting pose',async()=>{
 const h=fixture(),{guest}=await h.api('/api/guests',post({...values,avatar:{accessory:12,action:'spin'}}));
 assert.equal(guest.avatar.action,'idle');assert.deepEqual(guest.avatar.accessories,[12]);
 const changed=await h.api(`/api/guests/${guest.id}`,patch({...values,name:' 수정된 이름 ',avatar:{outfit:100,hair:-1,skin:9,accessories:[1,2,4,6,8,999],hairColor:'invalid',action:'dance'}}));
 assert.equal(changed.guest.name,'수정된 이름');assert.deepEqual(changed.guest.avatar.accessories,[2,6,8]);
 assert.equal(changed.guest.avatar.outfit,0);assert.equal(changed.guest.avatar.skin,0);assert.equal(changed.guest.avatar.hairColor,'#352b2a');
 assert.deepEqual((await h.reload()('/api/guests')).guests[0],changed.guest);
});

test('motion versions reject late actions, keep independent position ordering, and survive reload',async()=>{
 const h=fixture(),{guest}=await h.api('/api/guests',post()),path=`/api/guests/${guest.id}`;
 await h.api(path+'/action',patch({action:'clap',clientId,version:3}));
 const late=await h.reload()(path+'/action',patch({action:'wave',clientId,version:2}));
 assert.equal(late.applied,false);assert.equal(late.guest.avatar.action,'clap');
 assert.deepEqual(await h.api(path+'/position',patch({x:700,y:800,clientId,version:1})),{ok:true,applied:true});
 const position=(await h.api('/api/guests')).guests[0];
 assert.deepEqual(await h.reload()(path+'/position',patch({x:300,y:500,clientId,version:1})),{ok:true,applied:false});
 assert.equal((await h.api('/api/guests')).guests[0].x,position.x);
 const edited=await h.api(path,patch({...values,name:'프로필 수정',clientId,version:2}));
 assert.equal(edited.guest.avatar.action,'clap');assert.equal(edited.guest.name,'프로필 수정');
 await h.api(path+'/action',patch({action:'dance',clientId:'abcdefab-1234-1234-1234-123456789abc',version:1}));
 assert.equal((await h.api('/api/guests')).guests[0].avatar.action,'dance');
});

test('position updates snap to walkable space and invalid motion is rejected without state changes',async()=>{
 const h=fixture(),{guest}=await h.api('/api/guests',post()),path=`/api/guests/${guest.id}`;
 await h.api(path+'/position',patch({x:-10000,y:99999,clientId,version:1}));
 const saved=(await h.api('/api/guests')).guests[0];assert.equal(walkable(saved.x,saved.y),true);assert.ok(saved.y<1024);
 for(const input of [{x:'12',y:40},{x:12,y:null},{x:12,y:40,clientId,version:0},{x:12,y:40,clientId:'invalid',version:2}])await assert.rejects(h.api(path+'/position',patch(input)),status(400));
 await assert.rejects(h.api(path+'/action',patch({action:'spin'})),status(400));
 assert.deepEqual((await h.api('/api/guests')).guests[0],saved);
});

test('validation accepts Unicode boundaries, requires consent, and rejects malformed bodies',async()=>{
 const h=fixture();
 for(const value of [{...values,name:'  '},{...values,name:'가'.repeat(21)},{...values,message:'♥'.repeat(121)},{...values,side:'other'},{...values,consent:false},{...values,avatar:[]},null])await assert.rejects(h.api('/api/guests',post(value)),status(400));
 await assert.rejects(h.api('/api/guests',{...post(),body:'{'}),status(400));
 await assert.rejects(h.api('/api/guests',post(values,'short')),status(400));
 await assert.rejects(h.api('/api/guests',{...post(),body:' '.repeat(20001)}),status(413));
 const result=await h.api('/api/guests',post({...values,name:'😀'.repeat(20),message:'🎉'.repeat(120)}));
 assert.equal([...result.guest.name].length,20);assert.equal([...result.guest.message].length,120);
});

test('quota failures never claim registration success or reserve an idempotency key',async()=>{
 const h=fixture();h.failWrites(Object.assign(new Error('full'),{name:'QuotaExceededError'}));
 await assert.rejects(h.api('/api/guests',post()),error=>error.status===507&&/저장 공간/.test(error.message));
 assert.equal((await h.reload()('/api/guests')).total,0);assert.equal(h.items.size,0);
 h.failWrites(null);assert.equal((await h.api('/api/guests',post())).guest.name,values.name);
});

test('failed action and delete writes preserve the guest and leave motion versions retryable',async()=>{
 const h=fixture(),{guest}=await h.api('/api/guests',post()),path=`/api/guests/${guest.id}`,before=h.items.get(BROWSER_STORAGE_KEY);
 h.failWrites(new Error('storage blocked'));
 await assert.rejects(h.api(path+'/action',patch({action:'clap',clientId,version:1})),status(503));
 await assert.rejects(h.api(path,{method:'DELETE'}),status(503));
 assert.equal(h.items.get(BROWSER_STORAGE_KEY),before);assert.equal((await h.reload()('/api/guests')).guests[0].avatar.action,'wave');
 h.failWrites(null);const result=await h.api(path+'/action',patch({action:'clap',clientId,version:1}));
 assert.equal(result.guest.avatar.action,'clap');assert.notEqual(result.applied,false);
});

test('unreadable or corrupted persisted data is reported and never silently overwritten',async()=>{
 const h=fixture();h.failReads(new Error('denied'));
 await assert.rejects(h.api('/api/guests'),status(503));h.failReads(null);
 for(const raw of ['not-json','{}','{"version":1,"guest":{},"requests":[],"motionVersions":[]}']){
  h.items.set(BROWSER_STORAGE_KEY,raw);
  await assert.rejects(h.api('/api/guests',post()),error=>error.status===503&&/덮어쓰지/.test(error.message));
  assert.equal(h.items.get(BROWSER_STORAGE_KEY),raw);
 }
});

test('separate adapter instances read current storage and use an exclusive cross-tab lock when available',async()=>{
 const h=fixture(),calls=[],lock={request:async(name,options,callback)=>{calls.push({name,...options});return callback()}};
 const api=createBrowserStorage({storage:{getItem:key=>h.items.get(key)??null,setItem:(key,value)=>h.items.set(key,value)},locks:lock});
 await h.api('/api/guests',post());assert.equal((await api('/api/guests')).total,1);
 assert.deepEqual(calls,[{name:BROWSER_STORAGE_KEY,mode:'exclusive'}]);
 const id=(await api('/api/guests')).guests[0].id;
 await api(`/api/guests/${id}`,{method:'DELETE'});assert.equal((await h.api('/api/guests')).total,0);
});
