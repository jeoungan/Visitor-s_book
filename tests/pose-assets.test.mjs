import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../public/assets/poses-v2/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
function pngSize(name){
 const bytes=readFileSync(new URL(name,base));
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name);
 return[bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}
test('every selectable outfit has four distinct reaction slots and all eight directional walking slots',()=>{
 for(const family of ['wave','dance','clap','walk']){
  const columns=family==='walk'?8:4,rows=manifest.actions[family];
  assert.deepEqual(manifest.missing[family],[],`Incomplete ${family}`);
  assert.equal(rows.length,16);
  rows.forEach((frames,outfit)=>{
   assert.equal(frames.length,columns);
   for(const frame of frames){
    assert.ok(frame,`${family} / outfit ${outfit}`);
    assert.ok(frame.neck[0]>55&&frame.neck[0]<73,'neck stays centered');
    assert.ok(frame.neck[1]>20&&frame.neck[1]<58,'head stays attached above torso');
    assert.ok(frame.hand.every(value=>Number.isFinite(value)&&value>=0&&value<=128));
   }
  });
  assert.deepEqual(pngSize(`${family}.png`),[columns*128,16*128]);
  assert.deepEqual(pngSize(`${family}-skin.png`),[columns*128,16*128]);
 }
});
test('all sixteen hairstyles include front, left, right and back artwork with matching skin masks',()=>{
 assert.deepEqual(manifest.directions,['front','left','right','back']);
 assert.equal(manifest.heads.length,16);
 for(const frames of manifest.heads){assert.equal(frames.length,4);frames.forEach(frame=>assert.ok(frame?.neck&&frame?.bounds))}
 assert.deepEqual(pngSize('heads.png'),[512,2048]);
 assert.deepEqual(pngSize('heads-skin.png'),[512,2048]);
});
