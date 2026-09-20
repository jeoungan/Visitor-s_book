export const TABLE_RADIUS_X=112,TABLE_RADIUS_Y=80;
export const TABLE_SPRITE={size:240,offsetY:155,depth:55};
export const TERRACE_TABLES=[
 {id:'table-1',x:410,y:580},
 {id:'table-2',x:1120,y:560},
 {id:'table-3',x:470,y:825},
 {id:'table-4',x:1100,y:815}
];
const tableTiles=new Map([[0,TERRACE_TABLES]]);
export function tablesForTile(tile=0){
 if(!tableTiles.has(tile))tableTiles.set(tile,TERRACE_TABLES.map(table=>({...table,id:`${table.id}-tile-${tile}`,y:table.y+tile*1024})));
 return tableTiles.get(tile);
}
export function tablesForHeight(height=1024){return Array.from({length:Math.max(1,Math.ceil(height/1024))},(_,tile)=>tablesForTile(tile)).flat()}
