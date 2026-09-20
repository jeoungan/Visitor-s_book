// Shared by saved data, the editor, and the renderer.
export const ACTION_IDS=['idle','wave','dance','clap'];
export const normalizeAction=value=>ACTION_IDS.includes(value)?value:'idle';
export function movementFacing(dx,dy,previous='front'){
 if(Math.hypot(dx,dy)<.001)return 'front';
 // A small dead band keeps diagonal routes from flickering between two views.
 const horizontal=Math.abs(dx),vertical=Math.abs(dy);
 if(horizontal>vertical*1.12)return dx<0?'left':'right';
 if(vertical>horizontal*1.12)return dy<0?'back':'front';
 if(previous==='left'&&dx<0||previous==='right'&&dx>0)return previous;
 if(previous==='back'&&dy<0||previous==='front'&&dy>0)return previous;
 return horizontal>=vertical?(dx<0?'left':'right'):(dy<0?'back':'front');
}
export function poseFor(avatar,moving=false,facing='front',time=0,gait=0,reduced=false){
 const direction=moving&&['left','right','back'].includes(facing)?facing:'front';
 if(moving)return{family:'walk',direction,frame:reduced?0:Math.floor(Math.abs(gait)/Math.PI)%2};
 const action=normalizeAction(avatar?.action);
 return{family:['wave','dance','clap'].includes(action)?action:'idle',direction:'front',frame:reduced?0:Math.floor(time*(action==='clap'?5:action==='dance'?4:5))%4};
}
