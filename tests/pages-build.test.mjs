import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPages,isRuntimePublicFile,normalizeBasePath,rewritePublicUrls} from '../tools/build_pages.mjs';
import {verifyPages} from '../tools/verify_pages.mjs';

const originalPublic=fileURLToPath(new URL('../public/',import.meta.url));
let fixture,result;
before(async()=>{
 fixture=await mkdtemp(path.join(os.tmpdir(),'garden-pages-test-'));
 const source=path.join(fixture,'public');
 await cp(originalPublic,source,{recursive:true,filter:entry=>entry===originalPublic.replace(/[\\/]$/,'')||isRuntimePublicFile(path.relative(originalPublic,entry))});
 // A repository README and image-generation files must never become the site.
 await writeFile(path.join(fixture,'README.md'),'# Project documentation, not the app');
 await writeFile(path.join(source,'README.md'),'# Internal asset documentation');
 await mkdir(path.join(source,'assets','poses-v2','raw'),{recursive:true});
 await writeFile(path.join(source,'assets','poses-v2','raw','source.png'),'private generation input');
 await writeFile(path.join(source,'assets','bodies','prompt-used.txt'),'generation prompt');
 await writeFile(path.join(source,'assets','bodies','raw-sheet.png'),'source sheet');
 result=await buildPages({rootDir:fixture,basePath:'/Visitor-s_book/',revision:'test-revision'});
});
after(async()=>{if(fixture)await rm(fixture,{recursive:true,force:true})});

