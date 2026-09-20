import {walkable} from './navigation.js?v=20260920-motion3';
export const GARDEN_WIDTH=1536;
export const TILE_HEIGHT=1024;
export const GUESTS_PER_TILE=20;
export function scatteredPositions(count,seed=73){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296},points=[];
 for(let i=0;i<count;i++){let best=null,bestDistance=-1;for(let attempt=0;attempt<96;attempt++){const angle=random()*Math.PI*2,radius=Math.sqrt(.08+random()*.92),point={x:Math.round(768+Math.cos(angle)*radius*460),y:Math.round(640+Math.sin(angle)*radius*205)};if(!walkable(point.x,point.y))continue;const distance=points.length?Math.min(...points.map(p=>Math.hypot(p.x-point.x,p.y-point.y))):1;if(distance>bestDistance){best=point;bestDistance=distance}}points.push(best||{x:768,y:640})}return points;
}
const slots=scatteredPositions(GUESTS_PER_TILE);
export function slotPosition(slot){const point=slots[slot%GUESTS_PER_TILE];return{x:point.x,y:Math.floor(slot/GUESTS_PER_TILE)*TILE_HEIGHT+point.y}}
export function nextFreeSlot(slots){const used=new Set(slots);let slot=0;while(used.has(slot))slot++;return slot}
export function gardenHeight(records){let height=TILE_HEIGHT;for(const record of records){const slotHeight=Number.isInteger(record.slot)?(Math.floor(record.slot/GUESTS_PER_TILE)+1)*TILE_HEIGHT:TILE_HEIGHT;const positionHeight=Number.isFinite(record.y)?Math.ceil((record.y+40)/TILE_HEIGHT)*TILE_HEIGHT:TILE_HEIGHT;height=Math.max(height,slotHeight,positionHeight)}return height}
