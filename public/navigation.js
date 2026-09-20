import {tablesForTile,TABLE_RADIUS_X,TABLE_RADIUS_Y} from './venue-layout.js?v=20260920-poses2';
export const WIDTH=1536,TILE=1024,CELL=24,COURTYARD_TOP=400;
export function walkable(x,y,height=1024){
 if(x<180||x>1356||y<COURTYARD_TOP||y>height-40)return false;
 const tile=Math.floor(y/TILE);
 const inside=tile===0?(y<820||(x>=220&&x<=1276)):(x>=280&&x<=1256);
 return inside&&!tablesForTile(tile).some(table=>((x-table.x)/TABLE_RADIUS_X)**2+((y-table.y)/TABLE_RADIUS_Y)**2<=1);
}
export function nearestPoint(p,height=1024){
 const x=Math.max(180,Math.min(WIDTH-180,p.x)),y=Math.max(COURTYARD_TOP,Math.min(height-40,p.y));if(walkable(x,y,height))return{x,y};
 for(let radius=12;radius<1500;radius+=12)for(let i=0;i<32;i++){const angle=i*Math.PI/16,nx=x+Math.cos(angle)*radius,ny=y+Math.sin(angle)*radius;if(walkable(nx,ny,height))return{x:nx,y:ny}}
 return{x:768,y:400};
}
function clearSegment(a,b,height){
 if(!walkable(a.x,a.y,height)||!walkable(b.x,b.y,height))return false;
 for(let tile=Math.floor(Math.min(a.y,b.y)/TILE);tile<=Math.floor(Math.max(a.y,b.y)/TILE);tile++)for(const table of tablesForTile(tile)){
  const x=(a.x-table.x)/TABLE_RADIUS_X,y=(a.y-table.y)/TABLE_RADIUS_Y,dx=(b.x-a.x)/TABLE_RADIUS_X,dy=(b.y-a.y)/TABLE_RADIUS_Y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,-(x*dx+y*dy)/length)):0;
  if((x+dx*t)**2+(y+dy*t)**2<=1)return false;
 }
 const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6);
 for(let i=1;i<steps;i++){const t=i/steps;if(!walkable(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,height))return false}
 return true;
}
export function findPath(start,target,height=1024){
 const a=nearestPoint(start,height),b=nearestPoint(target,height);
 if(clearSegment(a,b,height))return[b];
 const cell=p=>{const cx=Math.round(p.x/CELL),cy=Math.round(p.y/CELL),candidates=[];for(let r=0;r<6;r++){for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){const x=(cx+dx)*CELL,y=(cy+dy)*CELL;if(clearSegment(p,{x,y},height))candidates.push({x:cx+dx,y:cy+dy,d:Math.hypot(x-p.x,y-p.y)})}if(candidates.length){candidates.sort((a,b)=>a.d-b.d);return candidates[0]}}return{x:32,y:20}},s=cell(a),end=cell(b),key=p=>p.x+','+p.y;
 if(s.x===end.x&&s.y===end.y)return clearSegment(a,b,height)?[b]:[{x:s.x*CELL,y:s.y*CELL},b];
 const open=[{...s,g:0,f:0}],scores=new Map([[key(s),0]]),parent=new Map(),closed=new Set();let iterations=0;
 while(open.length&&iterations++<20000){open.sort((a,b)=>b.f-a.f);const at=open.pop(),ak=key(at);if(closed.has(ak))continue;if(at.x===end.x&&at.y===end.y){const path=[b];let current=ak;while(parent.has(current)){const[x,y]=current.split(',').map(Number);path.unshift({x:x*CELL,y:y*CELL});current=parent.get(current)}if(!clearSegment(a,path[0],height))path.unshift({x:s.x*CELL,y:s.y*CELL});return path}closed.add(ak);
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const next={x:at.x+dx,y:at.y+dy},nk=key(next);if(closed.has(nk)||!clearSegment({x:at.x*CELL,y:at.y*CELL},{x:next.x*CELL,y:next.y*CELL},height))continue;if(dx&&dy&&(!walkable((at.x+dx)*CELL,at.y*CELL,height)||!walkable(at.x*CELL,(at.y+dy)*CELL,height)))continue;const g=at.g+Math.hypot(dx,dy);if(g>=(scores.get(nk)??Infinity))continue;scores.set(nk,g);parent.set(nk,ak);open.push({...next,g,f:g+Math.hypot(next.x-end.x,next.y-end.y)})}
 }
 return[];
}
