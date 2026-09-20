// Offline rendering QA. Requires @napi-rs/canvas in NODE_PATH (no browser or DB writes).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {createCanvas,Image}=require('@napi-rs/canvas');
const root=process.cwd(),destination=path.join(root,'artifacts','pose-renderer');
fs.mkdirSync(destination,{recursive:true});
globalThis.document={createElement:()=>createCanvas(128,128)};
globalThis.Image=class extends Image{
 set src(value){super.src=value.startsWith('/assets/')?path.join(root,'public',value.split('?')[0]):value}
 get src(){return super.src}
};
globalThis.fetch=async value=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'public',value.split('?')[0]),'utf8'))});
const {defaultAvatar,loadAvatars,drawAvatar,actions}=await import('../public/avatar.js');
await loadAvatars();
const actionsOnly=process.argv.includes('--actions-only');
assert.deepEqual(actions.map(([id])=>id),['idle','wave','dance','clap','spin']);
function sheet(name,columns,rows,render){
 const canvas=createCanvas(columns*160,rows*180),ctx=canvas.getContext('2d');
 ctx.fillStyle='#e9e2d2';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const {avatar,time=0,moving=false,direction='front',gait=0,label}=render(row,column);
  drawAvatar(ctx,avatar,column*160+80,row*180+153,146,time,moving,direction,false,gait);
  ctx.fillStyle='#263d32';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(label,column*160+80,row*180+175);
 }
 fs.writeFileSync(path.join(destination,name+'.png'),canvas.toBuffer('image/png'));
}
for(const action of ['wave','dance','clap'])for(const start of [0,8]){
 sheet(`${action}-${start}-${start+7}`,4,8,(row,frame)=>({avatar:{...defaultAvatar(),outfit:start+row,hair:start+row,action},time:(frame+.2)/(action==='dance'?4:5),label:`${start+row} ${action} ${frame}`}));
}
if(!actionsOnly)for(const start of [0,8])sheet(`walk-${start}-${start+7}`,8,8,(row,column)=>({avatar:{...defaultAvatar(),outfit:start+row,hair:start+row},moving:true,direction:['front','left','right','back'][Math.floor(column/2)],gait:(column%2+.1)*Math.PI,label:`${start+row} ${['F','L','R','B'][Math.floor(column/2)]}${column%2}`}));
sheet('customization',8,8,(row,column)=>({avatar:{...defaultAvatar(),outfit:row+8,hair:column+8,action:['wave','dance','clap'][column%3],skin:column%6,hairColor:['#292627','#935f44','#bbb8ad'][column%3],outfitColor:['#ebe1c9','#afa0c1','#344863'][column%3],recolor:true,accessories:[3,4+column%4,8+column%2,10+column%4,14,15]},time:.3,label:`O${row+8} H${column+8} S${column%6}`}));
if(!actionsOnly)sheet('directions-accessories',4,16,(row,column)=>({avatar:{...defaultAvatar(),outfit:row,hair:row,skin:row%6,hairColor:row%2?'#ba9360':'#292627',accessories:[3,4+row%4,8+row%2,10+row%4]},moving:true,direction:['front','left','right','back'][column],label:`${row} ${['F','L','R','B'][column]}`}));
const probe=createCanvas(128,128),ctx=probe.getContext('2d');let checked=0;
for(let outfit=0;outfit<16;outfit++)for(const action of ['wave','dance','clap']){
 const signatures=[];
 for(let frame=0;frame<4;frame++){
  ctx.clearRect(0,0,128,128);drawAvatar(ctx,{...defaultAvatar(),outfit,hair:outfit,action},64,128,128,(frame+.1)/(action==='dance'?4:5));
  const pixels=ctx.getImageData(0,0,128,128).data;
  assert(pixels.some((value,index)=>index%4===3&&value>100),`Empty ${outfit} ${action} ${frame}`);
  signatures.push(probe.toBuffer('image/png').toString('base64'));checked++;
 }
 assert.equal(new Set(signatures).size,4,`Repeated whole poses: ${outfit}/${action}`);
}
if(!actionsOnly)for(let outfit=0;outfit<16;outfit++)for(const direction of ['front','left','right','back']){
 for(const gait of [.1,Math.PI+.1]){ctx.clearRect(0,0,128,128);drawAvatar(ctx,{...defaultAvatar(),outfit,hair:outfit},64,128,128,0,true,direction,false,gait);assert(ctx.getImageData(0,0,128,128).data.some((value,index)=>index%4===3&&value>100));checked++}
}
console.log(JSON.stringify({renderedFrames:checked,output:destination}));
