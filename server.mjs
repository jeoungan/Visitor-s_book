import http from 'node:http';
import {nextFreeSlot,slotPosition,gardenHeight} from './public/world.js';
import {nearestPoint} from './public/navigation.js';
import {selectedAccessories} from './public/accessories.js';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.GARDEN_DB || resolve(root, 'data/garden.sqlite');
await mkdir(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS guests (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, side TEXT NOT NULL,
 message TEXT NOT NULL, avatar TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS guest_owner_unique ON guests(owner);
 CREATE TABLE IF NOT EXISTS requests(owner TEXT NOT NULL, request_key TEXT NOT NULL, payload_hash TEXT NOT NULL, guest_id TEXT NOT NULL, PRIMARY KEY(owner,request_key));`);
if(!db.prepare('PRAGMA table_info(guests)').all().some(column=>column.name==='slot')){
 db.exec('BEGIN');try{
  db.exec('ALTER TABLE guests ADD COLUMN slot INTEGER');
  const existing=db.prepare('SELECT id,x,y FROM guests ORDER BY created_at,id').all(),assigned=new Map(),used=[];
  for(const row of existing){const tile=Math.floor(row.y/1024),line=(row.y-tile*1024-340)/140,column=[420,560,768,980,1110].indexOf(row.x);if(column>=0&&Number.isInteger(line)&&line>=0&&line<4){const slot=tile*20+line*5+column;if(!used.includes(slot)){assigned.set(row.id,slot);used.push(slot)}}}
  for(const row of existing){const slot=assigned.get(row.id)??nextFreeSlot(used);used.push(slot);db.prepare('UPDATE guests SET slot=? WHERE id=?').run(slot,row.id)}
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error}
}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS guest_slot_unique ON guests(slot);
 CREATE TABLE IF NOT EXISTS motion_versions(guest_id TEXT NOT NULL, client_id TEXT NOT NULL, channel TEXT NOT NULL, version INTEGER NOT NULL, PRIMARY KEY(guest_id,client_id,channel));`);
const currentWorldHeight=()=>gardenHeight(db.prepare('SELECT slot,y FROM guests').all());
function acceptMotion(guestId,channel,input){
 if(input.clientId===undefined&&input.version===undefined)return true;
 if(typeof input.clientId!=='string'||!/^[a-f0-9-]{36}$/.test(input.clientId)||!Number.isSafeInteger(input.version)||input.version<1)throw Object.assign(new Error('요청 순서 정보를 확인해 주세요.'),{status:400});
 const old=db.prepare('SELECT version FROM motion_versions WHERE guest_id=? AND client_id=? AND channel=?').get(guestId,input.clientId,channel);
 if(old&&old.version>=input.version)return false;
 db.prepare('INSERT INTO motion_versions VALUES (?,?,?,?) ON CONFLICT(guest_id,client_id,channel) DO UPDATE SET version=excluded.version').run(guestId,input.clientId,channel,input.version);return true;
}
const json = (res, code, value, headers={}) => { res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store', ...headers }); res.end(JSON.stringify(value)); };
const hash = s => createHash('sha256').update(s).digest('hex');
const publicGuest = (g,owner) => ({id:g.id,name:g.name,side:g.side,message:g.message,avatar:JSON.parse(g.avatar),x:g.x,y:g.y,createdAt:g.created_at,updatedAt:g.updated_at,slot:g.slot,isMine:g.owner===owner});
const rate = new Map();
setInterval(()=>{const now=Date.now(); for(const [key,value] of rate) if(value.until<now)rate.delete(key)},60000).unref();
function avatar(v={}) {
 if(!v||typeof v!=='object'||Array.isArray(v))throw Object.assign(new Error('캐릭터 정보를 확인해 주세요.'),{status:400});
 const integer=(k,max,def=0)=>Number.isInteger(v[k])&&v[k]>=0&&v[k]<=max?v[k]:def;
 const color=(k,def)=>/^#[0-9a-fA-F]{6}$/.test(v[k])?v[k]:def;
 const accessories=selectedAccessories(v);
 return {outfit:integer('outfit',15),hair:integer('hair',15),skin:integer('skin',5),hairColor:color('hairColor','#352b2a'),outfitColor:color('outfitColor','#344863'),recolor:!!v.recolor,accessory:accessories[0]??0,accessories,action:['idle','wave','bow','dance','clap','jump','heart','spin'].includes(v.action)?v.action:'idle'};
}
async function body(req) { const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>20000)throw Object.assign(new Error('요청이 너무 커요.'),{status:413});chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('올바른 요청이 아니에요.'),{status:400})} }

