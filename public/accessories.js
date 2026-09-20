// A single choice per placement avoids stacking several glasses, bags or hair clips.
export const accessoryPlacement=id=>id>=1&&id<=3?'eyes':id>=4&&id<=7?'hair':id>=8&&id<=9?'ears':id>=10&&id<=13?'hand':id===14?'neck':id===15?'lapel':null;
export function selectedAccessories(avatar={}){
 const items=Array.isArray(avatar.accessories)?avatar.accessories:[avatar.accessory],placements=new Map();
 for(const id of items){if(Number.isInteger(id)&&accessoryPlacement(id))placements.set(accessoryPlacement(id),id)}
 return [...placements.values()].sort((a,b)=>a-b);
}
export function toggleAccessory(avatar,id){
 const current=selectedAccessories(avatar);
 const selected=id===0?[]:current.includes(id)?current.filter(n=>n!==id):[...current.filter(n=>accessoryPlacement(n)!==accessoryPlacement(id)),id].sort((a,b)=>a-b);
 return {...avatar,accessory:selected[0]??0,accessories:selected};
}
