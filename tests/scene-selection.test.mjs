import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Garden} from '../public/garden.js';

test('table pixels block hidden guests while transparent gaps and foreground guests remain selectable',()=>{
 const garden=Object.create(Garden.prototype),hidden={id:'behind-table',x:380,y:485};
 Object.assign(garden,{guests:[hidden],player:{id:'visitor',x:768,y:440},tableMask:{width:240,height:240,data:new Uint8ClampedArray(240*240*4)}});
 garden.tableMask.data[(55*240+100)*4+3]=249;
 assert.equal(garden.pickGuest({x:390,y:480}),null);
 assert.equal(garden.pickGuest({x:385,y:480}).id,hidden.id);
 assert.equal(garden.pickGuest({x:380,y:420}).id,hidden.id);
 const front={id:'in-front-of-table',x:390,y:650};garden.guests.push(front);
 garden.tableMask.data[(195*240+100)*4+3]=255;
 assert.equal(garden.pickGuest({x:390,y:620}).id,front.id);
 assert.equal(garden.pickGuest({x:700,y:800}),null);
});

test('expanded courtyard tables participate in the same depth and pixel selection rules',()=>{
 const garden=Object.create(Garden.prototype),guest={id:'behind-second-table',x:380,y:1509};
 Object.assign(garden,{world:{h:2048},guests:[guest],player:{id:'visitor',x:768,y:1464},tableMask:{width:240,height:240,data:new Uint8ClampedArray(240*240*4)}});
 garden.tableMask.data[(55*240+100)*4+3]=255;
 assert.equal(garden.sceneEntities().filter(entity=>entity.isTable).length,8);
 assert.equal(garden.pickGuest({x:390,y:1504}),null);assert.equal(garden.pickGuest({x:385,y:1504}).id,guest.id);
 garden.world.h=1024;assert.equal(garden.sceneEntities().filter(entity=>entity.isTable).length,4);
});