test('Pages root and /guestbook/ publish the app canvas and module, never README documentation',async()=>{
 const rootHtml=await readFile(path.join(result.output,'index.html'),'utf8');
 assert.equal(await readFile(path.join(result.output,'guestbook','index.html'),'utf8'),rootHtml);
 assert.match(rootHtml,/<canvas\b[^>]*id="garden"/);
 assert.match(rootHtml,/<script type="module" src="\/Visitor-s_book\/app\.js\?/);
 assert.match(rootHtml,/<meta name="garden-storage" content="local">/);
 assert.match(rootHtml,/href="\/Visitor-s_book\/guestbook\/"/);
 assert.match(rootHtml,/href="\/Visitor-s_book\/style\.css\?/);
 assert.match(rootHtml,/href="\/Visitor-s_book\/favicon\.svg"/);
 assert.equal((rootHtml.match(/name="garden-storage"/g)||[]).length,1);
 const sourceHtml=await readFile(path.join(fixture,'public','index.html'),'utf8');
 assert.match(sourceHtml,/src="\/app\.js\?/,'server-mode source files stay unchanged');
 assert.doesNotMatch(sourceHtml,/name="garden-storage"/);
 for(const forbidden of ['README.md','server.mjs','docs','data','assets/poses-v2/raw','assets/bodies/raw-sheet.png','assets/bodies/prompt-used.txt'])await assert.rejects(stat(path.join(result.output,forbidden)),{code:'ENOENT'});
 assert.equal(await readFile(path.join(result.output,'.nojekyll'),'utf8'),'');
 const metadata=JSON.parse(await readFile(path.join(result.output,'build-info.json'),'utf8'));
 assert.equal(metadata.application,'gangjeong-wedding-garden');
 assert.equal(metadata.basePath,'/Visitor-s_book/');
 assert.equal(metadata.storage,'local');
 assert.equal(metadata.revision,'test-revision');
});

test('nested Pages paths resolve every module and all selectable avatar/scene assets',async()=>{
 for(const filename of (await readdir(result.output)).filter(name=>name.endsWith('.js'))){
  const code=await readFile(path.join(result.output,filename),'utf8');
  assert.doesNotMatch(code,/["'`]\/assets\//,`${filename} must not bypass the repository prefix`);
  for(const [,specifier] of code.matchAll(/\b(?:from\s*|import\s*)["'](\.[^"']+)["']/g)){
   const imported=new URL(specifier,new URL(filename,'https://example.test/Visitor-s_book/'));
   assert.ok(imported.pathname.startsWith('/Visitor-s_book/'));
   assert.ok((await stat(path.join(result.output,imported.pathname.slice('/Visitor-s_book/'.length)))).isFile(),specifier);
  }
 }
 const avatar=await readFile(path.join(result.output,'avatar.js'),'utf8'),garden=await readFile(path.join(result.output,'garden.js'),'utf8');
 assert.match(avatar,/`\/Visitor-s_book\/assets\/bodies\/body-\$\{i\+1\}\.png`/);
 assert.match(garden,/'\/Visitor-s_book\/assets\/eunpyeong-madang\.png'/);
 const assets=['assets/eunpyeong-madang.png','assets/eunpyeong-couple-lace/sheet-transparent.png','assets/reception-table/sheet-transparent.png','assets/poses-v2/manifest.json'];
 for(let i=1;i<=16;i++)assets.push(`assets/bodies/body-${i}.png`,`assets/heads/head-${i}.png`);
 for(let i=2;i<=16;i++)assets.push(`assets/accessories/accessory-${i}.png`);
 for(const family of ['wave','dance','clap','walk','heads'])assets.push(`assets/poses-v2/${family}.png`,`assets/poses-v2/${family}-skin.png`);
 for(const asset of assets)assert.ok((await stat(path.join(result.output,asset))).size>0,asset);
 const app=await readFile(path.join(result.output,'app.js'),'utf8');
 assert.match(app,/'\/api\/guests'/,'API route identities must survive Pages asset rewriting');
 assert.doesNotMatch(app,/\/Visitor-s_book\/api\//);
});

test('asset URL rewriting preserves API routes, remote URLs and fragments',()=>{
 const source="fetch('/api/guests'); fetch(`/api/guests/${id}`); const image='/assets/map.png'; const pose=`/assets/poses/${name}.png`; const css='url(/assets/bg.png)'; const web='https://example.test/assets/x.png'; const hash='#guestbook';";
 const output=rewritePublicUrls(source,'/other-project/');
 assert.match(output,/fetch\('\/api\/guests'\)/);
 assert.match(output,/fetch\(`\/api\/guests\/\$\{id\}`\)/);
 assert.match(output,/'\/other-project\/assets\/map\.png'/);
 assert.match(output,/`\/other-project\/assets\/poses\/\$\{name\}\.png`/);
 assert.match(output,/url\(\/other-project\/assets\/bg\.png\)/);
 assert.match(output,/'https:\/\/example\.test\/assets\/x\.png'/);
 assert.match(output,/'#guestbook'/);
 assert.equal(rewritePublicUrls(source,'/'),source);
 for(const invalid of ['../oops','/foo/../oops/','https://example.test/','/a?b/'])assert.throws(()=>normalizeBasePath(invalid));
});

test('build refuses a documentation entrypoint and unsafe output locations',async()=>{
 const invalid=path.join(fixture,'invalid');await mkdir(path.join(invalid,'public'),{recursive:true});
 await writeFile(path.join(invalid,'public','index.html'),'<html><h1>README</h1></html>');
 await assert.rejects(buildPages({rootDir:invalid}),/not the wedding garden application/);
 for(const output of [fixture,path.join(fixture,'public'),path.join(fixture,'public','dist'),path.join(fixture,'.git','dist'),path.join(fixture,'..','outside-dist')])await assert.rejects(buildPages({rootDir:fixture,outDir:output}),/separate directory inside the project/);
});

test('HTTP deployment verifier detects README pages, stale releases and missing image assets',async()=>{
 let fault=null;
 const server=http.createServer(async(req,res)=>{
  try{
   const requested=new URL(req.url,'http://localhost').pathname;
   if(!requested.startsWith('/Visitor-s_book/')){res.writeHead(404).end();return}
   const relative=requested.slice('/Visitor-s_book/'.length)||'index.html';
   if(fault==='readme'&&relative==='index.html'){res.setHeader('Content-Type','text/html');res.end('<html><h1>Repository README</h1></html>');return}
   if(fault==='image'&&relative==='assets/eunpyeong-madang.png'){res.writeHead(404).end();return}
   const filename=relative.endsWith('/')?`${relative}index.html`:relative;
   const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'}[path.extname(filename)];
   if(mime)res.setHeader('Content-Type',mime);
   res.end(await readFile(path.join(result.output,filename)));
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/Visitor-s_book/`;
 try{
  await verifyPages(url,{revision:'test-revision'});
  await assert.rejects(verifyPages(url,{revision:'another-revision'}),/still serving/);
  fault='readme';await assert.rejects(verifyPages(url,{revision:'test-revision'}),/documentation instead of the app canvas/);
  fault='image';await assert.rejects(verifyPages(url,{revision:'test-revision'}),/returned HTTP 404/);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
