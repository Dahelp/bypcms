// Disposable loopback provider and TLS SMTP sink. Never used by deployed code.
import http from 'node:http';
import tls from 'node:tls';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const directory=process.argv[2];
if(!directory)throw new Error('Provide disposable certificate directory');
const payments=new Map(),operations=new Map(),messages=[],refunds=new Map(),refundOps=new Map();
let next='normal',mailMode='accept',posts=0,test=true,refundNext='succeeded',refundPosts=0;
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
http.createServer(async(req,res)=>{
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000){res.destroy();return;}}
 const url=new URL(req.url,'http://127.0.0.1:8049');
 if(url.pathname==='/control'){
  if(req.method==='POST'){const data=JSON.parse(raw);if(typeof data.test==='boolean')test=data.test;if(data.next)next=data.next;if(data.refundNext)refundNext=data.refundNext;if(data.id&&refunds.has(data.id))Object.assign(refunds.get(data.id),data.patch);if(data.mail)mailMode=data.mail;if(data.id&&payments.has(data.id))Object.assign(payments.get(data.id),data.patch);}
  return json(res,{posts,refundPosts,payments:[...payments.values()],refunds:[...refunds.values()],messages});
 }
 if(url.pathname.startsWith('/pay/')){
  const payment=payments.get(url.pathname.slice(5));if(!payment)return json(res,{},404);
  if(req.method==='POST'){if(payment.status==='pending'){payment.status=new URLSearchParams(raw).get('action')==='cancel'?'canceled':'succeeded';payment.paid=payment.status==='succeeded';}res.writeHead(303,{Location:payment.return_url});res.end();return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Изолированная оплата</title><main style="max-width:500px;margin:40px auto;font:18px system-ui"><h1>Тестовая ЮKassa</h1><p>Локальный стенд. Деньги не списываются.</p><p>'+payment.amount.value+' RUB</p><form method="post"><button style="padding:16px">Подтвердить тестовую оплату</button></form><form method="post"><input type="hidden" name="action" value="cancel"><button style="padding:16px">Отменить тестовый платёж</button></form><a href="'+payment.return_url+'">Вернуться без оплаты</a></main>');return;
 }
 if(req.headers.authorization!=='Basic '+Buffer.from('12345:qa-payment-secret').toString('base64'))return json(res,{type:'error'},401);
 if(url.pathname==='/v3/refunds'&&req.method==='POST'){
  refundPosts++;const key=req.headers['idempotence-key'];if(refundOps.has(key))return json(res,refunds.get(refundOps.get(key)));
  const payload=JSON.parse(raw),payment=payments.get(payload.payment_id);if(!payment||payment.status!=='succeeded')return json(res,{},400);
  const behavior=refundNext;refundNext='succeeded';if(behavior==='reject')return json(res,{},400);
  const id=randomUUID(),value={id,payment_id:payload.payment_id,amount:payload.amount,status:['pending','canceled'].includes(behavior)?behavior:'succeeded',metadata:payload.metadata||{}};
  refunds.set(id,value);refundOps.set(key,id);if(behavior==='drop'){req.socket.destroy();return;}return json(res,value);
 }
 if(url.pathname==='/v3/refunds'&&req.method==='GET')return json(res,{type:'list',items:[...refunds.values()].filter(r=>r.payment_id===url.searchParams.get('payment_id'))});
 if(url.pathname.startsWith('/v3/refunds/')){const r=refunds.get(url.pathname.slice('/v3/refunds/'.length));return r?json(res,r):json(res,{},404);}
 if(url.pathname==='/v3/payments'&&req.method==='GET')return json(res,{type:'list',items:[...payments.values()].slice(-10)});
 if(url.pathname==='/v3/payments'&&req.method==='POST'){
  posts++;const key=req.headers['idempotence-key'];if(!/^[a-f0-9]{32}$/.test(key||''))return json(res,{},400);
  const payload=JSON.parse(raw);if(operations.has(key))return json(res,payments.get(operations.get(key)));
  if(next==='reject'){next='normal';return json(res,{},400);}
  const behavior=next;next='normal';const id=randomUUID();
  const payment={id,status:'pending',paid:false,test,recipient:{account_id:'12345'},amount:payload.amount,metadata:payload.metadata,return_url:payload.confirmation.return_url,confirmation:{type:'redirect',confirmation_url:'http://127.0.0.1:8049/pay/'+id}};
  payments.set(id,payment);operations.set(key,id);
  if(behavior==='drop'){req.socket.destroy();return;}
  if(behavior==='wrong-amount')payment.amount={value:'1.00',currency:'RUB'};
  return json(res,payment);
 }
 const id=url.pathname.slice('/v3/payments/'.length);return payments.has(id)?json(res,payments.get(id)):json(res,{},404);
}).listen(8049,'127.0.0.1',()=>process.stdout.write('QA provider 8049 ready\n'));
tls.createServer({key:readFileSync(directory+'/smtp-key.pem'),cert:readFileSync(directory+'/smtp-cert.pem')},socket=>{
 socket.setEncoding('utf8');socket.write('220 qa.local ESMTP\r\n');let buffer='',data=false,body='',login=0;
 socket.on('error',()=>{});
 socket.on('data',chunk=>{buffer+=chunk;let split;while((split=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,split);buffer=buffer.slice(split+2);
  if(data){if(line!=='.'){body+=line+'\r\n';continue;}data=false;messages.push(body);body='';if(mailMode==='drop'){socket.destroy();return;}socket.write('250 2.0.0 queued\r\n');continue;}
  if(login){if(login===1){login=2;socket.write('334 UGFzc3dvcmQ6\r\n');}else{login=0;socket.write('235 authenticated\r\n');}continue;}
  if(/^EHLO/.test(line))socket.write('250-qa.local\r\n250 AUTH PLAIN LOGIN\r\n');
  else if(/^AUTH PLAIN/.test(line)){if(line==='AUTH PLAIN'){login=3;socket.write('334 \r\n');}else socket.write('235 authenticated\r\n');}
  else if(/^AUTH LOGIN/.test(line)){login=1;socket.write('334 VXNlcm5hbWU6\r\n');}
  else if(/^MAIL FROM/.test(line))socket.write('250 sender ok\r\n');
  else if(/^RCPT TO/.test(line))socket.write(mailMode==='reject'?'550 rejected\r\n':'250 recipient ok\r\n');
  else if(line==='DATA'){data=true;socket.write('354 send data\r\n');}
  else if(line==='QUIT'){socket.end('221 bye\r\n');}
  else socket.write('250 ok\r\n');
 }});
}).listen(8465,'127.0.0.1',()=>process.stdout.write('QA TLS SMTP 8465 ready\n'));
