import {cp, mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const textExtensions=new Set(['.html','.css','.js','.mjs','.svg']);

export function normalizeBasePath(value='/Visitor-s_book/'){
 const base=`/${String(value).replace(/^\/+|\/+$/g,'')}/`.replace(/^\/\/$/,'/');
 if(!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(base)||base.split('/').some(part=>part==='.'||part==='..'))throw new Error('Pages base path must be an absolute URL path, for example /Visitor-s_book/.');
 return base;
}

// Only public runtime files belong in the Pages artifact. Image generation inputs
// and review outputs stay in the repository, without being published with the app.
export function isRuntimePublicFile(relative){
 const parts=relative.replaceAll('\\','/').split('/'),name=parts.at(-1);
 if(parts.some(part=>part.startsWith('.')||['raw','processed','source','sources','pipeline-meta','prompts'].includes(part)))return false;
 if(/^(?:readme(?:\.|$)|raw[-_.]|prompt[-_.]|single-\d+\.|animation\.gif$)/i.test(name))return false;
 if(/(?:provenance|alignment-meta|pipeline-meta)\.json$/i.test(name))return false;
 return true;
}

export function rewritePublicUrls(source,basePath){
 const base=normalizeBasePath(basePath);
 // API route strings must remain /api/* for the browser-storage adapter. Match
 // only runtime asset/entry-point URLs, including JS template literals and CSS.
 return source
  .replace(/(["'`])\/(assets\/|guestbook(?:\/|(?=["'`]))|(?:app\.js|style\.css|favicon\.svg)(?=[?"'`]))/g,(_,quote,relative)=>`${quote}${base}${relative}`)
  .replace(/(url\(\s*)\/(assets\/)/g,(_,prefix,relative)=>`${prefix}${base}${relative}`);
}

async function filesUnder(directory){
 const entries=await readdir(directory,{withFileTypes:true});
 const files=await Promise.all(entries.map(async entry=>{
  const full=path.join(directory,entry.name);
  if(entry.isSymbolicLink())throw new Error(`Symbolic links are not allowed in the Pages artifact: ${full}`);
  return entry.isDirectory()?filesUnder(full):[full];
 }));
 return files.flat();
}

export async function buildPages({rootDir=projectRoot,outDir,basePath=process.env.PAGES_BASE_PATH||'/Visitor-s_book/',revision=process.env.GITHUB_SHA||'local'}={}){
 const root=path.resolve(rootDir),source=path.join(root,'public'),output=path.resolve(outDir||path.join(root,'dist')),base=normalizeBasePath(basePath);
 const outputRelative=path.relative(root,output);
 if(!outputRelative||outputRelative==='..'||outputRelative.startsWith(`..${path.sep}`)||path.isAbsolute(outputRelative)||['public','.git'].includes(outputRelative.split(path.sep)[0]))throw new Error('Pages output must be a separate directory inside the project, outside public and .git.');
 const sourceHtml=await readFile(path.join(source,'index.html'),'utf8');
 if(!/<canvas\b[^>]*\bid=["']garden["']/.test(sourceHtml)||!/<script\b[^>]*\btype=["']module["']/.test(sourceHtml))throw new Error('Refusing to publish: public/index.html is not the wedding garden application.');
 // The resolved output is checked above before removing any previous build.
 await rm(output,{recursive:true,force:true});
 await mkdir(output,{recursive:true});
 await cp(source,output,{recursive:true,filter:entry=>entry===source||isRuntimePublicFile(path.relative(source,entry))});
 for(const file of await filesUnder(output)){
  if(!textExtensions.has(path.extname(file)))continue;
  const sourceText=await readFile(file,'utf8'),rewritten=rewritePublicUrls(sourceText,base);
  if(rewritten!==sourceText)await writeFile(file,rewritten);
 }
 let html=await readFile(path.join(output,'index.html'),'utf8');
 html=html.replace(/<meta\b[^>]*\bname=["']garden-storage["'][^>]*>/gi,'');
 html=html.replace('</head>','<meta name="garden-storage" content="local"></head>');
 await writeFile(path.join(output,'index.html'),html);
 await mkdir(path.join(output,'guestbook'),{recursive:true});
 await writeFile(path.join(output,'guestbook','index.html'),html);
 await writeFile(path.join(output,'.nojekyll'),'');
 const files=await filesUnder(output),sizes=await Promise.all(files.map(async file=>(await stat(file)).size));
 const metadata={application:'gangjeong-wedding-garden',storage:'local',basePath:base,revision,builtAt:new Date().toISOString(),files:files.length+1,bytes:sizes.reduce((a,b)=>a+b,0)};
 await writeFile(path.join(output,'build-info.json'),JSON.stringify(metadata,null,2)+'\n');
 return{output,...metadata};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await buildPages();
 console.log(`Built ${result.application}: ${result.files} files, ${(result.bytes/1024/1024).toFixed(1)} MiB, base ${result.basePath}, storage ${result.storage}.`);
 console.log(`Pages artifact: ${result.output}`);
}
