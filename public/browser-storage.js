import {selectedAccessories} from './accessories.js?v=20260921-pages1';
import {ACTION_IDS,normalizeAction} from './avatar-state.js?v=20260921-pages1';
import {gardenHeight,slotPosition} from './world.js?v=20260921-pages1';
import {nearestPoint} from './navigation.js?v=20260921-pages1';

export const BROWSER_STORAGE_KEY='visitor-s-book-garden-browser-v1';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const copy=value=>JSON.parse(JSON.stringify(value));

function avatar(value={}){
 if(!object(value))fail('캐릭터 정보를 확인해 주세요.');
 const integer=(key,max)=>Number.isInteger(value[key])&&value[key]>=0&&value[key]<=max?value[key]:0;
 const color=(key,fallback)=>typeof value[key]==='string'&&/^#[0-9a-fA-F]{6}$/.test(value[key])?value[key]:fallback;
 const accessories=selectedAccessories(value);
 return{outfit:integer('outfit',15),hair:integer('hair',15),skin:integer('skin',5),hairColor:color('hairColor','#352b2a'),outfitColor:color('outfitColor','#344863'),recolor:!!value.recolor,accessory:accessories[0]??0,accessories,action:normalizeAction(value.action)};
}
function profile(input){
 if(!object(input))fail('올바른 요청이 아니에요.');
 if(typeof input.name!=='string'||!input.name.trim()||[...input.name.trim()].length>20)fail('이름은 1~20자로 적어 주세요.');
 if(typeof input.message!=='string'||!input.message.trim()||[...input.message.trim()].length>120)fail('축하 메시지는 1~120자로 적어 주세요.');
 if(!['groom','bride','both'].includes(input.side))fail('어느 쪽 손님인지 골라 주세요.');
 if(input.consent!==true)fail('이 브라우저에 이름, 캐릭터와 메시지를 저장하는 데 동의해 주세요.');
 return{name:input.name.trim(),message:input.message.trim(),side:input.side,avatar:avatar(input.avatar)};
}
function body(options){
 if(typeof options.body!=='string')fail('올바른 요청이 아니에요.');
 if(new TextEncoder().encode(options.body).length>20000)fail('요청이 너무 커요.',413);
 try{return JSON.parse(options.body)}catch{fail('올바른 요청이 아니에요.')}
}
function header(headers,name){
 if(typeof headers?.get==='function')return headers.get(name);
 const entries=Array.isArray(headers)?headers:Object.entries(headers||{});
 return entries.find(([key])=>key.toLowerCase()===name.toLowerCase())?.[1];
}
function acceptMotion(state,channel,input){
 if(input.clientId===undefined&&input.version===undefined)return true;
 if(typeof input.clientId!=='string'||!/^[a-f0-9-]{36}$/.test(input.clientId)||!Number.isSafeInteger(input.version)||input.version<1)fail('요청 순서 정보를 확인해 주세요.');
 const previous=state.motionVersions.find(item=>item.clientId===input.clientId&&item.channel===channel);
 if(previous&&previous.version>=input.version)return false;
 if(previous)previous.version=input.version;
 else state.motionVersions.push({clientId:input.clientId,channel,version:input.version});
 return true;
}

