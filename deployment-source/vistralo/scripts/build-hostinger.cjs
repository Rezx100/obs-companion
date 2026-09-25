'use strict';
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// Produce only public assets for a dedicated Hostinger PHP/HTML document root.
require('esbuild').buildSync({ entryPoints: ['server-ui/hash-worker.source.js'], bundle: true, minify: true, outfile: 'server-ui/hash-worker.js' });
execFileSync(process.execPath, ['scripts/build-cloud.cjs'], { stdio: 'inherit' });
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const headers = config.headers.flatMap(rule => rule.headers);
const lines = [
  'Options -Indexes -MultiViews',
  'DirectoryIndex index.html',
  '<IfModule mod_headers.c>',
  ...headers.map(({ key, value }) => `Header always set ${key} "${value.replace(/"/g, '\\"')}"`),
  'Header always set Cache-Control "no-cache"',
  '</IfModule>',
  '<IfModule mod_rewrite.c>',
  'RewriteEngine On',
  'RewriteRule ^auth/callback/?$ /index.html [L]',
  '</IfModule>',
  '<FilesMatch "^\\.">',
  'Require all denied',
  '</FilesMatch>',
  '',
];
fs.writeFileSync('dist-web/.htaccess', lines.join('\n'));
console.log('Hostinger static frontend ready in dist-web. Enable HTTPS in hPanel before use.');
