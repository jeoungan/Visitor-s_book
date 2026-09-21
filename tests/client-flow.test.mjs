import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Garden} from '../public/garden.js';
import {gardenHeight,slotPosition} from '../public/world.js';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));

test('late guest responses and failures cannot undo a newer successful refresh',async()=>{
 for(const staleFailure of [false,true]){
  const pending=[],nodes=new Map(),renders=[],$=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:''});return nodes.get(id)};
  const context=vm.createContext({$,api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),gardenHeight:()=>1024,garden:{player:{id:'visitor',x:768,y:500}},updateScene:()=>renders.push(context.guests.length)});
  vm.runInContext(`var loadRevision=0,mutationEpoch=0,actionPending=false,own=null,guests=[],worldHeight=1024;${section('async function loadGuests(','function showSpeech(')}`,context);
  const older=context.loadGuests(true),newer=context.loadGuests(true);
  pending[1].resolve({guests:[],worldHeight:1024});assert.equal(await newer,true);
  if(staleFailure)pending[0].reject(new Error('Earlier request failed'));else pending[0].resolve({guests:[{id:'deleted-guest',message:'옛 메시지'}]});
  assert.equal(await older,false);assert.equal(context.guests.length,0);assert.deepEqual(renders,[0]);assert.equal($('#storage-status').innerHTML,'');
 }
});

test('initial guestbook failure exposes a retry on the garden instead of hiding the loading panel',async()=>{
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,innerHTML:''});return nodes.get(id)};let reloads=0;
 const context=vm.createContext({$,loadAvatars:async()=>{},garden:{ready:Promise.resolve()},api:async()=>({}),loadGuests:async()=>false,location:{reload(){reloads++}},console:{error(){}}});
 await vm.runInContext(`(async()=>{var config;${section('try{await Promise.all([loadAvatars()', 'setInterval(')}})()`,context);
 assert.equal($('#loading').hidden,false);assert.match($('#loading').innerHTML,/다시 불러오기/);$('#retry-assets').onclick();assert.equal(reloads,1);
});

test('deletion ignores older refreshes, prevents double submission and remains retryable after failure',async()=>{
 const nodes=new Map(),pending=[],toasts=[],$=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,close(){this.closed=true}});return nodes.get(id)};
 const context=vm.createContext({$,clearTimeout,api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),toast:message=>toasts.push(message),updateScene(){},gardenHeight:()=>1024,garden:{player:{id:'mine'},setPlayer(){this.player={id:'visitor'}}}});
 vm.runInContext(`var busy=false,mutationEpoch=0,loadRevision=0,actionPending=false,actionRevision=0,actionSaveTimer,worldHeight=1024,own={id:'mine'},guests=[own,{id:'other'}];${section('async function loadGuests(','function showSpeech(')}${section("$('#confirm-delete').onclick=", "$('#menu-guestbook').onclick=")}`,context);
 Object.assign($('#speech'),{dataset:{guestId:'mine'},hidden:false});
 const oldRefresh=context.loadGuests(),deletion=$('#confirm-delete').onclick();await $('#confirm-delete').onclick();assert.equal(pending.length,2);assert.equal(context.busy,true);
 pending[0].resolve({guests:[{id:'other'}],worldHeight:1024});await oldRefresh;assert.equal(context.own.id,'mine');
 pending[1].reject(new Error('잠시 연결 실패'));await deletion;assert.equal(context.busy,false);assert.equal($('#confirm-delete').disabled,false);assert.equal(context.own.id,'mine');assert.deepEqual(toasts,['잠시 연결 실패']);
 const retry=$('#confirm-delete').onclick();pending[2].resolve({ok:true});await retry;
 assert.equal(context.own,null);assert.equal(context.guests.length,1);assert.equal(context.guests[0].id,'other');assert.equal(context.garden.player.id,'visitor');assert.equal($('#confirm-dialog').closed,true);assert.equal(context.busy,false);assert.equal($('#speech').hidden,true);
});

