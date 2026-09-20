import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ACTION_IDS,normalizeAction,movementFacing,poseFor} from '../public/avatar-state.js';
import {actions} from '../public/avatar.js';
import {Garden} from '../public/garden.js';
import {createWanderer,stepWanderer} from '../public/wander.js';

test('retired reactions resolve to a front-facing idle pose while supported choices remain available',()=>{
 assert.deepEqual(ACTION_IDS,['idle','wave','dance','clap']);
 assert.deepEqual(actions.map(([id])=>id),ACTION_IDS);
 for(const action of ['bow','jump','heart','spin',undefined,null,'unknown']){
  assert.equal(normalizeAction(action),'idle');
  const pose=poseFor({action},false,'back',.4);
  assert.equal(pose.family,'idle');assert.equal(pose.direction,'front');
 }
});

test('each generated reaction selects all four fresh frames and loops in its own family',()=>{
 for(const [action,fps] of [['wave',5],['dance',4],['clap',5]]){
  const frames=[];
  for(let frame=0;frame<4;frame++){
   const pose=poseFor({action},false,'left',(frame+.1)/fps);
   assert.equal(pose.family,action);assert.equal(pose.direction,'front');frames.push(pose.frame);
  }
  assert.deepEqual(frames,[0,1,2,3]);
  assert.equal(poseFor({action},false,'right',4.1/fps).frame,0);
  assert.deepEqual(poseFor({action},false,'back',99,99,true),{family:action,direction:'front',frame:0});
 }
});

test('walking temporarily overrides reactions and stopping always returns to the front',()=>{
 for(const action of ACTION_IDS)for(const direction of ['front','left','right','back']){
  assert.deepEqual(poseFor({action},true,direction,30,0),{family:'walk',direction,frame:0});
  assert.deepEqual(poseFor({action},true,direction,30,Math.PI*1.1),{family:'walk',direction,frame:1});
  assert.equal(poseFor({action},true,direction,30,Math.PI*2.1).frame,0);
  assert.equal(poseFor({action},false,direction,30).direction,'front');
 }
 assert.deepEqual(poseFor({action:'dance'},true,'back',30,15,true),{family:'walk',direction:'back',frame:0});
});

test('actual movement selects sides and back while near-diagonal routes retain a stable view',()=>{
 for(const [dx,dy,expected] of [[-1,0,'left'],[1,0,'right'],[0,-1,'back'],[0,1,'front']]){
  assert.equal(movementFacing(dx,dy),expected);
 }
 for(const facing of ['left','right','back','front']){
  assert.equal(movementFacing(0,0,facing),'front');
  assert.equal(movementFacing(.0001,-.0001,facing),'front');
 }
 assert.equal(movementFacing(-10,-10.5,'left'),'left');
 assert.equal(movementFacing(-10.5,-10,'back'),'back');
 assert.equal(movementFacing(-12,-10,'back'),'left');
 assert.equal(movementFacing(-10,-12,'left'),'back');
 assert.equal(movementFacing(10,10.5,'right'),'right');
 assert.equal(movementFacing(10.5,10,'front'),'front');
 assert.equal(movementFacing(10,10,'left'),'right','reversing direction releases the old side');
});

function gardenHarness(overrides={}){
 const garden=Object.create(Garden.prototype);
 Object.assign(garden,{world:{w:1536,h:1024},guests:[],player:{id:'mine',x:768,y:600,avatar:{action:'clap'}},keys:new Set(),axis:{x:0,y:0},route:[],target:null,moving:false,direction:'front',t:0,npcTime:0,playerGait:0,lastSave:0,follow:false,camera:{x:768,y:600},paused:false,reduced:false,dialogPaused:false,hasDialog:()=>false,...overrides});
 return garden;
}
function walkingGuest(){
 const walk=createWanderer({id:'direction-npc',x:768,y:720},1024);
 Object.assign(walk,{wait:0,route:[{x:850,y:720}],moving:true,facing:'right'});
 return{id:'direction-npc',x:walk.x,y:walk.y,avatar:{action:'wave'},walk,moving:true};
}

