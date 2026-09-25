'use strict';
const http = require('node:http');
const net = require('node:net');
const dns = require('node:dns/promises');
const {assert} = require('./core.cjs');
function publicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===100&&b>=64&&b<=127) || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168 || b===0 || (b===88&&c===99))) || (a===198&&(b===18||b===19||(b===51&&c===100))) || (a===203&&b===0&&c===113));
  }
  // Only globally routed IPv6; exclude documentation and special-purpose ranges.
  if(net.isIP(address)===6)return /^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:(?:0*:|0?db8:|[01][0-9a-f]{0,2}:)/i.test(address)&&!/^2002:/i.test(address);
  return false;
}
async function destination(host, port, lookup=dns.lookup) {
  assert([80,443].includes(port), 'Only public web ports are allowed');
  const addresses=await lookup(host.replace(/^\[|\]$/g,''),{all:true});
  assert(addresses.length && addresses.every(a=>publicAddress(a.address)), 'Private or reserved network destination blocked');
  return addresses[0];
}
function createProxy() {
  const proxy=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url);assert(url.protocol==='http:'&&!url.username&&!url.password,'Invalid proxy URL');
      const port=Number(url.port)||80,address=await destination(url.hostname,port);
      const headers={...req.headers,host:url.host};delete headers['proxy-authorization'];delete headers['proxy-connection'];
      const upstream=http.request({hostname:address.address,family:address.family,port,path:url.pathname+url.search,method:req.method,headers,timeout:30000},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
      upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});upstream.on('timeout',()=>upstream.destroy());req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
    }catch{res.writeHead(403);res.end('Destination blocked');}
  });
  proxy.on('connect',async(req,socket,head)=>{
    try {
      const url=new URL('https://'+req.url),port=Number(url.port)||443,address=await destination(url.hostname,port);
      const upstream=net.connect({host:address.address,port,family:address.family});
      upstream.setTimeout(120000,()=>upstream.destroy());socket.setTimeout(120000,()=>socket.destroy());
      upstream.on('connect',()=>{socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);upstream.pipe(socket);socket.pipe(upstream);});
      upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());upstream.on('close',()=>socket.destroy());
    }catch{socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}
  });
  return proxy;
}
if(require.main===module)createProxy().listen(3128,'127.0.0.1');
module.exports={publicAddress,destination,createProxy};
