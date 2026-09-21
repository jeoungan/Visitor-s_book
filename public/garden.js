import {movementFacing} from './avatar-state.js?v=20260921-pages1';
import {createSpeechScheduler} from './speech.js?v=20260921-pages1';
import {drawAvatar,defaultAvatar} from './avatar.js?v=20260921-pages1';
import {walkable,nearestPoint,findPath} from './navigation.js?v=20260921-pages1';
import {GARDEN_WIDTH,TILE_HEIGHT,gardenHeight} from './world.js?v=20260921-pages1';
import {createWanderer,stepWanderer,createNeighborIndex} from './wander.js?v=20260921-pages1';
import {tablesForHeight,TABLE_SPRITE} from './venue-layout.js?v=20260921-pages1';
export class Garden{
 constructor(canvas,onSelect,onMove){
 this.world={w:GARDEN_WIDTH,h:TILE_HEIGHT};this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onSelect=onSelect;this.onMove=onMove;this.guests=[];this.player={id:'visitor',name:'나 · 방문객',x:768,y:500,avatar:defaultAvatar()};this.zoom=1;this.camera={x:768,y:0};this.keys=new Set();this.axis={x:0,y:0};this.target=null;this.direction='front';this.paused=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.t=0;this.selected=null;this.follow=false;this.enabled=true;this.lastSave=0;
 this.needsRender=true;this.dialogPaused=false;this.npcTime=0;this.npcStates=new Map();this.playerGait=0;this.route=[];const sceneImages=[['couple','/assets/eunpyeong-couple-lace/sheet-transparent.png'],['table','/assets/reception-table/sheet-transparent.png'],['map','/assets/eunpyeong-madang.png']];
 this.ready=Promise.all(sceneImages.map(([key,src])=>new Promise((resolve,reject)=>{const img=this[key]=new Image();img.onload=()=>{this.invalidate();if(key==='table'){const mask=document.createElement('canvas');mask.width=img.naturalWidth;mask.height=img.naturalHeight;const ctx=mask.getContext('2d');ctx.drawImage(img,0,0);this.tableMask=ctx.getImageData(0,0,mask.width,mask.height)}resolve()};img.onerror=()=>reject(new Error('장면 이미지를 불러오지 못했습니다: '+src));img.src=src})));
 document.fonts?.ready.then(()=>this.invalidate());this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.bind();this.last=performance.now();requestAnimationFrame(n=>this.loop(n));
 }
 invalidate(){this.needsRender=true}
 resize(){this.invalidate();const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=this.w*this.dpr;this.canvas.height=this.h*this.dpr;this.scale=Math.max(this.w/this.world.w,this.h/TILE_HEIGHT)*this.zoom}
 setGuests(guests,worldHeight=gardenHeight(guests)){
  this.invalidate();
  this.world.h=Math.max(TILE_HEIGHT,worldHeight);
  const relocatePlayer=!walkable(this.player.x,this.player.y,this.world.h);
  if(relocatePlayer)Object.assign(this.player,nearestPoint(this.player,this.world.h));
  if(relocatePlayer||(this.target&&!walkable(this.target.x,this.target.y,this.world.h))||this.route?.some(point=>!walkable(point.x,point.y,this.world.h))){this.target=null;this.route=[];this.moving=false}
  this.guests=guests.map(g=>{const old=this.npcStates.get(g.id),keep=old&&old.baseX===g.x&&old.baseY===g.y,walk=keep?old.walk:createWanderer(g,this.world.h);
   if(!walkable(walk.x,walk.y,this.world.h)||walk.route.some(point=>!walkable(point.x,point.y,this.world.h))){Object.assign(walk,nearestPoint(walk,this.world.h));walk.anchor=nearestPoint(walk.anchor,this.world.h);walk.route=[];walk.wait=1;walk.moving=false}
   const current={...g,x:g.isMine?this.player.x:walk.x,y:g.isMine?this.player.y:walk.y,walk,baseX:g.x,baseY:g.y,seed:old?.seed??[...g.id].reduce((n,c)=>n+c.charCodeAt(0),0)/17};this.npcStates.set(g.id,current);return current;
  });
  const own=guests.find(g=>g.isMine);if(own&&this.player.id!==own.id){this.player={...own,...nearestPoint(own,this.world.h)};this.center()}else if(own)this.player={...own,x:this.player.x,y:this.player.y};
  if(this.selected){const previous=this.selected;this.selected=this.guests.find(g=>g.id===previous.id)||null;if(!this.selected)document.querySelector('#speech').hidden=true;else if(['name','message','side'].some(key=>previous[key]!==this.selected[key]))this.onSelect?.(this.selected)}
 }
 setPlayer(g){const position=g?.id===this.player.id?this.player:g;this.player=g?{...g,...nearestPoint(position,this.world.h)}:{id:'visitor',name:'나 · 방문객',x:768,y:500,avatar:defaultAvatar()};this.center()}
 center(){this.invalidate();this.follow=true;this.camera={x:this.player.x,y:this.player.y};this.target=null}
 home(){this.player.x=768;this.player.y=440;this.center();this.camera.y=0;this.follow=false;this.onMove?.(this.player)}
 setZoom(delta){this.zoom=Math.max(1,Math.min(2.4,this.zoom+delta));this.resize()}
 select(g){this.invalidate();const live=g.id===this.player.id?this.player:this.guests.find(guest=>guest.id===g.id)||g;this.selected=live;this.follow=false;this.camera={x:live.x,y:live.y};this.onSelect(live)}
 stop(){this.invalidate();if(this.moving)this.onMove?.(this.player);this.moving=false;this.direction='front';this.keys.clear();this.axis={x:0,y:0};this.target=null;this.route=[]}
 hasDialog(){return !!document.querySelector('dialog[open]')}
 bind(){
 window.addEventListener('keydown',e=>{if(this.hasDialog()||!['garden','joystick'].includes(e.target.id))return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','shift'].includes(k)){e.preventDefault();this.keys.add(k);this.target=null;this.follow=true}if(k==='escape'){this.selected=null;this.target=null;document.querySelector('#speech').hidden=true}if(k==='enter'||k===' '){e.preventDefault();const near=this.guests.filter(g=>g.id!==this.player.id).sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y))[0];if(near&&Math.hypot(near.x-this.player.x,near.y-this.player.y)<150)this.select(near)}});
 window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>this.stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop()});
 this.canvas.addEventListener('pointerdown',e=>{if(this.hasDialog())return;this.canvas.focus();this.pointer={x:e.offsetX,y:e.offsetY,cx:this.camera.x,cy:this.camera.y,moved:false};this.canvas.setPointerCapture(e.pointerId)});
 this.canvas.addEventListener('pointermove',e=>{if(!this.pointer)return;const dx=e.offsetX-this.pointer.x,dy=e.offsetY-this.pointer.y;if(Math.hypot(dx,dy)>6)this.pointer.moved=true;if(this.pointer.moved&&this.zoom>1){this.follow=false;this.camera.x=this.pointer.cx-dx/this.scale;this.camera.y=this.pointer.cy-dy/this.scale}});
 this.canvas.addEventListener('pointerup',e=>{const p=this.pointer;this.pointer=null;if(!p||p.moved)return;const point=this.toWorld(e.offsetX,e.offsetY);const hit=this.pickGuest(point);if(hit){this.select(hit);return}this.selected=null;document.querySelector('#speech').hidden=true;this.route=findPath(this.player,point,this.world.h);this.target=this.route.shift()||null;this.follow=true});this.canvas.addEventListener('pointercancel',()=>{this.pointer=null;this.stop()});
 }
 visibleEntities(){return [...this.guests.filter(g=>g.id!==this.player.id),{...this.player,moving:this.moving,isPlayer:true}].sort((a,b)=>a.y-b.y)}
 sceneEntities(){return [...this.visibleEntities(),...tablesForHeight(this.world?.h).map(table=>({...table,isTable:true,depth:table.y+TABLE_SPRITE.depth}))].sort((a,b)=>(a.depth??a.y)-(b.depth??b.y))}
 tableCovers(point,table){
  if(!this.tableMask)return false;
  const {size,offsetY}=TABLE_SPRITE,{width,height,data}=this.tableMask,x=Math.floor((point.x-table.x+size/2)/size*width),y=Math.floor((point.y-table.y+offsetY)/size*height);
  return x>=0&&x<width&&y>=0&&y<height&&data[(y*width+x)*4+3]>=40;
 }
 pickGuest(point){
  for(const entity of this.sceneEntities().reverse()){
   if(entity.isTable){if(this.tableCovers(point,entity))return null}
   else if(Math.abs(entity.x-point.x)<36&&point.y<entity.y+12&&point.y>entity.y-112)return entity;
  }
  return null;
 }
 safePoint(p){return nearestPoint(p,this.world.h)}
 drawCouple(c){
  if(!this.couple.complete||!this.couple.naturalWidth)return;
  c.save();
  const light=c.createRadialGradient(768,286,22,768,286,120);
  light.addColorStop(0,'#fff4d04d');light.addColorStop(.55,'#fff0c422');light.addColorStop(1,'#fff0c400');
  c.fillStyle=light;c.beginPath();c.ellipse(768,286,120,116,0,0,Math.PI*2);c.fill();
  c.fillStyle='#37453235';c.beginPath();c.ellipse(768,370,65,10,0,0,Math.PI*2);c.fill();
  c.drawImage(this.couple,676,196,184,184);
  c.fillStyle='#314e40e8';c.strokeStyle='#eee0b5';c.lineWidth=1;
  c.beginPath();c.roundRect(691,379,154,27,13);c.fill();c.stroke();
  c.font='bold 14px "Gowun Dodum",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff6da';c.fillText('신랑  ♥  신부',768,393);
  c.restore();
 }
 toWorld(x,y){return{x:(x-this.w/2)/this.scale+this.camera.x,y:(y-this.h/2)/this.scale+this.camera.y}}
 update(dt){if(this.hasDialog()){if(!this.dialogPaused){this.stop();for(const g of this.guests){g.moving=false;if(g.walk)g.walk.facing='front'}}this.dialogPaused=true;return}this.dialogPaused=false;this.t+=dt;if(!this.paused&&!this.reduced)this.npcTime+=dt;let dx=this.axis.x,dy=this.axis.y;dx+=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0);dy+=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0);
 if(this.target){dx=this.target.x-this.player.x;dy=this.target.y-this.player.y;if(Math.hypot(dx,dy)<5){this.target=this.route.shift()||null;dx=this.target?this.target.x-this.player.x:0;dy=this.target?this.target.y-this.player.y:0}}
 const wasMoving=this.moving,oldX=this.player.x,oldY=this.player.y,len=Math.hypot(dx,dy);if(len>.02){const speed=this.keys.has('shift')?245:155;const amount=Math.min(speed*dt,this.target?len:Infinity),p={x:this.player.x+dx/Math.max(1,len)*amount,y:this.player.y+dy/Math.max(1,len)*amount};if(walkable(p.x,p.y,this.world.h)){this.player.x=p.x;this.player.y=p.y}else if(walkable(p.x,this.player.y,this.world.h))this.player.x=p.x;else if(walkable(this.player.x,p.y,this.world.h))this.player.y=p.y;}
 const traveled=Math.hypot(this.player.x-oldX,this.player.y-oldY);this.moving=traveled>.001;this.direction=movementFacing(this.player.x-oldX,this.player.y-oldY,this.direction);this.playerGait+=traveled*.065;if(wasMoving&&!this.moving)this.onMove?.(this.player);if(this.moving&&this.t-this.lastSave>2){this.lastSave=this.t;this.onMove?.(this.player)}
 if(this.follow){this.camera.x+=(this.player.x-this.camera.x)*Math.min(1,dt*7);this.camera.y+=(this.player.y-this.camera.y)*Math.min(1,dt*7)}
 const walkers=this.guests.filter(g=>g.id!==this.player.id),neighbors=createNeighborIndex([this.player,...walkers]);
 for(const g of walkers){stepWanderer(g.walk,dt,this.world.h,neighbors.nearby(g),this.paused||this.reduced||g.id===this.selected?.id);g.x=g.walk.x;g.y=g.walk.y;g.moving=g.walk.moving;neighbors.update(g)}
 }
 render(){const c=this.ctx;if(!this.w||!this.h)return;this.scale=Math.max(this.w/this.world.w,this.h/TILE_HEIGHT)*this.zoom;const halfW=this.w/this.scale/2,halfH=this.h/this.scale/2;this.camera.x=Math.max(halfW,Math.min(this.world.w-halfW,this.camera.x));this.camera.y=Math.max(halfH,Math.min(this.world.h-halfH,this.camera.y));c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.w,this.h);c.save();c.translate(this.w/2,this.h/2);c.scale(this.scale,this.scale);c.translate(-this.camera.x,-this.camera.y);c.imageSmoothingEnabled=false;if(this.map.complete&&this.map.naturalWidth){c.drawImage(this.map,0,0,this.world.w,1024);for(let tile=1;tile<this.world.h/1024;tile++){if(tile*1024>this.camera.y+halfH||tile*1024+1024<this.camera.y-halfH)continue;c.drawImage(this.map,0,420,1536,380,0,tile*1024,1536,1024)}}this.drawCouple(c);
 const all=this.sceneEntities();
 for(const g of all){if(Math.abs(g.x-this.camera.x)>halfW+150||Math.abs(g.y-this.camera.y)>halfH+180)continue;
 if(g.isTable){if(this.table.complete&&this.table.naturalWidth)c.drawImage(this.table,g.x-TABLE_SPRITE.size/2,g.y-TABLE_SPRITE.offsetY,TABLE_SPRITE.size,TABLE_SPRITE.size);continue}
 c.fillStyle=g.isPlayer?'#526f4a50':'#34442f25';c.beginPath();c.ellipse(g.x,g.y-3,19,6,0,0,Math.PI*2);c.fill();if(g.isPlayer){c.strokeStyle='#fff8dc';c.lineWidth=2;c.beginPath();c.ellipse(g.x,g.y-3,23,8,0,0,Math.PI*2);c.stroke()}drawAvatar(c,g.avatar,g.x,g.y,97,g.isPlayer?this.t:this.npcTime+(g.seed||0),g.moving,g.isPlayer?this.direction:g.walk?.facing||'front',this.reduced,g.isPlayer?this.playerGait:g.walk?.gait);c.font='11px "Gowun Dodum",sans-serif';c.textAlign='center';c.fillStyle='#fffdf3ed';const width=c.measureText(g.name).width+15;c.beginPath();c.roundRect(g.x-width/2,g.y+5,width,20,4);c.fill();c.fillStyle='#4e603b';c.fillText(g.name,g.x,g.y+19);
 }
 if(this.target&&!this.reduced){c.strokeStyle='#fff7da';c.lineWidth=2;c.beginPath();c.ellipse(this.target.x,this.target.y,9+Math.sin(this.t*5)*2,5,0,0,Math.PI*2);c.stroke()}
 c.restore();
 c.save();c.font='12px "Gowun Dodum",sans-serif';c.textAlign='left';c.textBaseline='top';
 const candidates=all.filter(g=>!g.isTable&&g.message).map(g=>({id:g.id,message:g.message,x:(g.x-this.camera.x)*this.scale+this.w/2,y:(g.y-106-this.camera.y)*this.scale+this.h/2}));
 const maxVisible=document.querySelector('#speech')?.hidden===false?0:this.w<960?2:3;
 this.speechScheduler??=createSpeechScheduler();
 for(const bubble of this.speechScheduler.getLayout(candidates,this.t,{width:this.w,height:this.h,top:66,bottom:this.h<560?94:132,maxVisible,measureText:text=>c.measureText(text).width,reduced:this.reduced})){
  c.globalAlpha=bubble.opacity;
  c.fillStyle='#fffef5f5';c.strokeStyle='#aeba9270';c.lineWidth=1;c.beginPath();c.roundRect(bubble.x,bubble.y,bubble.width,bubble.height,8);c.fill();c.stroke();
  const tailY=bubble.y+bubble.height;c.beginPath();c.moveTo(bubble.tailX-5,tailY-1);c.lineTo(bubble.tailX,tailY+6);c.lineTo(bubble.tailX+5,tailY-1);c.fill();
  c.fillStyle='#52633f';bubble.lines.forEach((line,index)=>c.fillText(line,bubble.x+12,bubble.y+9+index*17));
 }
 c.restore();}
 loop(now){const dt=Math.min((now-this.last)/1000,.05);this.last=now;if(!document.hidden){this.update(dt);if(!this.dialogPaused||this.needsRender){this.render();this.needsRender=false}}requestAnimationFrame(n=>this.loop(n))}
}
