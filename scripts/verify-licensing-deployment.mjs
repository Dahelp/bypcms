// Read-only production smoke check: no real key is issued, renewed or activated.
const origin=process.env.BYPCMS_ORIGIN||'https://bypcms.ru';
const endpoints=[
 ['/api/index.php?action=status',undefined,200,'installed'],
 ['/api/index.php?action=license.status',undefined,401],
 ['/api/index.php?action=owner.license.key',{id:0},401],
 ['/api/index.php?action=licensing.challenge',{key:'BYP-DEPLOYMENT-CHECK-INVALID-KEY',installation_id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',site_url:'https://example.invalid',edition:'content'},403,'license_invalid'],
 ['/_core/LicensePolicy.php',undefined,403],
 ['/_storage/config.php',undefined,403],
];
for(const[path,body,expected,marker]of endpoints){
 const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(response.status!==expected)throw new Error(`${path}: expected ${expected}, received ${response.status}`);
 if(marker){const json=await response.json();if(marker==='installed'?json.installed!==true||json.database!=='connected':json.details?.code!==marker)throw new Error(`${path}: deployed API marker missing`);}
 else await response.arrayBuffer();
 console.log(`PASS ${path} → ${expected}`);
}
