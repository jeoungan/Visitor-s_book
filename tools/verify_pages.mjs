import path from 'node:path';
import {fileURLToPath} from 'node:url';

function check(condition,message){if(!condition)throw new Error(message)}

export async function verifyPages(pageUrl,{revision=process.env.GITHUB_SHA,fetchImpl=fetch}={}){
 const base=new URL(pageUrl.endsWith('/')?pageUrl:`${pageUrl}/`);
 async function response(relative){
  const url=new URL(relative,base);url.searchParams.set('deployment-check',revision||Date.now());
  const res=await fetchImpl(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  check(res.ok,`${url.pathname} returned HTTP ${res.status}`);
  return res;
 }
 const info=await (await response('build-info.json')).json();
 check(info.application==='gangjeong-wedding-garden','The published artifact is not the wedding garden application.');
 check(info.storage==='local','Pages must declare its browser storage mode.');
 if(revision)check(info.revision===revision,`Pages is still serving ${info.revision}; expected ${revision}.`);
 const entrypoints=['','guestbook/'];
 for(const entry of entrypoints){
  const html=await (await response(entry)).text();
  check(/<canvas\b[^>]*\bid=["']garden["']/.test(html),`${entry||'/'} shows documentation instead of the app canvas.`);
  check(/<meta\b[^>]*name=["']garden-storage["'][^>]*content=["']local["']/.test(html),`${entry||'/'} is missing the Pages storage mode.`);
  const appSrc=html.match(/<script\b[^>]*src=["']([^"']+)["']/)?.[1];
  check(appSrc&&new URL(appSrc,base).pathname===`${base.pathname}app.js`,`${entry||'/'} points its app script outside the Pages base path.`);
 }
 for(const module of ['app.js','browser-storage.js','garden.js','avatar.js']){
  const res=await response(module),text=await res.text();
  check(!/text\/html/i.test(res.headers.get('content-type')||'')&&!/^\s*</.test(text),`${module} returned HTML instead of JavaScript.`);
  check(text.length>100,`${module} is unexpectedly empty.`);
  check(!/["'`]\/assets\//.test(text),`${module} still requests assets outside the repository base path.`);
 }
 const css=await (await response('style.css')).text();
 check(css.includes('.garden-frame'),'The published stylesheet is not the wedding garden stylesheet.');
 const manifest=await (await response('assets/poses-v2/manifest.json')).json();
 check(manifest.heads?.length===16&&manifest.actions?.walk?.length===16,'The published pose manifest is incomplete.');
 for(const asset of ['assets/eunpyeong-madang.png','assets/eunpyeong-couple-lace/sheet-transparent.png','assets/reception-table/sheet-transparent.png','assets/bodies/body-1.png','assets/heads/head-16.png','assets/accessories/accessory-16.png',...['wave','dance','clap','walk','heads'].flatMap(name=>[`assets/poses-v2/${name}.png`,`assets/poses-v2/${name}-skin.png`])]){
  const bytes=new Uint8Array(await (await response(asset)).arrayBuffer());
  check(Buffer.from(bytes.subarray(0,8)).toString('hex')==='89504e470d0a1a0a',`${asset} did not return a PNG image.`);
 }
 return{url:base.href,revision:info.revision,entrypoints:entrypoints.length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const pageUrl=process.argv[2];
 if(!pageUrl)throw new Error('Usage: node tools/verify_pages.mjs https://owner.github.io/repository/');
 let lastError;
 for(let attempt=1;attempt<=6;attempt++){
  try{const result=await verifyPages(pageUrl);console.log(`Verified live Pages app, both entry points, JavaScript, styles and images: ${result.url} (${result.revision})`);lastError=null;break}
  catch(error){lastError=error;console.warn(`Pages verification ${attempt}/6: ${error.message}`);if(attempt<6)await new Promise(resolve=>setTimeout(resolve,10000))}
 }
 if(lastError)throw lastError;
}
