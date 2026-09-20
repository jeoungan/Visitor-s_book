import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COURTYARD_TOP,findPath,nearestPoint,walkable} from '../public/navigation.js';
import {TERRACE_TABLES,tablesForHeight,TABLE_RADIUS_X,TABLE_RADIUS_Y} from '../public/venue-layout.js';
test('open aisles connect directly while a table still requires a detour',()=>{
 for(const target of [{x:800,y:720},{x:820,y:51019}])assert.deepEqual(findPath({x:768,y:500},target,51200),[target]);
 const route=findPath({x:280,y:580},{x:550,y:580});assert.ok(route.length>1);
});
test('tables and chairs are obstacles in each expanded courtyard',()=>{
 for(const table of tablesForHeight(3072)){
  for(const p of [{x:table.x,y:table.y},{x:table.x+TABLE_RADIUS_X-1,y:table.y},{x:table.x,y:table.y+TABLE_RADIUS_Y-1}])assert.equal(walkable(p.x,p.y,3072),false);
  const resolved=nearestPoint(table,3072);assert.ok(walkable(resolved.x,resolved.y,3072));assert.ok(Math.hypot(resolved.x-table.x,resolved.y-table.y)>=TABLE_RADIUS_Y);
  const path=findPath({x:768,y:Math.floor(table.y/1024)*1024+650},table,3072);assert.ok(path.length);assert.deepEqual(path.at(-1),resolved);
 }
});
test('cross-courtyard routes go around tables and keep every connecting segment clear',()=>{
 for(const [start,target] of [[{x:250,y:580},{x:1320,y:580}],[{x:300,y:825},{x:1290,y:815}],[{x:410,y:430},{x:410,y:960}],[{x:1120,y:410},{x:1120,y:960}]]){
  const path=findPath(start,target);assert.ok(path.length);assert.deepEqual(path.at(-1),target);let previous=start;
  for(const p of path){for(let i=0;i<=32;i++){const t=i/32;assert.ok(walkable(previous.x+(p.x-previous.x)*t,previous.y+(p.y-previous.y)*t),`${JSON.stringify(previous)} -> ${JSON.stringify(p)} at ${t}`)}previous=p}
 }
});
test('approaching chair edges cannot cut through a table between navigation cells',()=>{
 for(const table of TERRACE_TABLES)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){
  const edge=nearestPoint({x:table.x+Math.cos(angle)*(TABLE_RADIUS_X+2),y:table.y+Math.sin(angle)*(TABLE_RADIUS_Y+2)}),center={x:768,y:650};
  for(const [start,target] of [[edge,center],[center,edge]]){
   const path=findPath(start,target);assert.ok(path.length);let previous=start;
   for(const p of path){for(let i=0;i<=32;i++){const t=i/32;assert.ok(walkable(previous.x+(p.x-previous.x)*t,previous.y+(p.y-previous.y)*t))}previous=p}
  }
 }
});
test('Eunpyeong courtyard keeps visitors below the backdrop, flower arch and corner planters',()=>{
 for(const p of [{x:768,y:100},{x:768,y:250},{x:768,y:370},{x:650,y:350},{x:875,y:350},{x:179,y:550},{x:1390,y:480},{x:190,y:900},{x:1330,y:900}])assert.equal(walkable(p.x,p.y),false,JSON.stringify(p));
 for(const p of [{x:768,y:400},{x:190,y:500},{x:1340,y:650},{x:240,y:900},{x:1240,y:900}])assert.equal(walkable(p.x,p.y),true,JSON.stringify(p));
 for(const target of [{x:768,y:80},{x:650,y:300},{x:875,y:350},{x:1330,y:900}]){
  const route=findPath({x:768,y:650},target);assert.ok(route.length>0);
  for(const p of route){assert.ok(p.y>=COURTYARD_TOP);assert.ok(walkable(p.x,p.y))}
 }
});
test('paths stay on the garden paths and avoid decorative outer areas',()=>{for(const target of [{x:420,y:500},{x:1100,y:700},{x:768,y:930}]){const route=findPath({x:768,y:650},target);assert.ok(route.length>0);for(const point of route)assert.ok(walkable(point.x,point.y),JSON.stringify(point));assert.ok(Math.hypot(route.at(-1).x-target.x,route.at(-1).y-target.y)<2)}});
test('clicking outside the garden resolves to a walkable point',()=>{for(const p of [{x:0,y:0},{x:1536,y:1000},{x:90,y:520},{x:1500,y:500}]){const result=nearestPoint(p);assert.ok(walkable(result.x,result.y))}});
test('expanded garden supports movement into the second gathering area',()=>{const route=findPath({x:768,y:800},{x:1000,y:1400},2048);assert.ok(route.length>0);for(const point of route)assert.ok(walkable(point.x,point.y,2048));assert.equal(route.at(-1).y,1400)});
test('expanded courtyard furniture leaves connected paths with no chair crossings',()=>{
 for(const target of [{x:410,y:1950},{x:1120,y:1950},{x:470,y:3000},{x:1100,y:3000}]){
  let previous={x:768,y:650};const route=findPath(previous,target,3072);assert.ok(route.length);assert.deepEqual(route.at(-1),target);
  for(const point of route){const samples=Math.ceil(Math.hypot(point.x-previous.x,point.y-previous.y));for(let i=0;i<=samples;i++){const t=i/Math.max(1,samples);assert.ok(walkable(previous.x+(point.x-previous.x)*t,previous.y+(point.y-previous.y)*t,3072))}previous=point}
 }
});
test('rounded boundary cells do not make reachable destinations unreachable',()=>{for(let x=0;x<=1536;x+=96)for(let y=0;y<=1024;y+=64){const route=findPath({x:768,y:650},{x,y});assert.ok(route.length>0,`empty path for ${x},${y}`);for(const point of route)assert.ok(walkable(point.x,point.y))}});
