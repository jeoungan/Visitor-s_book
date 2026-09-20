// Manual browser QA: an isolated guestbook plus one deliberate configuration failure.
// Run with `node tests/browser-fixture.mjs`, visit port 4189, then Ctrl+C to clean up.
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaultAvatar} from '../public/avatar.js';
const dir=await mkdtemp(join(tmpdir(),'garden-browser-'));
const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'4188',GARDEN_DB:join(dir,'fixture.sqlite')},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{if(b.toString().includes('ready'))resolve()});child.once('error',reject);child.once('exit',code=>reject(new Error(`exit ${code}`)))});
const guestCount=Number(process.env.GARDEN_FIXTURE_COUNT||21);
if(!Number.isInteger(guestCount)||guestCount<0||guestCount>100)throw new Error('Fixture guest count must be 0–100');
for(let i=0;i<guestCount;i++){
 const response=await fetch('http://127.0.0.1:4188/api/guests',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':`browser-fixture-${i}`},body:JSON.stringify({name:i===20?'W'.repeat(20):`검증용 ${i}`,message:i===20?'W'.repeat(120):'별도 검증 환경입니다.',side:i===20?'bride':'groom',consent:true,avatar:{...defaultAvatar(),outfit:i%16,hair:i%16}})});
 if(!response.ok)throw new Error(`Fixture seed failed ${response.status}`);
}
const failure=process.env.GARDEN_FIXTURE_FAILURE||'config',failurePath=['delete-response','create-response'].includes(failure)?null:failure==='guests'?'/api/guests':'/api/config';let failOnce=true,loseDeleteResponse=failure==='delete-response',loseCreateResponse=failure==='create-response';
const proxy=http.createServer((req,res)=>{
 if(req.url===failurePath&&failOnce){failOnce=false;res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'검증용 최초 조회 실패'}));return}
 const upstream=http.request({hostname:'127.0.0.1',port:4188,path:req.url,method:req.method,headers:req.headers},response=>{
  if(loseDeleteResponse&&req.method==='DELETE'&&response.statusCode===200){loseDeleteResponse=false;response.resume();response.on('end',()=>{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'검증용 응답 유실입니다. 다시 눌러 주세요.'}))});return}
  if(loseCreateResponse&&req.method==='POST'&&req.url==='/api/guests'&&response.statusCode===201){loseCreateResponse=false;response.resume();response.on('end',()=>{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store',...(response.headers['set-cookie']?{'Set-Cookie':response.headers['set-cookie']}:{})});res.end(JSON.stringify({error:'검증용 등록 응답 유실입니다. 다시 눌러 주세요.'}))});return}
  res.writeHead(response.statusCode,response.headers);response.pipe(res)
 });upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream);
});
proxy.listen(4189,'127.0.0.1',()=>console.log(`Browser fixture ready: http://127.0.0.1:4189/guestbook/ (first ${failurePath} fails intentionally)\n${JSON.stringify({pid:process.pid,child:child.pid,dir})}\nType close and Enter to clean up.`));
let closing=false;
async function cleanup(){if(closing)return;closing=true;proxy.close();if(child.exitCode===null&&child.signalCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill();await ended}if(!dir.startsWith(join(tmpdir(),'garden-browser-')))throw new Error('Unexpected fixture path');await rm(dir,{recursive:true,force:true});process.exit(0)}
process.on('SIGINT',cleanup);process.on('SIGTERM',cleanup);
process.stdin.setEncoding('utf8');process.stdin.on('data',data=>{if(data.trim()==='close')cleanup()});
