'use strict';
const {assert}=require('./core.cjs');
function resolved(env,canonical,legacy,fallback){
 const hasNew=Object.hasOwn(env,canonical),hasOld=Object.hasOwn(env,legacy);
 if(hasOld)console.error(`${legacy} is deprecated${hasNew?' and ignored':''}; use ${canonical}`);
 return hasNew?env[canonical]:hasOld?env[legacy]:fallback;
}
function config(env=process.env){
 const token=resolved(env,'VISTRALO_TOKEN','COMPANION_TOKEN');
 assert(typeof token==='string'&&token.length>=32,'VISTRALO_TOKEN must have at least 32 characters');
 const origins=resolved(env,'VISTRALO_ORIGINS','COMPANION_ORIGINS','http://127.0.0.1:8787,http://localhost:8787');
 assert(typeof origins==='string'&&origins.length>0,'VISTRALO_ORIGINS is invalid');
 const list=origins.split(',');
 assert(list.every(o=>o===o.trim()&&/^https?:\/\/[^/]+$/.test(o)&&new URL(o).origin===o),'VISTRALO_ORIGINS must be comma-separated exact origins');
 return {token,origins:list};
}
module.exports={resolved,config};
