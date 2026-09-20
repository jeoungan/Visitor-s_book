import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scatteredPositions,slotPosition} from '../public/world.js';
import {createWanderer,stepWanderer,createNeighborIndex} from '../public/wander.js';
import {COURTYARD_TOP,walkable} from '../public/navigation.js';
import {Garden} from '../public/garden.js';

test('arrival positions are dispersed, repeatable and on walkable ground',()=>{
 const points=scatteredPositions(24,1926);assert.deepEqual(points,scatteredPositions(24,1926));
 assert.ok(new Set(points.map(p=>p.x)).size>20);assert.ok(new Set(points.map(p=>p.y)).size>20);
 for(const [i,p] of points.entries()){assert.ok(walkable(p.x,p.y));for(const q of points.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>48)}
 for(let slot=0;slot<100;slot++){const p=slotPosition(slot);assert.ok(walkable(p.x,p.y,5120))}
});
test('legacy arrivals near the arch are displayed on the courtyard without changing saved coordinates',()=>{
 const saved={id:'legacy-arrival',x:768,y:340},state=createWanderer(saved,1024);
 assert.deepEqual(saved,{id:'legacy-arrival',x:768,y:340});assert.ok(state.y>=COURTYARD_TOP);assert.ok(walkable(state.x,state.y));
 for(let frame=0;frame<30*60;frame++){stepWanderer(state,1/60,1024);assert.ok(state.y>=COURTYARD_TOP);assert.ok(walkable(state.x,state.y))}
});
test('guests actually travel, take breaks and never jump between route points',()=>{
 const starts=scatteredPositions(24,1926),states=starts.map((p,i)=>createWanderer({...p,id:`demo-${i}`},1024)),moving=new Array(24).fill(0),resting=new Array(24).fill(0),range=new Array(24).fill(0);
 for(let frame=0;frame<60*60;frame++)for(const [i,state] of states.entries()){
  const old={x:state.x,y:state.y};stepWanderer(state,1/60,1024,states.filter((_,j)=>i!==j));
  assert.ok(walkable(state.x,state.y));assert.ok(Math.hypot(state.x-old.x,state.y-old.y)<=state.speed/60+.00001);
  if(state.moving)moving[i]++;else resting[i]++;range[i]=Math.max(range[i],Math.hypot(state.x-starts[i].x,state.y-starts[i].y));
 }
 assert.ok(moving.every(n=>n>60));assert.ok(resting.every(n=>n>60));assert.ok(range.every(n=>n>70),JSON.stringify(range));
});
test('stopping and resuming preserves the route, position and rest timer',()=>{
 const state=createWanderer({id:'guest',x:768,y:600},1024);state.wait=0;stepWanderer(state,.1,1024);
 const before={x:state.x,y:state.y,route:JSON.stringify(state.route),wait:state.wait,gait:state.gait};
 for(let i=0;i<120;i++)stepWanderer(state,1/60,1024,[],true);
 assert.deepEqual({x:state.x,y:state.y,route:JSON.stringify(state.route),wait:state.wait,gait:state.gait},before);assert.equal(state.moving,false);
 stepWanderer(state,.1,1024);assert.equal(state.moving,true);
});
test('polling and filtering keep walks, and card selection finds the current position',()=>{
 globalThis.document={querySelector:()=>({hidden:false})};
 const garden=Object.create(Garden.prototype);Object.assign(garden,{world:{w:1536,h:1024},npcStates:new Map(),guests:[],player:{id:'visitor',x:768,y:500},onSelect:()=>{},selected:null});
 const guest={id:'guest',x:600,y:600};garden.setGuests([guest]);const walk=garden.guests[0].walk;walk.wait=0;stepWanderer(walk,.1,1024);stepWanderer(walk,1,1024);
 garden.setGuests([]);garden.setGuests([guest]);assert.equal(garden.guests[0].walk,walk);garden.select(guest);assert.equal(garden.camera.x,walk.x);assert.equal(garden.camera.y,walk.y);
});

test('selected messages refresh after edits without moving the camera, and disappear after removal',()=>{
 const speech={hidden:false};globalThis.document={querySelector:()=>speech};let calls=0;
 const garden=Object.create(Garden.prototype);Object.assign(garden,{world:{w:1536,h:1024},npcStates:new Map(),guests:[],player:{id:'visitor',x:768,y:500},selected:null,onSelect:g=>{calls++;speech.text=`${g.name}|${g.message}|${g.side}`}});
 const guest={id:'selected',x:600,y:600,name:'원래 이름',message:'원래 메시지',side:'groom'};garden.setGuests([guest]);garden.select(guest);const camera=garden.camera;
 const edited={...guest,name:'새 이름',message:'새 메시지',side:'bride'};garden.setGuests([edited]);
 assert.equal(speech.text,'새 이름|새 메시지|bride');assert.equal(calls,2);assert.equal(garden.camera,camera);assert.equal(garden.follow,false);assert.equal(garden.selected.id,guest.id);
 garden.setGuests([edited]);assert.equal(calls,2);
 garden.setGuests([]);assert.equal(speech.hidden,true);assert.equal(garden.selected,null);
});