function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(new Error('올바른 요청이 아니에요.'),{status:400});
 if(typeof input.name!=='string'||!input.name.trim()||[...input.name.trim()].length>20)throw Object.assign(new Error('이름은 1~20자로 적어 주세요.'),{status:400});
 if(typeof input.message!=='string'||!input.message.trim()||[...input.message.trim()].length>120)throw Object.assign(new Error('축하 메시지는 1~120자로 적어 주세요.'),{status:400});
 if(!['groom','bride','both'].includes(input.side))throw Object.assign(new Error('어느 쪽 손님인지 골라 주세요.'),{status:400});
 if(input.consent!==true)throw Object.assign(new Error('방명록 공개에 동의해 주세요.'),{status:400});
 return {name:input.name.trim(),message:input.message.trim(),side:input.side,avatar:avatar(input.avatar)};
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
   if(!['GET','HEAD'].includes(req.method)){
     const origin=req.headers.origin; if(origin&&new URL(origin).host!==req.headers.host)return json(res,403,{error:'허용되지 않은 요청이에요.'});
     if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON 요청이 필요해요.'});
   }
   let token=req.headers.cookie?.match(/(?:^|;\s*)garden_owner=([a-f0-9]{64})(?:;|$)/)?.[1];
   if(!token){token=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`garden_owner=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${process.env.NODE_ENV==='production'?'; Secure':''}`)}
   const owner=hash(token);
   if(url.pathname==='/api/config'&&req.method==='GET')return json(res,200,{title:'강정이네 웨딩 가든',invitationUrl:process.env.INVITATION_URL||null,photoMode:'local-palette',sharedStorage:true});
   if(url.pathname==='/api/guests'&&req.method==='GET'){
     const rows=db.prepare('SELECT * FROM guests ORDER BY created_at DESC LIMIT 2000').all();return json(res,200,{guests:rows.map(g=>publicGuest(g,owner)),total:db.prepare('SELECT count(*) AS n FROM guests').get().n,worldHeight:currentWorldHeight()});
   }
   if(url.pathname==='/api/guests'&&req.method==='POST'){
     const input=validate(await body(req));const requestKey=req.headers['idempotency-key'];
     if(typeof requestKey!=='string'||requestKey.length<8||requestKey.length>128)return json(res,400,{error:'등록 요청 번호가 필요해요.'});
     const hashInput={...input,avatar:{...input.avatar}};if(hashInput.avatar.accessories.length<=1)delete hashInput.avatar.accessories;
     const payloadHash=hash(JSON.stringify(hashInput));const previous=db.prepare('SELECT * FROM requests WHERE owner=? AND request_key=?').get(owner,requestKey);
     if(previous){if(previous.payload_hash!==payloadHash)return json(res,409,{error:'요청 내용이 달라졌어요. 다시 시도해 주세요.'});const saved=db.prepare('SELECT * FROM guests WHERE id=?').get(previous.guest_id);return saved?json(res,200,{guest:publicGuest(saved,owner)}):json(res,410,{error:'이미 삭제한 메시지예요.'})}
     const rl=rate.get(owner);if(rl?.until>Date.now())return json(res,429,{error:'잠시 후 다시 남겨 주세요.'});
     if(db.prepare('SELECT id FROM guests WHERE owner=?').get(owner))return json(res,409,{error:'이미 남긴 메시지가 있어요. 내 캐릭터에서 수정해 주세요.'});
     const id=randomBytes(12).toString('hex'),now=new Date().toISOString();const slot=nextFreeSlot(db.prepare('SELECT slot FROM guests').all().map(row=>row.slot));const {x:spawnX,y:spawnY}=slotPosition(slot);
     db.exec('BEGIN');try{db.prepare('INSERT INTO guests (id,owner,name,side,message,avatar,x,y,created_at,updated_at,slot) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,owner,input.name,input.side,input.message,JSON.stringify(input.avatar),spawnX,spawnY,now,now,slot);db.prepare('INSERT INTO requests VALUES (?,?,?,?)').run(owner,requestKey,payloadHash,id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
     rate.set(owner,{until:Date.now()+2500});return json(res,201,{guest:publicGuest(db.prepare('SELECT * FROM guests WHERE id=?').get(id),owner)});
   }
   const match=url.pathname.match(/^\/api\/guests\/([a-f0-9]{24})(\/(?:position|action))?$/);
   if(match){
     const row=db.prepare('SELECT * FROM guests WHERE id=?').get(match[1]);
     if(!row){if(req.method==='DELETE'&&!match[2])return json(res,200,{ok:true});return json(res,404,{error:'메시지를 찾을 수 없어요.'})}
     if(!timingSafeEqual(Buffer.from(row.owner),Buffer.from(owner)))return json(res,403,{error:'내 메시지만 수정할 수 있어요.'});
     if(req.method==='PATCH'&&match[2]==='/position'){
      const p=await body(req);if(!p||typeof p!=='object'||!Number.isFinite(p.x)||!Number.isFinite(p.y))return json(res,400,{error:'올바르지 않은 위치예요.'});
      if(!db.prepare('SELECT id FROM guests WHERE id=?').get(row.id))return json(res,404,{error:'메시지를 찾을 수 없어요.'});
      if(!acceptMotion(row.id,'position',p))return json(res,200,{ok:true,applied:false});
      const point=nearestPoint(p,currentWorldHeight());db.prepare('UPDATE guests SET x=?,y=? WHERE id=?').run(point.x,point.y,row.id);return json(res,200,{ok:true,applied:true});
     }
     if(req.method==='PATCH'&&match[2]==='/action'){const p=await body(req);if(!p||!['idle','wave','bow','dance','clap','jump','heart','spin'].includes(p.action))return json(res,400,{error:'동작을 다시 골라 주세요.'});const latest=db.prepare('SELECT avatar FROM guests WHERE id=?').get(row.id);if(!latest)return json(res,404,{error:'메시지를 찾을 수 없어요.'});if(!acceptMotion(row.id,'action',p))return json(res,200,{guest:publicGuest(db.prepare('SELECT * FROM guests WHERE id=?').get(row.id),owner),applied:false});const current=JSON.parse(latest.avatar);current.action=p.action;db.prepare('UPDATE guests SET avatar=?,updated_at=? WHERE id=?').run(JSON.stringify(current),new Date().toISOString(),row.id);return json(res,200,{guest:publicGuest(db.prepare('SELECT * FROM guests WHERE id=?').get(row.id),owner)});}
     if(req.method==='PATCH'&&!match[2]){const raw=await body(req),input=validate(raw),latest=db.prepare('SELECT * FROM guests WHERE id=?').get(row.id);if(!latest)return json(res,404,{error:'메시지를 찾을 수 없어요.'});if(!acceptMotion(row.id,'action',raw))input.avatar.action=JSON.parse(latest.avatar).action;db.prepare('UPDATE guests SET name=?,side=?,message=?,avatar=?,updated_at=? WHERE id=?').run(input.name,input.side,input.message,JSON.stringify(input.avatar),new Date().toISOString(),row.id);return json(res,200,{guest:publicGuest(db.prepare('SELECT * FROM guests WHERE id=?').get(row.id),owner)});}
     if(req.method==='DELETE'&&!match[2]){db.prepare('DELETE FROM motion_versions WHERE guest_id=?').run(row.id);db.prepare('DELETE FROM guests WHERE id=?').run(row.id);return json(res,200,{ok:true});}
   }
   return json(res,404,{error:'요청한 기능을 찾을 수 없어요.'});
 }
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'허용되지 않는 요청이에요.'});
 const pathname=decodeURIComponent(url.pathname);const file=resolve(root,'public',pathname==='/'||pathname==='/guestbook/'?'index.html':'.'+pathname);
 if(!file.startsWith(resolve(root,'public')+sep))return json(res,403,{error:'접근할 수 없어요.'});
 try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':pathname.startsWith('/assets/')?'public, max-age=3600':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes)}catch{return json(res,404,{error:'페이지를 찾을 수 없어요.'})}
 }catch(e){json(res,e.status||500,{error:e.status?e.message:'저장 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'}); if(!e.status)console.error(e)}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`Wedding garden ready at http://127.0.0.1:${process.env.PORT||4173}/guestbook/`));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0)}));
