import {selectedAccessories} from './accessories.js?v=20260920-review9';
import {walkingPose,ARM_RIGS,wavingPose,bodyProportions,proportionY,bareArmStart,leftBareArmStart,LEFT_HAND_GRIPS,PROP_GRIPS} from './avatar-motion.js?v=20260920-review9';
export const outfits=['네이비 클래식','차콜 포멀','그레이 더블','브라운 체크','샌드 블레이저','네이비 니트','블랙 수트','세이지 셔츠','네이비 트위드','블루 트위드','로즈 원피스','세이지 랩드레스','블랙 미디','블라우스 플리츠','차콜 팬츠수트','라벤더 페플럼'];
export const hairs=['댄디컷','6:4 가르마','볼륨 펌','내추럴 가르마','숏 크롭','소프트 펌','포마드','쉼표 머리','턱선 단발','C컬 단발','롱 웨이브','낮은 번','사이드 웨이브','반묶음','로우 포니테일','굵은 웨이브'];
export const accessories=['없음','둥근 안경','사각 안경','골드 안경','꽃핀','리본핀','진주핀','별핀','진주 귀걸이','링 귀걸이','미니백','토트백','클러치','꽃다발','보타이','코르사주'];
export const accessoryEmoji=['—','👓','👓','👓','🌼','🎀','🤍','⭐','🤍','💛','👜','👜','👝','💐','🎀','🌸'];
export const actions=[['idle','가만히','☺'],['wave','손인사','👋'],['bow','꾸벅','🙇'],['dance','춤추기','♪'],['clap','박수','👏'],['jump','폴짝','✧'],['heart','하트','♡'],['spin','빙그르','↻']];
export const skinColors=['#f2c5a0','#e2ad82','#ce9168','#ae7450','#865335','#65432f'];
export const hairColors=['#292627','#48342d','#6a4939','#79675f','#935f44','#ba9360','#bbb8ad','#653b4b'];
export const outfitColors=['#344863','#494a50','#9cbbcb','#c08a9a','#8eaa88','#afa0c1','#a48766','#ebe1c9'];
export const defaultAvatar=()=>({outfit:0,hair:0,skin:0,hairColor:hairColors[0],outfitColor:outfitColors[0],recolor:false,accessory:0,action:'idle'});
export const randomAvatar=()=>{const items=[[1,2,3],[4,5,6,7],[8,9],[10,11,12,13],[14],[15]].filter(()=>Math.random()<.3).map(group=>group[Math.floor(Math.random()*group.length)]);return{...defaultAvatar(),outfit:Math.floor(Math.random()*16),hair:Math.floor(Math.random()*16),accessory:items[0]??0,accessories:items,skin:Math.floor(Math.random()*6),hairColor:hairColors[Math.floor(Math.random()*hairColors.length)]}};
const NECK_SKIN_BOUNDS={4:[59,68,53],8:[58,69,53],9:[58,69,59],11:[58,69,59],13:[59,68,53]};
const EARRING_ANCHORS=[[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[48,41],[80,41]],[[51,40],[77,40]],[[51,40],[77,40]],[[50,40],[77,40]],[[48,40],[80,40]],[[51,40],[77,40]],[[50,40],[78,40]],[[48,40],[80,40]],[[51,40],[77,40]]];
const bodyImages=[], headImages=[], accessoryImages=[],cache=new Map(),waveCache=new WeakMap(),spriteLayers=new WeakMap(),palmCache=new Map();
let assetLoadPromise,poseCanvas,palmImage;
function load(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('캐릭터 이미지를 불러오지 못했어요.'));im.src=src})}
export function loadAvatars(){return assetLoadPromise??=(async()=>{const [bodies,heads,extras,palm]=await Promise.all([Promise.all(Array.from({length:16},(_,i)=>load(`/assets/bodies/body-${i+1}.png`))),Promise.all(Array.from({length:16},(_,i)=>load(`/assets/heads/head-${i+1}.png`))),Promise.all(Array.from({length:15},(_,i)=>load(`/assets/accessories/accessory-${i+2}.png`).catch(()=>null))),load('/assets/wave-palm.png')]);bodyImages.splice(0,bodyImages.length,...bodies);headImages.splice(0,headImages.length,...heads);extras.forEach((im,i)=>accessoryImages[i+1]=im);palmImage=palm})().catch(error=>{assetLoadPromise=null;throw error})}
export function accessoryImage(index){return accessoryImages[index]?.src}
const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16));
function wavePalm(skinIndex=0){
 const key=skinIndex%6;if(palmCache.has(key))return palmCache.get(key);if(!palmImage)return null;
 const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),skin=rgb(skinColors[key]);ctx.drawImage(palmImage,0,0,64,64);
 const pixels=ctx.getImageData(0,0,64,64);for(let i=0;i<pixels.data.length;i+=4){if(pixels.data[i+3]<40){pixels.data[i+3]=0;continue}const sum=pixels.data[i]+pixels.data[i+1]+pixels.data[i+2];if(sum<150)continue;const shade=Math.min(1.2,Math.max(.3,sum/585));for(let k=0;k<3;k++)pixels.data[i+k]=Math.min(255,skin[k]*shade)}
 ctx.putImageData(pixels,0,0);palmCache.set(key,c);return c;
}
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
function waveLayers(im,layers,outfit){
 if(waveCache.has(im))return waveCache.get(im);
 const rig=ARM_RIGS[outfit]||ARM_RIGS[0],body=document.createElement('canvas'),forearm=document.createElement('canvas'),upper=document.createElement('canvas');body.width=body.height=forearm.width=forearm.height=upper.width=upper.height=128;
 const trace=(c,polygon)=>{c.beginPath();polygon.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath()};
 const bc=body.getContext('2d');bc.drawImage(layers.body,0,0);bc.globalCompositeOperation='destination-out';
 for(const polygon of [rig.upper,rig.polygon]){trace(bc,polygon);bc.fill();bc.lineWidth=1.5;bc.lineJoin='round';bc.stroke()}
 const ac=forearm.getContext('2d');trace(ac,rig.polygon);ac.clip();ac.drawImage(layers.body,0,0);ac.clearRect(0,0,128,rig.elbow[1]);ac.clearRect(0,rig.wrist[1],128,128-rig.wrist[1]);
 const uc=upper.getContext('2d');trace(uc,rig.upper);uc.clip();uc.drawImage(layers.body,0,0);
 // Preserve the original shoulder pixels as a stationary cap at the joint.
 bc.globalCompositeOperation='source-over';bc.save();bc.beginPath();bc.arc(...rig.shoulder,4.5,0,Math.PI*2);bc.clip();bc.drawImage(layers.body,0,0);bc.restore();
 // Clipping an antialiased sleeve can leave one-pixel fragments at its old
 // position. Discard only tiny disconnected remnants, not garment edges.
 const pixels=bc.getImageData(0,0,128,128),seen=new Uint8Array(128*128);
 for(let start=0;start<seen.length;start++){
  if(seen[start]||pixels.data[start*4+3]<40)continue;
  const component=[start];seen[start]=1;
  for(let j=0;j<component.length;j++){const p=component[j],px=p%128,py=p>>7;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=px+dx,ny=py+dy,n=ny*128+nx;if(nx>=0&&nx<128&&ny>=0&&ny<128&&!seen[n]&&pixels.data[n*4+3]>=40){seen[n]=1;component.push(n)}}}
  if(component.length<8)for(const p of component)pixels.data[p*4+3]=0;
 }
 for(let p=3;p<pixels.data.length;p+=4)if(pixels.data[p]<40)pixels.data[p]=0;
 bc.putImageData(pixels,0,0);
 const result={body,forearm,upper,elbow:rig.elbow,shoulder:rig.shoulder,wrist:rig.wrist};waveCache.set(im,result);return result;
}
function drawBodyPose(ctx,drawn,layers,wave,pose,walking,time,skin){
 if(walking){
  for(let leg=0;leg<2;leg++){const motion=pose.legs[leg];ctx.save();ctx.translate(0,pose.cut);ctx.transform(1,0,motion.shear,motion.scaleY,0,0);ctx.drawImage(drawn,leg*64,pose.cut,64,128-pose.cut,leg*64,0,64,128-pose.cut);ctx.restore()}
  ctx.drawImage(drawn,0,0,128,pose.cut+1,0,0,128,pose.cut+1);
 }else ctx.drawImage(drawn,0,0);
 if(layers)ctx.drawImage(layers.head,0,0);
 if(wave){
  const [sx,sy]=wave.shoulder,[ex,ey]=wave.elbow,[wx,wy]=wave.wrist,angles=wavingPose(time);
  ctx.save();ctx.translate(sx,sy);ctx.rotate(angles.upper);ctx.drawImage(wave.upper,-sx,-sy);
  ctx.translate(ex-sx,ey-sy);ctx.rotate(angles.forearm);ctx.drawImage(wave.forearm,-ex,-ey);
  const palm=wavePalm(skin);if(palm){ctx.translate(wx-ex,wy-ey);ctx.rotate(Math.PI-Math.atan2(wx-ex,wy-ey)+angles.wrist);ctx.drawImage(palm,-6,-10.45,12,12)}
  ctx.restore();
 }
}
export function drawAvatar(ctx,a,x,y,size=80,time=0,moving=false,direction=1,reduced=false,gait=time*6){
 const im=sprite(a),act=a?.action||'idle',t=reduced?0:time,walking=moving&&!reduced,pose=walkingPose(a?.outfit||0,gait);ctx.save();ctx.translate(x,y);
 let bounce=walking?pose.bob:Math.sin(t*2)*.3;
 if(act==='jump')bounce+=Math.abs(Math.sin(t*4))*17;if(act==='dance'){ctx.rotate(Math.sin(t*6)*.13);bounce+=Math.abs(Math.sin(t*6))*4}if(act==='bow')ctx.scale(1,1-Math.max(0,Math.sin(t*3))*.2);if(act==='spin')ctx.scale(Math.cos(t*4),1);
 ctx.translate(0,-bounce);ctx.scale(direction<0?-1:1,1);ctx.imageSmoothingEnabled=false;
 const layers=spriteLayers.get(im),wave=act==='wave'&&layers?waveLayers(im,layers,a.outfit):null,drawn=wave?.body||layers?.body||im;
 ctx.save();ctx.translate(-size/2,-size);ctx.scale(size/128,size/128);
 if(!poseCanvas){poseCanvas=document.createElement('canvas');poseCanvas.width=poseCanvas.height=128}
 const pc=poseCanvas.getContext('2d');pc.clearRect(0,0,128,128);pc.imageSmoothingEnabled=false;drawBodyPose(pc,drawn,layers,wave,pose,walking,t,a?.skin||0);
 const outfit=a?.outfit||0,{split,ankle,extension,scale}=bodyProportions(outfit);
 ctx.drawImage(poseCanvas,0,0,128,split,0,-extension,128,split);
 ctx.drawImage(poseCanvas,0,split,128,ankle-split,0,split-extension,128,(ankle-split)*scale);
 ctx.drawImage(poseCanvas,0,ankle,128,128-ankle,0,ankle,128,128-ankle);
 ctx.restore();
 if(act==='clap'){ctx.font=`${size*.18}px sans-serif`;ctx.textAlign='center';ctx.fillText('👏',Math.sin(t*12)*size*.025,(proportionY(128*(1-.42),outfit)-128)*size/128)}
 if(act==='heart'){ctx.fillStyle='#c87484';ctx.font=`${size*.18}px serif`;ctx.textAlign='center';ctx.fillText('♡',0,-size*(.90+Math.sin(t*3)*.03+extension/128))}
 for(const ai of selectedAccessories(a)){
   if((ai===8||ai===9)&&accessoryImages[ai]){
    const ears=EARRING_ANCHORS[a.hair%16||0],height=size*.082,width=height/2,studY=ai===8?30/128:15/128,studX=ai===8?[34/64,27/64]:[34/64,28/64];
    for(let side=0;side<2;side++){
     const [ex,ey]=ears[side];ctx.drawImage(accessoryImages[ai],side*64,0,64,128,(ex-64)*size/128-width*studX[side],(proportionY(ey,outfit)-128)*size/128-height*studY,width,height);
    }
    continue;
   }
  let ax=0,ay=-size*.705,w=size*.27,h=size*.19;if(ai>=4&&ai<=7){ax=size*.102;ay=-size*.845;w=size*.16;h=size*.16}else if(ai===8||ai===9){ay=-size*.62;w=size*.28;h=size*.14}else if(ai>=10&&ai<=12){ax=size*.2;ay=-size*.29;w=size*.24;h=size*.25}else if(ai===13){ax=size*.18;ay=-size*.4;w=size*.34;h=size*.38}else if(ai===14){ay=-size*.56;w=size*.16;h=size*.12}else if(ai===15){ax=-size*.1;ay=-size*.47;w=size*.12;h=size*.14}
   ay=(proportionY(128+ay*128/size,outfit)-128)*size/128;
   const hand=PROP_GRIPS[ai]?LEFT_HAND_GRIPS[outfit]:null;
   if(hand){const [gx,gy]=PROP_GRIPS[ai];ax=(hand[0]-64)*size/128+w*(.5-gx);ay=(proportionY(hand[1],outfit)-128)*size/128+h*(.5-gy)}
   if(accessoryImages[ai]){
    ctx.drawImage(accessoryImages[ai],ax-w/2,ay-h/2,w,h);
    if(hand&&layers){const hx=Math.floor(hand[0])-4,hy=Math.floor(hand[1])-5,hw=9,hh=9;ctx.drawImage(layers.body,hx,hy,hw,hh,(hx-64)*size/128,(proportionY(hy,outfit)-128)*size/128,hw*size/128,(proportionY(hy+hh,outfit)-proportionY(hy,outfit))*size/128)}
   }else {ctx.font=`${size*.18}px sans-serif`;ctx.textAlign='center';ctx.fillText(accessoryEmoji[ai],ax,ay)}
 }
 ctx.restore();
}
export function paintPreview(canvas,a,time=0,animate=false){const ctx=canvas.getContext('2d');if(canvas.width!==256)canvas.width=256;if(canvas.height!==340)canvas.height=340;ctx.clearRect(0,0,256,340);ctx.fillStyle='#9bad7d30';ctx.beginPath();ctx.ellipse(128,311,48,10,0,0,Math.PI*2);ctx.fill();drawAvatar(ctx,a,128,315,260,time,false,1,!animate)}
