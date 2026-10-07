const assert=require('node:assert/strict');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const {context,call,tables,cache,writes,frontend,setFault,isLocked}=require('./v600.test.cjs');
context.Math=Object.create(Math);
function randoms(...values){context.Math.random=()=>{assert.ok(values.length,'unexpected random draw');return values.shift();};}
const stones=vm.runInContext('ATTRIBUTE_STONES_V600',context),available=new Set(stones.map(s=>s.itemId));
assert.equal(vm.runInContext('HOURLY_STONE_DROP_RATE_V600',context),0.5);
for(const stone of stones){
  randoms(0.49999,0.85);const gift=call('hourlyPetGiftV600_','PET',{PET:stone.attribute},available);
  assert.equal(gift.itemId,stone.itemId);assert.equal(gift.qty,2);assert.equal(gift.title,stone.name);
  assert.equal(gift.content,'寵物帶回了 2 顆'+stone.name+'！可以用來強化技能傷害。');
}
for(const [r,qty] of [[0,1],[0.799999,1],[0.8,2],[0.899999,2],[0.9,3],[0.959999,3],[0.96,4],[0.989999,4],[0.99,5],[0.999999,5]]){
  randoms(0,r);assert.equal(call('hourlyPetGiftV600_','P',{P:'草'},available).qty,qty);
}
// Exact probability bucket coverage without flaky random sampling.
let counts=[0,0,0,0,0];for(let i=0;i<100;i++){randoms(0,(i+0.5)/100);counts[call('hourlyPetGiftV600_','P',{P:'草'},available).qty-1]++;}
assert.deepEqual(counts,[80,10,6,3,1]);
for(const [r,item] of [[0,'EXP010'],[0.6,'EXP030'],[0.82,'TRE001'],[0.94,'TRE002']]){
  randoms(0.5,r);assert.equal(call('hourlyPetGiftV600_','P',{P:'草'},available).itemId,item);
}
randoms(0);assert.equal(call('hourlyPetGiftV600_','P',{P:'未知'},available).itemId,'EXP010');
randoms(0);assert.equal(call('hourlyPetGiftV600_','P',{P:'草'},new Set()).itemId,'EXP010');
context.Math.random=()=>0; // generated mail = one matching stone
const students=tables.get('學生資料'),studentSnapshot=JSON.stringify(students.values);
const petsSnapshot=JSON.stringify(tables.get('學生寵物').values);
const hour=new Date();hour.setMinutes(0,0,0);
students.values[0].push('最後整點禮物');students.values[1].push(new Date(hour.getTime()-2*3600000));students.values[2].push(new Date(hour.getTime()-3600000));
const mail=tables.get('信箱'),mh=call('headerMap_',mail);
const originalHeaders=JSON.stringify(mail.values[0]);call('setupOrUpgradeV600');assert.equal(JSON.stringify(mail.values[0]),originalHeaders,'schema repeated upgrade idempotent');
call('generateHourlyGiftsFast_','50501');
assert.equal(mail.values.length,3);for(const row of mail.values.slice(1)){assert.equal(row[mh['附件ID']-1],'STONE_GRASS');assert.equal(row[mh['標題']-1],'草之石');}
call('generateHourlyGiftsFast_','50501');assert.equal(mail.values.length,3,'same hour no duplicate');
let failed=false;setFault((event,when)=>{if(!failed&&event.name==='學生資料'&&when==='before'){failed=true;throw Error('watermark failure');}});
assert.throws(()=>call('generateHourlyGiftsFast_','50502'),/watermark/);setFault(null);
assert.equal(mail.values.length,4);assert.equal(mail.values[3][mh['附件ID']-1],'STONE_FIRE');
call('generateHourlyGiftsFast_','50502');assert.equal(mail.values.length,4,'mail persisted but watermark failed: no duplicate');
const items=tables.get('學生道具'),ih=call('headerMap_',items);
const quantity=(id,item)=>Number(items.values.find((r,i)=>i>0&&r[ih['學號']-1]===id&&r[ih['道具ID']-1]===item)?.[ih['數量']-1]||0);
const grassBefore=quantity('50501','STONE_GRASS'),fireBefore=quantity('50502','STONE_FIRE');
const first=mail.values[1][mh['信件ID']-1];
const writeStart=writes.length;
setFault(event=>{if(event.name==='學生道具'||event.name==='信箱')assert.equal(isLocked(),true,'write transaction holds shared lock');});
call('claimMailFast','50501',first);call('claimMailFast','50501',first);call('claimMail','50501',first);
assert.equal(quantity('50501','STONE_GRASS'),grassBefore+1);
call('claimAllMailFast','50501');call('claimAllMailFast','50501');call('claimMailFast','50501',first);
setFault(null);
assert.equal(quantity('50501','STONE_GRASS'),grassBefore+2,'mixed single/all calls grant exactly once');
assert.equal(quantity('50502','STONE_FIRE'),fireBefore,'other student unchanged');
assert.ok(writes.slice(writeStart).filter(w=>w.name==='學生道具').every(w=>w.n===1&&w.m===1&&w.c===ih['數量']),'targeted quantity writes');
assert.throws(()=>call('claimMailFast','50502',first),/找不到信件/);
function makeMail(item='STONE_GRASS',qty=2,id='50501') {return call('createMail_',id,'PET001','測試','測試','道具',item,qty);}
const pending=makeMail(),before=quantity('50501','STONE_GRASS');failed=false;
setFault((event,when)=>{if(!failed&&event.name==='學生道具'&&when==='after'){failed=true;throw Error('response lost after credit');}});
assert.throws(()=>call('claimMailFast','50501',pending),/response lost/);setFault(null);
assert.equal(quantity('50501','STONE_GRASS'),before+2);
const token=call('createStudentSessionV600_','50501');
assert.equal(call('useAttributeStoneV600','50501','PET001','GEN-3','STONE_GRASS',randomUUID(),token).ok,false,'pending mail blocks stone consumption');
assert.throws(()=>call('adminGrantItemFast','test-only-password','50501','STONE_GRASS',1),/尚未完成/);
const next=makeMail();assert.throws(()=>call('claimMailFast','50501',next),/尚未完成/);
call('claimAllMailFast','50501');assert.equal(quantity('50501','STONE_GRASS'),before+4,'bulk recovers pending first');
call('claimMailFast','50501',pending);assert.equal(quantity('50501','STONE_GRASS'),before+4);
// Failure before quantity write leaves a durable transaction; retry performs one credit.
const beforeWrite=makeMail();failed=false;const b=quantity('50501','STONE_GRASS');
setFault((event,when)=>{if(!failed&&event.name==='學生道具'&&when==='before'){failed=true;throw Error('before credit');}});
assert.throws(()=>call('claimMailFast','50501',beforeWrite),/before credit/);setFault(null);
assert.equal(quantity('50501','STONE_GRASS'),b);call('claimMailFast','50501',beforeWrite);assert.equal(quantity('50501','STONE_GRASS'),b+2);
// Response lost after marking claimed still does not grant twice.
const done=makeMail();failed=false;const d=quantity('50501','STONE_GRASS');
setFault((event,when)=>{if(!failed&&event.name==='信箱'&&event.c===mh['是否領取']&&when==='after'){failed=true;throw Error('claimed response lost');}});
assert.throws(()=>call('claimMailFast','50501',done),/claimed response/);setFault(null);
call('claimMailFast','50501',done);assert.equal(quantity('50501','STONE_GRASS'),d+2);
// Simulate a competing request at a write boundary: shared lock excludes it.
const simultaneous=makeMail();let attempted=false;const concurrentBefore=quantity('50501','STONE_GRASS');
setFault((event,when)=>{if(!attempted&&event.name==='學生道具'&&when==='before'){attempted=true;assert.throws(()=>call('claimAllMailFast','50501'));}});
call('claimMailFast','50501',simultaneous);setFault(null);call('claimAllMailFast','50501');
assert.equal(quantity('50501','STONE_GRASS'),concurrentBefore+2);
// Pending enhancement and pending mail cannot modify the same stone quantity.
const skillRetry=randomUUID();failed=false;
setFault((event,when)=>{if(!failed&&event.name==='學生道具'&&when==='after'){failed=true;throw Error('pending skill');}});
assert.throws(()=>call('useAttributeStoneV600','50501','PET001','GEN-3','STONE_GRASS',skillRetry,token),/pending skill/);setFault(null);
const blockedMail=makeMail();assert.throws(()=>call('claimMailFast','50501',blockedMail),/尚未完成的強化/);
call('useAttributeStoneV600','50501','PET001','GEN-3','STONE_GRASS',skillRetry,token);call('claimMailFast','50501',blockedMail);
// New stone inventory rows integrate into the same table; candies remain claimable.
const newStone=makeMail('STONE_WATER',3);call('claimMailFast','50501',newStone);call('claimMailFast','50501',newStone);
assert.equal(quantity('50501','STONE_WATER'),3);
const candyBefore=quantity('50501','EXP010'),candy=makeMail('EXP010',2);call('claimMailFast','50501',candy);assert.equal(quantity('50501','EXP010'),candyBefore+2);
assert.equal(JSON.stringify(tables.get('學生寵物').values),petsSnapshot);
assert.equal(students.values[1][3],JSON.parse(studentSnapshot)[1][3]);assert.equal(students.values[2][3],JSON.parse(studentSnapshot)[2][3]);assert.equal(isLocked(),false);
// Frontend prevents single/all overlap and installs authoritative inventory cache.
async function testMailUI(){
 const local=new Map(),buttons=[];const el={innerHTML:'',textContent:'',classList:{add(){},toggle(){}}};
 const ui=vm.createContext({console,BigInt,window:{},localStorage:{getItem:()=>null,setItem:(k,v)=>local.set(k,v)},sessionStorage:{getItem:()=>null},Date,alert:()=>{},panel:el,mailBadge:el});
 vm.runInContext(frontend,ui);vm.runInContext("currentId='50501';currentTab='mail';state={unreadMail:1};mailbox=[{'信件ID':'M','是否領取':false}];",ui);
 let calls=0,release;ui.gs=async()=>{calls++;return new Promise(resolve=>release=resolve);};
 const request=vm.runInContext("claimMailUI('M')",ui);
 assert.ok(el.innerHTML.includes('disabled'), 'claim buttons disabled during write');
 await vm.runInContext('claimAllMailUI()',ui);await vm.runInContext("claimMailUI('M')",ui);assert.equal(calls,1);
 release({ok:true,inventory:[{itemId:'STONE_GRASS',quantity:2}],unreadMail:0});await request;
 assert.equal(vm.runInContext('MAIL_CLAIM_BUSY_V600',ui),false);
 assert.equal(vm.runInContext('CLIENT_CACHE.inventory[0].quantity',ui),2);
 assert.equal(vm.runInContext("mailbox[0]['是否領取']",ui),true);
 let refreshes=0;ui.gs=async()=>{throw Error('timed out');};ui.refreshMailboxInBackground=async()=>{refreshes++;};
 vm.runInContext("mailbox[0]['是否領取']=false;",ui);await vm.runInContext("claimMailUI('M')",ui);
 assert.equal(refreshes,1);assert.equal(vm.runInContext('MAIL_CLAIM_BUSY_V600',ui),false);
}
testMailUI().then(()=>console.log('PASS V6.0 mailbox: 12 matching attributes, 50% boundary, exact 80/10/6/3/1 buckets, unchanged fallback gifts, hourly generation retry dedup, single/all repeated claims, locked targeted writes, before/after-credit recovery, pending-operation guards, existing inventory/candies, frontend double-click guard and authoritative cache.')).catch(e=>{console.error(e);process.exitCode=1;});
