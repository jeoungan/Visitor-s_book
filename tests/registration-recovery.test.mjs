import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual registration and ownership-recovery functions.
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const savedGuest={id:'registered-mine',isMine:true,name:'서버에 남은 이름',message:'서버에 남은 메시지',side:'bride',avatar:{outfit:4,action:'heart'},x:810,y:680,slot:0};
function harness(){
 const nodes=new Map(),requests=[],events=[];
 const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',dataset:{},disabled:false});return nodes.get(id)};
 const buttons=[$('#submit-guest'),$('#back-step')];let serial=0;
 const context=vm.createContext({$,$$:()=>buttons,crypto:{randomUUID:()=>`key-${++serial}`},clearTimeout,gardenHeight:()=>1024,captureForm(){},updateScene(){events.push('scene')},renderSuccess(){events.push('success')},garden:{player:{id:'visitor',x:768,y:500},setPlayer(g){this.player=g||{id:'visitor',x:768,y:500}}},api:(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))});
 vm.runInContext(`var busy=false,mutationEpoch=0,loadRevision=0,worldHeight=1024,pendingRequest=null,actionPending=false,actionRevision=0,actionSaveTimer,own=null,guests=[],motionClientId='12345678-1234-1234-1234-123456789012',draft={outfit:2,action:'wave'},form={name:'작성 중 이름',message:'작성 중 메시지',side:'both',consent:true};${section('async function loadGuests(','function showSpeech(')}${section('async function submitGuest(','function renderSuccess(')}`,context);
 return{context,requests,events,$,buttons,submit:()=>context.submitGuest({preventDefault(){}})};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function expectRecovery(h){assert.equal(h.requests.length,2,'failed new POST should initiate ownership recovery');assert.equal(h.requests[1].path,'/api/guests');assert.equal(h.requests[1].options.method,undefined)}

test('a lost registration response recovers ownership and preserves the edited form until PATCH',async()=>{
 const h=harness(),form=h.context.form,draft=h.context.draft,submission=h.submit(),key=h.context.pendingRequest.key;
 h.requests[0].reject(new Error('등록 응답 유실'));await settle();expectRecovery(h);
 h.requests[1].resolve({guests:[savedGuest],worldHeight:1024});await submission;
 assert.equal(h.context.own.id,savedGuest.id);assert.equal(h.context.form,form);assert.equal(h.context.draft,draft);
 assert.equal(form.message,'작성 중 메시지');assert.equal(draft.outfit,2);assert.equal(h.context.pendingRequest.key,key);
 assert.match(h.$('#form-error').textContent,/등록된 메시지를 확인/);assert.match(h.$('#submit-guest').textContent,/수정/);
 assert.equal(h.events.includes('success'),false);assert.equal(h.context.busy,false);assert.ok(h.buttons.every(b=>!b.disabled));
 form.message='복구 뒤 고친 내용';const update=h.submit(),request=h.requests[2];assert.equal(request.options.method,'PATCH');assert.equal(request.path,`/api/guests/${savedGuest.id}`);
 const sent=JSON.parse(request.options.body);assert.equal(sent.message,form.message);assert.equal(sent.avatar.outfit,2);
 request.resolve({guest:{...savedGuest,...sent}});await update;assert.equal(h.context.pendingRequest,null);assert.deepEqual(h.events.filter(x=>x==='success'),['success']);
});

test('a failed recovery GET keeps the form, initial error and request key for same-payload retry',async()=>{
 const h=harness(),submission=h.submit(),key=h.context.pendingRequest.key;
 h.requests[0].reject(new Error('첫 응답 실패'));await settle();expectRecovery(h);h.requests[1].reject(new Error('복구 조회도 실패'));await submission;
 assert.equal(h.context.own,null);assert.equal(h.context.pendingRequest.key,key);assert.equal(h.context.form.message,'작성 중 메시지');assert.equal(h.$('#form-error').textContent,'첫 응답 실패');assert.equal(h.context.busy,false);
 const retry=h.submit();assert.equal(h.requests[2].options.method,'POST');assert.equal(h.requests[2].options.headers['Idempotency-Key'],key);h.requests[2].resolve({guest:savedGuest});await retry;assert.equal(h.context.own.id,savedGuest.id);
});

test('a recovery list without my guest preserves the key and never edits another guest',async()=>{
 const h=harness(),submission=h.submit(),key=h.context.pendingRequest.key;
 h.requests[0].reject(new Error('연결 실패'));await settle();expectRecovery(h);h.requests[1].resolve({guests:[{...savedGuest,isMine:false}],worldHeight:1024});await submission;
 assert.equal(h.context.own,null);assert.equal(h.context.pendingRequest.key,key);assert.equal(h.$('#form-error').textContent,'연결 실패');
 const retry=h.submit();assert.equal(h.requests[2].options.method,'POST');assert.equal(h.requests[2].options.headers['Idempotency-Key'],key);h.requests[2].resolve({guest:savedGuest});await retry;
});

test('another tab already registered my guest: conflict recovery keeps the current draft and waits for explicit PATCH',async()=>{
 const h=harness(),submission=h.submit();
 h.requests[0].reject(Object.assign(new Error('이미 남긴 메시지가 있어요.'),{status:409}));await settle();expectRecovery(h);h.requests[1].resolve({guests:[savedGuest],worldHeight:1024});await submission;
 assert.equal(h.context.own.id,savedGuest.id);assert.equal(h.context.own.message,'서버에 남은 메시지');assert.equal(h.context.form.message,'작성 중 메시지');assert.equal(h.context.draft.outfit,2);assert.equal(h.requests.length,2);assert.equal(h.events.includes('success'),false);
});

test('a GET started before registration cannot replace ownership while POST is pending',async()=>{
 const h=harness(),older=h.context.loadGuests(),submission=h.submit();assert.equal(h.requests.length,2);
 h.requests[0].resolve({guests:[savedGuest],worldHeight:2048});assert.equal(await older,false);assert.equal(h.context.own,null);assert.equal(h.context.worldHeight,1024);assert.equal(h.events.length,0);
 h.requests[1].resolve({guest:savedGuest});await submission;assert.equal(h.context.own.id,savedGuest.id);
});

test('a stale pre-submit GET cannot replace the ownership recovered after an uncertain POST',async()=>{
 const h=harness(),older=h.context.loadGuests(),submission=h.submit();h.requests[1].reject(new Error('응답 유실'));await settle();assert.equal(h.requests.length,3);
 h.requests[2].resolve({guests:[savedGuest],worldHeight:1024});await submission;
 h.requests[0].resolve({guests:[],worldHeight:1024});assert.equal(await older,false);assert.equal(h.context.own.id,savedGuest.id);assert.equal(h.context.form.message,'작성 중 메시지');
});
