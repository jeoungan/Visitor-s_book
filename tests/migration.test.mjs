import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const slotPosition=slot=>({x:[420,560,768,980,1110][slot%5],y:Math.floor(slot/20)*1024+340+Math.floor(slot%20/5)*140});
import {defaultAvatar} from '../public/avatar.js';
import {createHash} from 'node:crypto';

test('legacy migration preserves deleted slot gaps, data and expanded positions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'garden-migration-')),path=join(dir,'legacy.sqlite'),db=new DatabaseSync(path);
 db.exec('CREATE TABLE guests (id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,side TEXT NOT NULL,message TEXT NOT NULL,avatar TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
 const insert=db.prepare('INSERT INTO guests VALUES (?,?,?,?,?,?,?,?,?,?)');
 for(let slot=1;slot<=20;slot++){const {x,y}=slotPosition(slot);insert.run(slot.toString(16).padStart(24,'0'),'a'.repeat(62)+slot.toString(16).padStart(2,'0'),`기존 하객 ${slot}`,'both','보존할 축하',JSON.stringify(defaultAvatar()),x,y,'2026-09-19','2026-09-19')}
 const token='b'.repeat(64),hash=value=>createHash('sha256').update(value).digest('hex'),owner=hash(token),oldPayload={name:'기존 하객 1',message:'보존할 축하',side:'both',avatar:defaultAvatar()};
 db.prepare('UPDATE guests SET owner=? WHERE id=?').run(owner,'1'.padStart(24,'0'));
 db.exec('CREATE TABLE requests(owner TEXT NOT NULL,request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,guest_id TEXT NOT NULL,PRIMARY KEY(owner,request_key))');
 db.prepare('INSERT INTO requests VALUES (?,?,?,?)').run(owner,'legacy-request-key',hash(JSON.stringify(oldPayload)),'1'.padStart(24,'0'));
 db.close();
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'4186',GARDEN_DB:path},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{if(b.toString().includes('ready'))resolve()});child.once('error',reject);child.once('exit',code=>reject(new Error(`exit ${code}`)))});
  const response=await fetch('http://127.0.0.1:4186/api/guests'),data=await response.json();
  assert.equal(data.total,20);assert.equal(data.worldHeight,2048);
  for(let slot=1;slot<=20;slot++){const guest=data.guests.find(g=>g.name===`기존 하객 ${slot}`);assert.equal(guest.slot,slot);assert.equal(guest.message,'보존할 축하');assert.deepEqual({x:guest.x,y:guest.y},slotPosition(slot))}
  const replay=await fetch('http://127.0.0.1:4186/api/guests',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'legacy-request-key',Cookie:`garden_owner=${token}`},body:JSON.stringify({...oldPayload,consent:true})});assert.equal(replay.status,200);assert.equal((await replay.json()).guest.id,'1'.padStart(24,'0'));
  const created=await fetch('http://127.0.0.1:4186/api/guests',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'migration-new-guest'},body:JSON.stringify({name:'새 하객',message:'축하합니다',side:'both',consent:true,avatar:defaultAvatar()})});
  assert.equal(created.status,201);assert.equal((await created.json()).guest.slot,0);
 }finally{const ended=new Promise(resolve=>child.once('exit',resolve));child.kill();await ended;assert.ok(dir.startsWith(join(tmpdir(),'garden-migration-')));await rm(dir,{recursive:true,force:true})}
});
