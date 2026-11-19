import assert from 'node:assert/strict';import http from 'node:http';import {spawn} from 'node:child_process';
let retries=0,redirected=0;const server=http.createServer((req,res)=>{
 if(req.url==='/slow-package'){res.writeHead(200,{'Content-Type':'application/zip','Content-Length':131072});let n=0;const timer=setInterval(()=>{res.write(Buffer.alloc(8192,'x'));if(++n===16){clearInterval(timer);res.end();}},600);res.on('close',()=>clearInterval(timer));}
 else if(req.url==='/slow-json'){const timer=setTimeout(()=>res.end('{"ok":true}'),9500);res.on('close',()=>clearTimeout(timer));}
 else if(req.url==='/partial'||req.url==='/retry'&&retries++===0){res.writeHead(200,{'Content-Length':10000});res.write('incomplete');setTimeout(()=>res.destroy(),100);}
 else if(req.url==='/oversize')res.end('x'.repeat(128));
 else if(req.url==='/error'){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"Synthetic upstream failure","details":{"code":"synthetic_upstream"}}');}
 else if(req.url==='/redirect'){res.writeHead(302,{Location:'/forbidden-target'});res.end();}
 else if(req.url==='/forbidden-target'){redirected++;res.end('forbidden');}
 else if(req.url==='/stall'){res.writeHead(200,{'Content-Length':10000});res.write('x');}
 else res.end('ok!');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{await new Promise((resolve,reject)=>{const child=spawn(process.env.BYPCMS_TEST_PHP||'php',['tests/license-http.integration.php','http://127.0.0.1:'+server.address().port],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Transport integration failed: '+code)));});assert.equal(redirected,0,'redirect never followed');console.log('PASS verified transport slow download, JSON timeout, partial cleanup, size limit, stall and retry');}
finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
