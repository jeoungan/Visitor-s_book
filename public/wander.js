import {walkable,findPath,nearestPoint} from './navigation.js?v=20260920-review9';

export function createNeighborIndex(people){
 const cellSize=64,buckets=new Map(),locations=new Map(),key=person=>`${Math.floor(person.x/cellSize)},${Math.floor(person.y/cellSize)}`;
 function update(person){const next=key(person),previous=locations.get(person);if(next===previous)return;if(previous)buckets.get(previous)?.delete(person);if(!buckets.has(next))buckets.set(next,new Set());buckets.get(next).add(person);locations.set(person,next)}
 people.forEach(update);
 return{update,nearby(person){const x=Math.floor(person.x/cellSize),y=Math.floor(person.y/cellSize),neighbors=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const other of buckets.get(`${x+dx},${y+dy}`)||[])if(other!==person)neighbors.push(other);return neighbors}};
}

function randomFor(id){let state=[...id].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
export function createWanderer(guest,height){
 const random=randomFor(guest.id),point=nearestPoint(guest,height);
 return{...point,anchor:{...point},random,route:[],wait:random()*4,speed:28+random()*16,blocked:0,direction:random()>.5?1:-1,gait:random()*Math.PI*2,moving:false};
}
function chooseDestination(state,height){
 for(let attempt=0;attempt<12;attempt++){
  const angle=state.random()*Math.PI*2,distance=90+state.random()*160;
  const target={x:state.x+Math.cos(angle)*distance,y:state.y+Math.sin(angle)*distance};
  if(Math.hypot(target.x-state.anchor.x,target.y-state.anchor.y)>400||!walkable(target.x,target.y,height))continue;
  const route=findPath(state,target,height);if(route.length){state.route=route;return}
 }
 state.wait=1+state.random()*2;
}
export function stepWanderer(state,dt,height,others=[],stopped=false){
 state.moving=false;if(stopped)return;
 if(state.wait>0){state.wait=Math.max(0,state.wait-dt);return}
 if(!state.route.length){chooseDestination(state,height);return}
 let target=state.route[0],distance=Math.hypot(target.x-state.x,target.y-state.y);
 while(distance<2&&state.route.length){state.route.shift();target=state.route[0];if(!target){state.wait=1.5+state.random()*4;return}distance=Math.hypot(target.x-state.x,target.y-state.y)}
 const step=Math.min(distance,state.speed*dt),dx=(target.x-state.x)/distance*step,dy=(target.y-state.y)/distance*step,next={x:state.x+dx,y:state.y+dy};
 const blocked=!walkable(next.x,next.y,height)||others.some(other=>{const now=Math.hypot(other.x-state.x,other.y-state.y),after=Math.hypot(other.x-next.x,other.y-next.y);return after<34&&after<now-.01});
 if(blocked){state.blocked+=dt;if(state.blocked>.65+state.random()*.4){state.route=[];state.wait=.5+state.random()*1.5;state.blocked=0}return}
 state.blocked=0;state.x=next.x;state.y=next.y;state.moving=step>.001;state.gait+=step*.16;if(Math.abs(dx)>.02)state.direction=dx<0?-1:1;
}
