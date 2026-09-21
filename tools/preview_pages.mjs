import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const metadata=JSON.parse(await readFile(path.join(root,'build-info.json'),'utf8'));
const base=metadata.basePath,port=Number(process.env.PAGES_PREVIEW_PORT||4190);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
  const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
  if(!pathname.startsWith(base)){res.writeHead(404).end();return}
  const relative=pathname.slice(base.length),file=path.resolve(root,relative.endsWith('/')||!relative?`${relative}index.html`:relative);
  if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(404).end();return}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404).end()}
});
server.listen(port,'127.0.0.1',()=>console.log(`Pages artifact preview: http://127.0.0.1:${port}${base}`));
process.stdin.setEncoding('utf8');process.stdin.on('data',text=>{if(text.trim()==='close')server.close(()=>process.exit(0))});