// Pages has no shared database: one browser profile owns one locally stored guest.
// All guest data, retry receipts and motion versions commit in one setItem call.
export function createBrowserStorage({storage=()=>globalThis.localStorage,key=BROWSER_STORAGE_KEY,now=()=>new Date().toISOString(),randomId=()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)),byte=>byte.toString(16).padStart(2,'0')).join(''),locks=globalThis.navigator?.locks}={}){
 function access(){
  try{const value=typeof storage==='function'?storage():storage;if(!value||typeof value.getItem!=='function'||typeof value.setItem!=='function')throw new Error();return value}
  catch{fail('브라우저 저장소를 사용할 수 없어요. 이 사이트의 저장소 사용을 허용한 뒤 다시 시도해 주세요.',503)}
 }
 function read(store){
  let raw;try{raw=store.getItem(key)}catch{fail('이 브라우저에 저장된 방명록을 읽을 수 없어요. 저장소 설정을 확인해 주세요.',503)}
  if(raw===null)return{version:1,guest:null,requests:[],motionVersions:[]};
  try{
   const state=JSON.parse(raw);
   if(!object(state)||state.version!==1||!Array.isArray(state.requests)||!Array.isArray(state.motionVersions))throw new Error();
   if(state.guest!==null){
    const guest=state.guest;
    if(!object(guest)||!/^[a-f0-9]{24}$/.test(guest.id)||!Number.isFinite(guest.x)||!Number.isFinite(guest.y)||guest.slot!==0||typeof guest.createdAt!=='string'||typeof guest.updatedAt!=='string')throw new Error();
    state.guest={...guest,...profile({...guest,consent:true}),isMine:true};
   }
   if(state.requests.some(item=>!object(item)||typeof item.key!=='string'||typeof item.payload!=='string'||!/^[a-f0-9]{24}$/.test(item.guestId)))throw new Error();
   if(state.motionVersions.some(item=>!object(item)||typeof item.clientId!=='string'||!['position','action'].includes(item.channel)||!Number.isSafeInteger(item.version)||item.version<1))throw new Error();
   return state;
  }catch{fail('이 브라우저의 방명록 저장 내용을 읽을 수 없어요. 기존 내용은 덮어쓰지 않았어요.',503)}
 }
 function write(store,state){
  try{store.setItem(key,JSON.stringify(state))}
  catch(error){
   if(error?.name==='QuotaExceededError'||error?.code===22)fail('브라우저 저장 공간이 부족해 저장하지 못했어요. 공간을 확보한 뒤 다시 시도해 주세요.',507);
   fail('이 브라우저에 저장하지 못했어요. 저장소 사용을 허용한 뒤 다시 시도해 주세요.',503);
  }
 }
 function request(path,options){
  const method=(options.method||'GET').toUpperCase();
  if(path==='/api/config'&&method==='GET')return{title:'강정이네 웨딩 가든',invitationUrl:null,photoMode:'local-palette',sharedStorage:false,storageMode:'browser'};
  const store=access(),state=read(store);
  if(path==='/api/guests'&&method==='GET'){
   const guests=state.guest?[copy(state.guest)]:[];
   return{guests,total:guests.length,worldHeight:gardenHeight(guests)};
  }
  if(path==='/api/guests'&&method==='POST'){
   const input=profile(body(options)),requestKey=header(options.headers,'Idempotency-Key');
   if(typeof requestKey!=='string'||requestKey.length<8||requestKey.length>128)fail('등록 요청 번호가 필요해요.');
   const payload=JSON.stringify(input),previous=state.requests.find(item=>item.key===requestKey);
   if(previous){
    if(previous.payload!==payload)fail('요청 내용이 달라졌어요. 다시 시도해 주세요.',409);
    if(state.guest?.id!==previous.guestId)fail('이미 삭제한 메시지예요.',410);
    return{guest:copy(state.guest)};
   }
   if(state.guest)fail('이미 남긴 메시지가 있어요. 내 캐릭터에서 수정해 주세요.',409);
   const id=randomId(),timestamp=now();
   if(typeof id!=='string'||!/^[a-f0-9]{24}$/.test(id)||state.requests.some(item=>item.guestId===id))fail('캐릭터 번호를 만들지 못했어요. 다시 시도해 주세요.',503);
   state.guest={id,...input,...slotPosition(0),slot:0,createdAt:timestamp,updatedAt:timestamp,isMine:true};
   state.requests.push({key:requestKey,payload,guestId:id});
   write(store,state);return{guest:copy(state.guest)};
  }
  const match=path.match(/^\/api\/guests\/([a-f0-9]{24})(\/(?:position|action))?$/);
  if(match){
   if(state.guest?.id!==match[1]){
    if(method==='DELETE'&&!match[2])return{ok:true};
    fail('메시지를 찾을 수 없어요.',404);
   }
   if(method==='DELETE'&&!match[2]){
    state.guest=null;state.motionVersions=[];write(store,state);return{ok:true};
   }
   if(method==='PATCH'){
    const input=body(options),guest=state.guest;
    if(match[2]==='/position'){
     if(!object(input)||!Number.isFinite(input.x)||!Number.isFinite(input.y))fail('올바르지 않은 위치예요.');
     if(!acceptMotion(state,'position',input))return{ok:true,applied:false};
     Object.assign(guest,nearestPoint(input,gardenHeight([guest])));
     write(store,state);return{ok:true,applied:true};
    }
    if(match[2]==='/action'){
     if(!object(input)||!ACTION_IDS.includes(input.action))fail('동작을 다시 골라 주세요.');
     if(!acceptMotion(state,'action',input))return{guest:copy(guest),applied:false};
     guest.avatar.action=input.action;guest.updatedAt=now();
    }else{
     const update=profile(input);
     if(!acceptMotion(state,'action',input))update.avatar.action=guest.avatar.action;
     Object.assign(guest,update,{updatedAt:now()});
    }
    write(store,state);return{guest:copy(guest)};
   }
  }
  fail('요청한 기능을 찾을 수 없어요.',404);
 }
 return async(path,options={})=>{
  // Web Locks serializes same-origin tabs; without it, each transaction is still
  // synchronous and never yields between reading and persisting its snapshot.
  if(locks?.request)return locks.request(key,{mode:'exclusive'},()=>request(path,options));
  return request(path,options);
 };
}
