'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('dist-marketing'),studio=path.resolve('server-ui'),port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.avif':'image/avif','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 let base=root;
 if(name==='/studio'||name==='/studio/'||name==='/auth/callback'){base=studio;name='/index.html';}
 if(['/app.js','/style.css','/tokens.css','/hash-worker.js'].includes(name))base=studio;
 let file=path.resolve(base,'.'+name);if(file!==base&&!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404,{'Content-Type':'text/plain'}).end('Page unavailable');return;}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Vistralo marketing review: http://127.0.0.1:${port}`));