test('player movement shows the travelled direction and releasing input or arriving resets to front',()=>{
 for(const [axis,expected] of [[{x:-1,y:0},'left'],[{x:1,y:0},'right'],[{x:0,y:-1},'back']]){
  const garden=gardenHarness({axis});
  garden.update(1/60);assert.equal(garden.moving,true);assert.equal(garden.direction,expected);
  garden.axis={x:0,y:0};garden.update(1/60);
  assert.equal(garden.moving,false);assert.equal(garden.direction,'front');
 }
 const arrived=gardenHarness({moving:true,direction:'back',target:{x:768,y:599}});
 arrived.update(1/60);assert.equal(arrived.target,null);assert.equal(arrived.moving,false);assert.equal(arrived.direction,'front');
});

test('blocked player input and explicit stop cannot leave a side-facing idle image',()=>{
 const blocked=gardenHarness({player:{id:'mine',x:180,y:500,avatar:{action:'dance'}},axis:{x:-1,y:0},moving:true,direction:'left'});
 blocked.update(1/60);
 assert.equal(blocked.player.x,180);assert.equal(blocked.moving,false);assert.equal(blocked.direction,'front');
 const stopped=gardenHarness({moving:true,direction:'back',keys:new Set(['w']),axis:{x:1,y:0},target:{x:850,y:600},route:[{x:900,y:600}]});
 stopped.stop();
 assert.equal(stopped.moving,false);assert.equal(stopped.direction,'front');assert.equal(stopped.target,null);assert.deepEqual(stopped.route,[]);assert.equal(stopped.keys.size,0);
});

test('NPC waiting, arrival, blocked movement and pause all reset the view without fake walking',()=>{
 for(const scenario of ['wait','arrived','blocked','paused','new-route']){
  const state=createWanderer({id:'direction-test',x:768,y:600},1024);
  Object.assign(state,{wait:0,route:[{x:850,y:600}],moving:true,facing:'right'});
  const others=[];
  if(scenario==='wait')state.wait=2;
  if(scenario==='arrived')state.route=[{x:state.x,y:state.y}];
  if(scenario==='blocked')others.push({x:state.x+32,y:state.y});
  if(scenario==='new-route')state.route=[];
  const before={x:state.x,y:state.y,gait:state.gait};
  stepWanderer(state,1/60,1024,others,scenario==='paused');
  assert.equal(state.moving,false,scenario);assert.equal(state.facing,'front',scenario);
  assert.deepEqual({x:state.x,y:state.y,gait:state.gait},before,scenario);
  assert.equal(poseFor({action:'dance'},state.moving,state.facing).direction,'front',scenario);
 }
});

test('opening a dialog immediately restores player and NPC front views and freezes their movement',()=>{
 const npc=walkingGuest(),garden=gardenHarness({guests:[npc],moving:true,direction:'back',axis:{x:0,y:-1},hasDialog:()=>true});
 const before={playerX:garden.player.x,playerY:garden.player.y,npcX:npc.x,npcY:npc.y};
 garden.update(1/60);garden.update(1/60);
 assert.equal(garden.dialogPaused,true);assert.equal(garden.direction,'front');assert.equal(garden.moving,false);
 assert.equal(npc.moving,false);assert.equal(npc.walk.facing,'front');assert.equal(garden.t,0);
 assert.deepEqual({playerX:garden.player.x,playerY:garden.player.y,npcX:npc.x,npcY:npc.y},before);
});

test('paused, selected and reduced-motion guests are front-facing until they resume walking',()=>{
 for(const reason of ['paused','selected','reduced']){
  const npc=walkingGuest(),garden=gardenHarness({guests:[npc]});
  if(reason==='selected')garden.selected=npc;else garden[reason]=true;
  garden.update(1/60);
  assert.equal(npc.moving,false,reason);assert.equal(npc.walk.facing,'front',reason);
  garden.selected=null;garden.paused=false;garden.reduced=false;garden.update(1/60);
  assert.equal(npc.moving,true,reason);assert.equal(npc.walk.facing,'right',reason);
 }
});
