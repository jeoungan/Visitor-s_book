import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Garden} from '../public/garden.js';

test('dialogs freeze the garden with one render, redraw changed scenes and resume without a time jump',()=>{
 let dialog=true,renders=0,saves=0,stops=0;
 globalThis.document={hidden:false,querySelector:()=>dialog?{open:true}:null};globalThis.requestAnimationFrame=()=>{};globalThis.devicePixelRatio=1;
 const garden=Object.create(Garden.prototype);
 Object.assign(garden,{last:0,t:0,npcTime:0,needsRender:true,dialogPaused:false,world:{w:1536,h:1024},guests:[],player:{id:'mine',x:768,y:600},playerGait:0,zoom:1,keys:new Set(['d']),axis:{x:1,y:0},route:[{x:900,y:600}],target:{x:850,y:600},moving:true,follow:false,lastSave:0,onMove(){saves++},render(){renders++},canvas:{getBoundingClientRect:()=>({width:390,height:844})}});
 garden.stop=function(){stops++;Garden.prototype.stop.call(this)};
 for(let frame=1;frame<=60;frame++)garden.loop(frame*1000/60);
 assert.equal(renders,1);assert.equal(stops,1);assert.equal(saves,1);assert.equal(garden.t,0);assert.equal(garden.npcTime,0);assert.equal(garden.keys.size,0);assert.equal(garden.target,null);
 garden.resize();garden.loop(61*1000/60);garden.loop(62*1000/60);assert.equal(renders,2);assert.equal(garden.canvas.width,390);
 garden.invalidate();document.hidden=true;garden.loop(63*1000/60);assert.equal(renders,2);assert.equal(garden.needsRender,true);
 document.hidden=false;garden.loop(64*1000/60);assert.equal(renders,3);assert.equal(garden.t,0);
 dialog=false;garden.loop(65*1000/60);assert.ok(Math.abs(garden.t-1/60)<1e-10);assert.equal(renders,4);assert.equal(garden.player.x,768);
 dialog=true;garden.loop(66*1000/60);garden.loop(67*1000/60);assert.equal(renders,5);assert.equal(stops,2);assert.equal(saves,1);
});
