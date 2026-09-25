'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {renderHome,renderPage,pages}=require('../marketing/render.cjs');
const {validateEvidence}=require('../marketing/evidence.cjs');
async function build({release=false,out='dist-marketing'}={}) {
 const m=JSON.parse(fs.readFileSync('marketing/story.json','utf8')),c=JSON.parse(fs.readFileSync('marketing/messages.json','utf8'));
 const status=validateEvidence(m,path.resolve('marketing/public'),{release});
 if(status.errors.length)throw Error('Marketing evidence gate failed:\n'+status.errors.join('\n'));
 if(release&&!status.ready)throw Error('Marketing story is not approved for release.');
 const result=await require('esbuild').build({entryPoints:['marketing/client.js'],bundle:true,minify:true,format:'esm',target:['es2022'],write:false,outfile:'story.js',legalComments:'external'});
 const js=result.outputFiles.find(f=>!f.path.endsWith('.LEGAL.txt')).contents;
 const css=Buffer.from(fs.readFileSync('web/styles/tokens.css','utf8')+'\n'+fs.readFileSync('marketing/styles/marketing.css','utf8'));
 const hash=x=>crypto.createHash('sha256').update(x).digest('hex').slice(0,12),assets={js:`/marketing-assets/story-${hash(js)}.js`,css:`/marketing-assets/style-${hash(css)}.css`};
 const gzip=zlib.gzipSync(js).length;if(gzip>150*1024)throw Error('Home JavaScript exceeds 150KB gzip.');
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'marketing-assets'),{recursive:true});
 for(const [name,bytes]of [[assets.js,js],[assets.css,css]])fs.writeFileSync(path.join(out,name),bytes);
 for(const file of result.outputFiles.filter(f=>f.path.endsWith('.LEGAL.txt')))fs.writeFileSync(path.join(out,'marketing-assets/THIRD-PARTY.txt'),file.contents);
 fs.cpSync('marketing/public',out,{recursive:true});
 for(const dir of ['brand','fonts'])fs.cpSync('server-ui/assets/'+dir,path.join(out,'assets',dir),{recursive:true});
 fs.copyFileSync('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',path.join(out,'assets/fonts/jetbrains-mono-latin-400-normal.woff2'));
 fs.copyFileSync('node_modules/@fontsource/jetbrains-mono/LICENSE',path.join(out,'assets/fonts/JETBRAINS-OFL.txt'));
 fs.mkdirSync(path.join(out,'reference/fernhill'),{recursive:true});fs.cpSync('marketing/reference',path.join(out,'reference/fernhill'),{recursive:true});
 fs.writeFileSync(path.join(out,'story.json'),JSON.stringify(m));
 const options={m,c,assets,release};fs.writeFileSync(path.join(out,'index.html'),renderHome(options));
 for(const page of Object.keys(pages)){fs.mkdirSync(path.join(out,page),{recursive:true});fs.writeFileSync(path.join(out,page,'index.html'),renderPage(page,options));}
 fs.writeFileSync(path.join(out,'robots.txt'),release?'User-agent: *\nAllow: /\n':'User-agent: *\nDisallow: /\n');
 fs.writeFileSync(path.join(out,'404.html'),renderPage('docs',options).replace('<title>','<title>Page unavailable — '));
 const report={ready:status.ready,release,jsGzipBytes:gzip,assets,enabledScenes:m.scenes.filter(s=>s.enabled).map(s=>s.id),warnings:status.warnings};
 fs.mkdirSync('evidence/marketing',{recursive:true});fs.writeFileSync('evidence/marketing/build.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));return report;
}
if(require.main===module)build({release:process.argv.includes('--release')}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={build};