test('restoring my older saved position stays on the terrace without rewriting its data',()=>{
 globalThis.document={querySelector:()=>({hidden:false})};
 const garden=Object.create(Garden.prototype);Object.assign(garden,{world:{w:1536,h:1024},npcStates:new Map(),guests:[],player:{id:'visitor',x:768,y:500},onSelect:()=>{},selected:null});
 const guest={id:'own',isMine:true,x:768,y:340};garden.setGuests([guest]);
 assert.ok(walkable(garden.player.x,garden.player.y));assert.equal(guest.y,340);
 garden.setPlayer(guest);assert.ok(walkable(garden.player.x,garden.player.y));assert.equal(guest.y,340);
});
test('shrinking an extended garden brings wandering guests back onto valid ground',()=>{
 globalThis.document={querySelector:()=>({hidden:false})};
 const garden=Object.create(Garden.prototype);Object.assign(garden,{world:{w:1536,h:2048},npcStates:new Map(),guests:[],player:{id:'visitor',x:768,y:500},onSelect:()=>{},selected:null});
 const guest={id:'guest',x:768,y:800};garden.setGuests([guest],2048);Object.assign(garden.guests[0].walk,{x:768,y:1080,route:[{x:1000,y:1300}],moving:true});
 garden.setGuests([guest],1024);const state=garden.guests[0].walk;assert.ok(walkable(state.x,state.y,1024));assert.deepEqual(state.route,[]);assert.equal(state.moving,false);
});

test('shrinking the world cancels obsolete player routes while normal polling keeps valid routes',()=>{
 globalThis.document={querySelector:()=>null};
 const garden=Object.create(Garden.prototype);Object.assign(garden,{world:{w:1536,h:2048},npcStates:new Map(),guests:[],player:{id:'visitor',x:768,y:1320},selected:null,target:{x:768,y:1500},route:[{x:768,y:1560}],moving:true,keys:new Set(),axis:{x:0,y:0},t:0,npcTime:0,playerGait:0,lastSave:0,follow:false});
 garden.setGuests([],1024);const corrected={...garden.player};
 assert.ok(walkable(corrected.x,corrected.y));assert.equal(garden.target,null);assert.deepEqual(garden.route,[]);assert.equal(garden.moving,false);
 for(let frame=0;frame<600;frame++)garden.update(1/60);
 assert.deepEqual(garden.player,corrected);
 garden.player.y=500;garden.target={x:768,y:600};garden.route=[{x:768,y:700}];garden.moving=true;
 const validTarget=garden.target,validRoute=garden.route;garden.setGuests([],1024);
 assert.equal(garden.target,validTarget);assert.equal(garden.route,validRoute);assert.equal(garden.moving,true);
 garden.target={x:768,y:1500};garden.setGuests([],1024);assert.equal(garden.target,null);assert.deepEqual(garden.route,[]);
});

test('editing my profile preserves current position but a new registration uses its assigned spawn',()=>{
 const garden=Object.create(Garden.prototype);Object.assign(garden,{world:{w:1536,h:1024},player:{id:'mine',x:900,y:700}});
 const saved={id:'mine',name:'수정한 이름',x:768,y:500,avatar:{outfit:10}};garden.setPlayer(saved);
 assert.equal(garden.player.x,900);assert.equal(garden.player.y,700);assert.equal(garden.player.name,'수정한 이름');assert.equal(garden.player.avatar.outfit,10);
 assert.equal(saved.x,768);assert.equal(saved.y,500);
 garden.setPlayer({id:'new-registration',x:700,y:500,avatar:{outfit:0}});assert.equal(garden.player.x,700);assert.equal(garden.player.y,500);
 garden.setPlayer(null);assert.equal(garden.player.id,'visitor');assert.ok(walkable(garden.player.x,garden.player.y));
});

test('nearby-person indexing preserves full-crowd yielding and walking across cell boundaries',()=>{
 const guests=Array.from({length:80},(_,i)=>({...slotPosition(i),id:`indexed-${i}`}));
 const baseline=guests.map(g=>createWanderer(g,4096)),indexed=guests.map(g=>createWanderer(g,4096));
 for(let frame=0;frame<240;frame++){
  const neighbors=createNeighborIndex(indexed);
  for(let i=0;i<guests.length;i++){
   stepWanderer(baseline[i],1/60,4096,baseline.filter((_,j)=>i!==j));
   stepWanderer(indexed[i],1/60,4096,neighbors.nearby(indexed[i]));neighbors.update(indexed[i]);
   for(const key of ['x','y','moving','wait','blocked','gait'])assert.equal(indexed[i][key],baseline[i][key],`frame ${frame}, guest ${i}, ${key}`);
  }
 }
 const center={x:768,y:600},other={x:801,y:600},far={x:2000,y:600},neighbors=createNeighborIndex([center,other,far]);
 assert.ok(neighbors.nearby(center).includes(other));assert.ok(!neighbors.nearby(center).includes(far));
 other.x=1000;neighbors.update(other);assert.ok(!neighbors.nearby(center).includes(other));
});
