'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {build}=require('./build-marketing.cjs');
(async()=>{
 // Fail before changing the existing Hostinger output unless real evidence passes.
 await build({release:true});
 execFileSync(process.execPath,['scripts/build-hostinger.cjs'],{stdio:'inherit'});
 fs.mkdirSync('dist-web/studio',{recursive:true});
 fs.renameSync('dist-web/index.html','dist-web/studio/index.html');
 fs.cpSync('dist-marketing','dist-web',{recursive:true});
 let rules=fs.readFileSync('dist-web/.htaccess','utf8')
  .replace('RewriteRule ^auth/callback/?$ /index.html [L]','RewriteRule ^auth/callback/?$ /studio/index.html [L]')
  .replace('Header always set Cache-Control "no-cache"','Header always set Cache-Control "no-cache"\n<FilesMatch "^(story|style)-[a-f0-9]{12}\\.(js|css)$">\nHeader always set Cache-Control "public, max-age=31536000, immutable"\n</FilesMatch>')
  .replace("form-action 'self'","form-action 'self'; frame-src 'self'");
 fs.writeFileSync('dist-web/.htaccess',rules);
 // The owned reference may be embedded only by this origin, never other sites.
 fs.writeFileSync('dist-web/reference/fernhill/.htaccess','<IfModule mod_headers.c>\nHeader always set X-Frame-Options "SAMEORIGIN"\nHeader always set Content-Security-Policy "default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; font-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'self\'"\n</IfModule>\n');
 console.log('Combined Hostinger release in dist-web: marketing at /, existing workspace at /studio/.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
