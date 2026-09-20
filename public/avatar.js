import {selectedAccessories} from './accessories.js?v=20260920-celebration4';
import {bodyProportions,proportionY,bareArmStart,leftBareArmStart,LEFT_HAND_GRIPS,PROP_GRIPS} from './avatar-motion.js?v=20260920-celebration4';
import {poseFor} from './avatar-state.js?v=20260920-celebration4';
export const outfits=['네이비 클래식','차콜 포멀','그레이 더블','브라운 체크','샌드 블레이저','네이비 니트','블랙 수트','세이지 셔츠','네이비 트위드','블루 트위드','로즈 원피스','세이지 랩드레스','블랙 미디','블라우스 플리츠','차콜 팬츠수트','라벤더 페플럼'];
export const hairs=['댄디컷','6:4 가르마','볼륨 펌','내추럴 가르마','숏 크롭','소프트 펌','포마드','쉼표 머리','턱선 단발','C컬 단발','롱 웨이브','낮은 번','사이드 웨이브','반묶음','로우 포니테일','굵은 웨이브'];
export const accessories=['없음','둥근 안경','사각 안경','골드 안경','꽃핀','리본핀','진주핀','별핀','진주 귀걸이','링 귀걸이','미니백','토트백','클러치','꽃다발','보타이','코르사주'];
export const accessoryEmoji=['—','👓','👓','👓','🌼','🎀','🤍','⭐','🤍','💛','👜','👜','👝','💐','🎀','🌸'];
export const actions=[['idle','가만히','☺'],['wave','손인사','👋'],['dance','춤추기','♪'],['clap','박수','👏']];
export const skinColors=['#f2c5a0','#e2ad82','#ce9168','#ae7450','#865335','#65432f'];
export const hairColors=['#292627','#48342d','#6a4939','#79675f','#935f44','#ba9360','#bbb8ad','#653b4b'];
export const outfitColors=['#344863','#494a50','#9cbbcb','#c08a9a','#8eaa88','#afa0c1','#a48766','#ebe1c9'];
export const defaultAvatar=()=>({outfit:0,hair:0,skin:0,hairColor:hairColors[0],outfitColor:outfitColors[0],recolor:false,accessory:0,action:'idle'});
export const randomAvatar=()=>{const items=[[1,2,3],[4,5,6,7],[8,9],[10,11,12,13],[14],[15]].filter(()=>Math.random()<.3).map(group=>group[Math.floor(Math.random()*group.length)]);return{...defaultAvatar(),outfit:Math.floor(Math.random()*16),hair:Math.floor(Math.random()*16),accessory:items[0]??0,accessories:items,skin:Math.floor(Math.random()*6),hairColor:hairColors[Math.floor(Math.random()*hairColors.length)]}};
const NECK_SKIN_BOUNDS={4:[59,68,53],8:[58,69,53],9:[58,69,59],11:[58,69,59],13:[59,68,53]};
const EARRING_ANCHORS=[[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[51,40],[77,40]],[[51,40],[77,40]],[[50,40],[77,40]],[[48,40],[80,40]],[[51,40],[77,40]],[[50,40],[78,40]],[[48,40],[80,40]],[[51,40],[77,40]]];
const bodyImages=[], headImages=[], accessoryImages=[],cache=new Map(),spriteLayers=new WeakMap(),poseCache=new Map(),headCache=new Map(),avatarFrameCache=new Map(),handForegroundCache=new WeakMap(),atlases={},masks={};
let assetLoadPromise,poseManifest;
function load(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('캐릭터 이미지를 불러오지 못했어요.'));im.src=src})}
export function loadAvatars(){return assetLoadPromise??=(async()=>{
 const families=['wave','dance','clap','walk','heads'];
 const [bodies,heads,extras,manifest]=await Promise.all([
  Promise.all(Array.from({length:16},(_,i)=>load(`/assets/bodies/body-${i+1}.png`))),
  Promise.all(Array.from({length:16},(_,i)=>load(`/assets/heads/head-${i+1}.png`))),
  Promise.all(Array.from({length:15},(_,i)=>load(`/assets/accessories/accessory-${i+2}.png`))),
  fetch('/assets/poses-v2/manifest.json?v=20260920-celebration4').then(r=>{if(!r.ok)throw new Error('동작 정보를 불러오지 못했어요.');return r.json()}),
  ...families.map(async family=>{[atlases[family],masks[family]]=await Promise.all([
   load(`/assets/poses-v2/${family}.png?v=20260920-celebration4`),load(`/assets/poses-v2/${family}-skin.png?v=20260920-celebration4`)
  ])})
 ]);
 for(const family of ['wave','dance','clap','walk']){
  const columns=family==='walk'?8:4,rows=manifest.actions?.[family];
  if(rows?.length!==16||rows.some(row=>row?.length!==columns||row.some(frame=>!frame?.neck||!frame?.hand)))throw new Error('캐릭터 동작 이미지가 준비되지 않았어요.');
 }
 bodyImages.splice(0,bodyImages.length,...bodies);headImages.splice(0,headImages.length,...heads);
 extras.forEach((im,i)=>accessoryImages[i+1]=im);poseManifest=manifest;
})().catch(error=>{assetLoadPromise=null;throw error})}
export function accessoryImage(index){return accessoryImages[index]?.src}
const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16));
export function sprite(avatar){
 const a={...defaultAvatar(),...avatar},key=JSON.stringify([a.outfit,a.hair,a.skin,a.hairColor,a.outfitColor,a.recolor]);if(cache.has(key))return cache.get(key);
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d',{willReadFrequently:true});if(bodyImages.length!==16||headImages.length!==16)return c;
 const skin=rgb(skinColors[a.skin%6]),hair=rgb(a.hairColor),clothes=rgb(a.outfitColor),neck=NECK_SKIN_BOUNDS[a.outfit%16];
 // Compress bright fabric highlights before channels clip, keeping folds and trim.
 const clothesPeak=Math.max(...clothes),highlightStart=.75,maxSourceShade=.35+765/390;
 const layer=(im,isHead)=>{const l=document.createElement('canvas');l.width=l.height=128;const lc=l.getContext('2d',{willReadFrequently:true});lc.drawImage(im,0,0);const data=lc.getImageData(0,0,128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4,r=data.data[i],g=data.data[i+1],b=data.data[i+2];if(data.data[i+3]<40){data.data[i+3]=0;continue}
  const neckRegion=neck?(y<neck[2]&&x>=neck[0]&&x<=neck[1]):y<57;
  const skinRegion=isHead||neckRegion||(y<98&&((x<53&&y>=leftBareArmStart[a.outfit%16])||(x>75&&y>=bareArmStart[a.outfit%16])))||(y>103&&y<120&&[8,9,10,11,12,13,15].includes(a.outfit));
  const isSkin=skinRegion&&r>145&&r>g*1.06&&g>b*1.08&&r-g<95;
  const isHair=isHead&&r<150&&g<130&&b<130&&(!(x>52&&x<76&&y>31&&y<47));
  if(isSkin){const shade=Math.min(1.2,Math.max(.55,(r+g+b)/585));for(let k=0;k<3;k++)data.data[i+k]=Math.min(255,skin[k]*shade)}
  else if(isHair){const shade=.4+(r+g+b)/220;for(let k=0;k<3;k++)data.data[i+k]=Math.min(255,hair[k]*shade)}
  else if(!isHead&&a.recolor&&y<117){const raw=.35+(r+g+b)/390,shade=clothesPeak>170&&raw>highlightStart?highlightStart+(255/clothesPeak-highlightStart)*(raw-highlightStart)/(maxSourceShade-highlightStart):Math.min(1.5,raw);for(let k=0;k<3;k++)data.data[i+k]=Math.min(255,clothes[k]*shade)}
 }lc.putImageData(data,0,0);return l;};
 const body=layer(bodyImages[a.outfit%16],false),head=layer(headImages[a.hair%16],true);ctx.drawImage(body,0,0);ctx.drawImage(head,0,0);spriteLayers.set(c,{body,head});
 if(cache.size>240)cache.delete(cache.keys().next().value);cache.set(key,c);return c;
}
const DIRECTIONS=['front','left','right','back'];
function trimCache(map,max=384){if(map.size>max)map.delete(map.keys().next().value)}
function recolorFrame(image,mask,row,column,a,isHead=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(mask,column*128,row*128,128,128,0,0,128,128);
 const skinMask=ctx.getImageData(0,0,128,128).data;ctx.clearRect(0,0,128,128);
 ctx.drawImage(image,column*128,row*128,128,128,0,0,128,128);
 const pixels=ctx.getImageData(0,0,128,128),skin=rgb(skinColors[a.skin%6]),hair=rgb(a.hairColor),clothes=rgb(a.outfitColor),peak=Math.max(...clothes);
 for(let i=0;i<pixels.data.length;i+=4){
  const d=pixels.data,r=d[i],g=d[i+1],b=d[i+2],y=Math.floor(i/4/128);if(d[i+3]<40){d[i+3]=0;continue}
  if(skinMask[i+3]>64&&skinMask[i]>128){const shade=Math.min(1.2,Math.max(.5,(r+g+b)/585));for(let k=0;k<3;k++)d[i+k]=Math.min(255,skin[k]*shade)}
  else if(isHead){
   // Facial ink sits next to skin. Dark hair shadows must also receive the
   // selected color, otherwise a light hairstyle turns patchy in side views.
   let facialInk=false;
   if(Math.max(r,g,b)<40){const x=i/4%128;for(let dy=-2;dy<=2&&!facialInk;dy++)for(let dx=-2;dx<=2;dx++){
    const nx=x+dx,ny=y+dy,n=(ny*128+nx)*4;if(nx>=0&&nx<128&&ny>=0&&ny<128&&skinMask[n]>128&&skinMask[n+3]>64){facialInk=true;break}
   }}
   if(!facialInk&&Math.min(r,g,b)<195){const shade=Math.min(2,.4+(r+g+b)/220);for(let k=0;k<3;k++)d[i+k]=Math.min(255,hair[k]*shade)}
  }else if(a.recolor&&y<117){const raw=.35+(r+g+b)/390,shade=peak>170&&raw>.75?.75+(255/peak-.75)*(raw-.75)/(.35+765/390-.75):Math.min(1.5,raw);for(let k=0;k<3;k++)d[i+k]=Math.min(255,clothes[k]*shade)}
 }
 ctx.putImageData(pixels,0,0);return canvas;
}
function generatedBody(a,pose){
 const column=pose.family==='walk'?DIRECTIONS.indexOf(pose.direction)*2+pose.frame:pose.frame;
 const key=JSON.stringify([pose.family,column,a.outfit,a.skin,a.outfitColor,a.recolor]);
 if(!poseCache.has(key)){poseCache.set(key,recolorFrame(atlases[pose.family],masks[pose.family],a.outfit,column,a));trimCache(poseCache)}
 return{image:poseCache.get(key),metadata:poseManifest.actions[pose.family][a.outfit][column],skinMask:{image:masks[pose.family],column,row:a.outfit}};
}
function generatedHead(a,direction){
 const column=DIRECTIONS.indexOf(direction),key=JSON.stringify([a.hair,column,a.skin,a.hairColor]);
 if(!headCache.has(key)){headCache.set(key,recolorFrame(atlases.heads,masks.heads,a.hair,column,a,true));trimCache(headCache,192)}
 return headCache.get(key);
}
// Whole, newly drawn poses replace the old arm/leg cut-and-rotate rig.
// The original front view remains the source for a resting character.
function restingBody(a){
 const original=sprite(a),layers=spriteLayers.get(original),key=JSON.stringify(['idle',a.outfit,a.skin,a.outfitColor,a.recolor]);
 if(!poseCache.has(key)&&layers){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const {split,ankle,extension,scale}=bodyProportions(a.outfit);
  ctx.drawImage(layers.body,0,0,128,split,0,-extension,128,split);
  ctx.drawImage(layers.body,0,split,128,ankle-split,0,split-extension,128,(ankle-split)*scale);
  ctx.drawImage(layers.body,0,ankle,128,128-ankle,0,ankle,128,128-ankle);
  poseCache.set(key,canvas);trimCache(poseCache);
 }
 return{image:poseCache.get(key)||original,metadata:{neck:poseManifest.resting?.[a.outfit]?.neck||[64,39],hand:[LEFT_HAND_GRIPS[a.outfit][0],proportionY(LEFT_HAND_GRIPS[a.outfit][1],a.outfit)]},frontHead:layers?.head};
}
function drawExtras(ctx,a,pose,metadata,headOffset,handOnly=false){
 const [hx,hy]=headOffset,direction=pose.direction;
 const registration=poseManifest.heads?.[a.hair]?.[DIRECTIONS.indexOf(direction)]?.accessoryTransform;
 const scale=direction==='front'?1:registration?.scale||1;
 const point=(x,y)=>direction==='front'?[hx+x,hy+y]:[hx+(registration?.to[0]??64)+(x-64)*scale,hy+(registration?.to[1]??47)+(y-47)*scale];
 const rect=(image,x,y,w,h)=>{const [px,py]=point(x,y);ctx.drawImage(image,px,py,w*scale,h*scale)};
 for(const ai of selectedAccessories(a)){
  const image=accessoryImages[ai];if(!image)continue;
  if(Boolean(PROP_GRIPS[ai])!==handOnly)continue;
  if(handOnly){
   const [x,y]=metadata.hand||[44,85],[gx,gy]=PROP_GRIPS[ai],w=ai===13?43.5:30.7,h=ai===13?48.6:32;
   ctx.drawImage(image,x-w*gx,y-h*gy,w,h);continue;
  }
  if(ai>=1&&ai<=3){
   if(direction==='back')continue;
   if(direction==='front')rect(image,46.7,16.6,34.6,24.3);
   else{const left=direction==='left',[px,py]=point(left?43:69,17);ctx.drawImage(image,left?0:64,0,64,128,px,py,13*scale,24*scale)}
  }else if(ai>=4&&ai<=7){
   const x=direction==='back'?75:direction==='left'?68:direction==='right'?54:77;
   rect(image,x-10.2,1.2,20.5,20.5);
  }else if(ai===8||ai===9){
   if(direction==='back')continue;
   const ears=direction==='front'?EARRING_ANCHORS[a.hair]:[[direction==='left'?66:62,40]];
   ears.forEach(([x,y],side)=>{const height=10.5,width=height/2,studY=ai===8?30/128:15/128,studX=ai===8?[34/64,27/64]:[34/64,28/64],[px,py]=point(x-width*studX[side],y-9-height*studY);ctx.drawImage(image,side*64,0,64,128,px,py,width*scale,height*scale)})
  }else if(direction==='front'){
   const [nx,ny]=metadata.neck||[64,39];
   if(ai===14)ctx.drawImage(image,nx-10.2,ny+1,20.5,15.4);
   else if(ai===15)ctx.drawImage(image,nx-20.5,ny+11,15.4,17.9);
  }
 }
}
function drawHandOverProp(ctx,body){
 // Occlusion only: redraw existing hand pixels over the bag handle or flower stems.
 // No limb is moved, rotated, or used to construct a different pose.
 let foreground=body.image;
 if(body.skinMask){
  if(!handForegroundCache.has(body.image)){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),mask=body.skinMask;
   c.drawImage(body.image,0,0);c.globalCompositeOperation='destination-in';
   c.drawImage(mask.image,mask.column*128,mask.row*128,128,128,0,0,128,128);
   handForegroundCache.set(body.image,canvas);
  }
  foreground=handForegroundCache.get(body.image);
 }
 ctx.save();ctx.beginPath();ctx.arc(...body.metadata.hand,body.skinMask?7:4.5,0,Math.PI*2);ctx.clip();ctx.drawImage(foreground,0,0);ctx.restore();
}
export function drawAvatar(ctx,avatar,x,y,size=80,time=0,moving=false,direction='front',reduced=false,gait=time*6){
 if(!poseManifest||bodyImages.length!==16)return;
 const a={...defaultAvatar(),...avatar},facing=typeof direction==='string'?direction:direction<0?'left':'right',pose=poseFor(a,moving,facing,time,gait,reduced);
 const key=JSON.stringify([a,pose.family,pose.direction,pose.frame]);
 if(!avatarFrameCache.has(key)){
  const body=pose.family==='idle'?restingBody(a):generatedBody(a,pose),neck=body.metadata.neck||[64,39],rest=poseManifest.resting?.[a.outfit]?.neck||[64,39],headOffset=[Math.round(neck[0]-rest[0]),Math.round(neck[1]-rest[1])];
  // Register all parts on one integer pixel grid before world scaling. Separate
  // nearest-neighbor draws at fractional anchors made the neck and face flicker.
  // Padding preserves hair/props when a genuine walking pose raises the torso.
  const frame=document.createElement('canvas');frame.width=frame.height=176;const fc=frame.getContext('2d');fc.imageSmoothingEnabled=false;fc.translate(24,24);
  fc.drawImage(body.image,0,0);drawExtras(fc,a,pose,body.metadata,headOffset,true);
  if(selectedAccessories(a).some(item=>PROP_GRIPS[item]))drawHandOverProp(fc,body);
  if(pose.direction==='front'){
   const layers=spriteLayers.get(sprite(a));if(layers)fc.drawImage(layers.head,headOffset[0],headOffset[1]-9);
  }else fc.drawImage(generatedHead(a,pose.direction),headOffset[0],headOffset[1]);
  drawExtras(fc,a,pose,body.metadata,headOffset);avatarFrameCache.set(key,frame);trimCache(avatarFrameCache,384);
 }
 ctx.save();ctx.translate(x-size/2,y-size);ctx.scale(size/128,size/128);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(avatarFrameCache.get(key),-24,-24);ctx.restore();
}
export function paintPreview(canvas,a,time=0,animate=false){const ctx=canvas.getContext('2d');if(canvas.width!==256)canvas.width=256;if(canvas.height!==340)canvas.height=340;ctx.clearRect(0,0,256,340);ctx.fillStyle='#9bad7d30';ctx.beginPath();ctx.ellipse(128,311,48,10,0,0,Math.PI*2);ctx.fill();drawAvatar(ctx,a,128,315,260,time,false,'front',!animate)}