test('filtering while a second action is saving keeps the newly chosen action',async()=>{
 const timers=[],buttons=['idle','wave','clap'].map(action=>({dataset:{action},classList:{toggle(){}},setAttribute(){}})),nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)};
 const garden=Object.create(Garden.prototype);Object.assign(garden,{world:{w:1536,h:1024},npcStates:new Map(),guests:[],player:{id:'mine',x:729,y:835,avatar:{action:'idle'}},selected:null,route:[]});
 const context=vm.createContext({$,$$:()=>buttons,garden,actions:buttons.map(button=>[button.dataset.action,button.dataset.action]),api:async(_path,{body})=>({guest:{avatar:{action:JSON.parse(body).action}}}),toast(){},clearTimeout(){},setTimeout:fn=>{timers.push(fn);return timers.length},motionClientId:'test'});
 vm.runInContext(`var mutationEpoch=0,actionPending=false,actionRevision=0,actionSaveTimer,own={id:'mine',isMine:true,x:729,y:835,avatar:{action:'idle'}},guests=[own];${section('function syncActionState()',"$('#more').onclick=")}`,context);
 buttons[1].onclick();await timers.shift()();buttons[2].onclick();garden.setGuests(context.guests,1024);
 assert.equal(garden.player.avatar.action,'clap');assert.equal(context.own.avatar.action,'clap');assert.equal(context.guests[0].avatar.action,'clap');assert.equal(context.actionPending,true);
 await timers.shift()();assert.equal(context.actionPending,false);assert.equal(garden.player.avatar.action,'clap');
});

test('registration expands the scene before placing guests in the second and third courtyard',async()=>{
 for(const count of [0,20,40]){
  const guests=Array.from({length:count},(_,slot)=>({id:`existing-${slot}`,slot,...slotPosition(slot)}));
  const assigned={id:`registered-${count}`,slot:count,isMine:true,name:'새 손님',avatar:{outfit:0},...slotPosition(count)};
  const garden=Object.create(Garden.prototype);Object.assign(garden,{world:{w:1536,h:gardenHeight(guests)},npcStates:new Map(),guests:[],player:{id:'visitor',x:768,y:500},selected:null,route:[]});
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id)};
  const context=vm.createContext({guests,garden,$:get,$$:()=>[],crypto:{randomUUID:()=>`registration-${count}`},api:async()=>({guest:assigned}),captureForm:()=>{},renderSuccess:()=>{},clearTimeout});
  context.updateScene=()=>garden.setGuests(context.guests,gardenHeight(context.guests));
  vm.runInContext(`var busy=false,form={name:'새 손님',message:'축하해요',side:'both',consent:true},draft={outfit:0},own=null,pendingRequest=null,mutationEpoch=0;${section('async function submitGuest(','function renderSuccess(')}`,context);
  await context.submitGuest({preventDefault(){}});
  assert.equal(get('#form-error').textContent,'');assert.equal(garden.player.id,assigned.id);
  assert.equal(garden.player.x,assigned.x);assert.equal(garden.player.y,assigned.y);assert.ok(garden.world.h>=gardenHeight([assigned]));
 }
});

function photoHarness(){
 const nodes={'#join-dialog':{open:true,addEventListener(type,fn){this[type]=fn}},'#photo-result':{innerHTML:''},'#step-one':{},'#step-two':{}},pending=new Map(),closed=[],rendered=[],errors=[];
 const context=vm.createContext({$:id=>nodes[id],createImageBitmap:file=>new Promise((resolve,reject)=>pending.set(file.name,{resolve,reject})),toast:error=>errors.push(error),renderPhoto:()=>{},renderEditor:()=>{},captureForm:()=>context.captures++,document:{createElement(){let name;return{getContext:()=>({fillRect(){},drawImage(bitmap){name=bitmap.name}}),toDataURL:()=>`data:${name}`}}},rendered,captures:0});
 const closeHandler=source.split('\n').find(line=>line.startsWith("$('#join-dialog').addEventListener('close'"));
 vm.runInContext(`var photo=null,photoRevision=0,mode='photo',previewCanvas=null,own=null;function renderPhotoResult(){rendered.push(photo.url)}${section('function renderJoin()','function renderPhoto()')}${section('async function handlePhoto(',"$('#join-dialog').addEventListener('close'")}${closeHandler}`,context);
 return{context,nodes,closed,rendered,errors,
  choose(name){return context.handlePhoto({target:{files:[{name,type:'image/png',size:100}]}})},
  resolve(name){pending.get(name).resolve({name,width:100,height:100,close(){closed.push(name)}})},
  reject(name){pending.get(name).reject(new Error(name))}
 };
}

test('newest photo survives out-of-order decoding and stale failures',async()=>{
 const h=photoHarness(),a=h.choose('A'),b=h.choose('B');h.resolve('B');await b;h.resolve('A');await a;
 assert.equal(h.context.photo.url,'data:B');assert.deepEqual(h.rendered,['data:B']);assert.deepEqual(h.closed,['B','A']);
 const c=h.choose('C'),d=h.choose('D');h.resolve('D');await d;h.reject('C');await c;
 assert.equal(h.context.photo.url,'data:D');assert.deepEqual(h.errors,[]);
});

test('leaving photo entry and closing/reopening discard pending images and release their bitmaps',async()=>{
 const h=photoHarness(),a=h.choose('manual-pending');h.context.mode='manual';h.context.renderJoin();delete h.nodes['#photo-result'];h.resolve('manual-pending');await a;
 assert.equal(h.context.photo,null);assert.deepEqual(h.errors,[]);
 h.context.mode='photo';h.nodes['#photo-result']={innerHTML:''};h.context.renderJoin();const b=h.choose('closed-pending');
 h.nodes['#join-dialog'].open=false;h.nodes['#join-dialog'].close();h.nodes['#join-dialog'].open=true;h.context.renderJoin();h.resolve('closed-pending');await b;
 assert.equal(h.context.photo,null);assert.deepEqual(h.rendered,[]);assert.deepEqual(h.closed,['manual-pending','closed-pending']);
});

test('closing preserves only an unfinished new message and ignores success and existing-profile cancellation',()=>{
 const h=photoHarness();h.nodes['#guest-form']={};h.nodes['#join-dialog'].close();assert.equal(h.context.captures,1);
 delete h.nodes['#guest-form'];h.nodes['#join-dialog'].close();assert.equal(h.context.captures,1);
 h.nodes['#guest-form']={};h.context.own={id:'existing'};h.nodes['#join-dialog'].close();assert.equal(h.context.captures,1);
});

test('returning from guest detail or registration lets the keyboard move through the garden',()=>{
 const previousDocument=globalThis.document,previousWindow=globalThis.window;
 try{for(const scenario of ['mobile-find','desktop-find','registration-view']){
  const nodes=new Map(),events=new Map(),dialogs=[];
  const document={activeElement:null,hidden:false,addEventListener(){},querySelector:selector=>selector==='dialog[open]'?dialogs.find(d=>d.open):$(selector)};
  const $=id=>{if(!nodes.has(id))nodes.set(id,{id:id.slice(1),open:false,innerHTML:'',focus(){document.activeElement=this},addEventListener(){},showModal(){this.restore=document.activeElement;this.open=true;dialogs.push(this)},close(){this.open=false;document.activeElement=this.restore}});return nodes.get(id)};
  globalThis.document=document;globalThis.window={addEventListener:(type,fn)=>events.set(type,fn)};
  const garden=Object.create(Garden.prototype);
  Object.assign(garden,{canvas:$('#garden'),world:{w:1536,h:1024},keys:new Set(),axis:{x:0,y:0},route:[],target:null,player:{id:'mine',x:768,y:500,avatar:{action:'idle'}},guests:[],t:0,npcTime:0,playerGait:0,lastSave:0,follow:false,camera:{x:768,y:500},onSelect(){},paused:true,reduced:false});
  garden.bind();
  const context=vm.createContext({$,garden,document,esc:String,sideName:{both:'두 사람 모두'},paintPreview(){},showSpeech(){},toast(){}});
  vm.runInContext(`var config={},own={id:'mine',name:'나',side:'both',message:'축하해요',avatar:{action:'idle'},x:768,y:500};${section('function showDetail(','function openJoin(')}${section('function renderSuccess()',"$$('[data-join]')")}`,context);
  $(scenario==='mobile-find'?'#more':scenario==='desktop-find'?'#guest-card':'#mobile-register').focus();
  if(scenario==='registration-view'){$('#join-dialog').showModal();context.renderSuccess();$('#view-me').onclick()}
  else{context.showDetail(context.own);$('#find-guest').focus();$('#find-guest').onclick()}
  assert.equal(dialogs.some(d=>d.open),false,scenario);assert.equal(document.activeElement,$('#garden'),scenario);
  const before=garden.player.x;let handled=false;
  events.get('keydown')({target:document.activeElement,key:'ArrowRight',preventDefault(){handled=true}});garden.update(1/60);
  assert.equal(handled,true,scenario);assert.ok(garden.player.x>before,scenario);
 }}finally{globalThis.document=previousDocument;globalThis.window=previousWindow}
});
