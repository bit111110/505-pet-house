// Phase 4 intentionally optimizes sync/renderer I/O; behavior remains covered by battle and idempotency suites.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {context,call,tables,cache,writes,makeSheet,setFault,isLocked,frontend}=require('./v600.test.cjs');
const previous=vm.createContext({});vm.runInContext(execFileSync('git',['show','399dab7:apps-script/Code.gs'],{encoding:'utf8'}),previous);
// Normalize the already deployed syntax-only fix and visible version text when comparing historical source.
const normalized=fn=>fn.toString().replace(/\r\n/g,'\n').replace(/\b(0|5)n\b/g,'BigInt($1)').replace('V6.0 · 升級工坊','V6.1 · 升級工坊');
for(const name of ['getUpgradeBundleV600','useAttributeStoneV600','useAttributeStonesBatchV610','setupOrUpgradeV610','randomGift_','hourlyPetGiftV600_','claimMailsLockedV600_','getBattleProgressV5105','saveBattleProgressV5105'])assert.equal(normalized(context[name]),normalized(previous[name]),name+' outside Phase 2 unchanged');
const ui=vm.createContext({localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},window:{}}),oldUI=vm.createContext({localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},window:{}});
vm.runInContext(frontend,ui);vm.runInContext(execFileSync('git',['show','399dab7:app.js'],{encoding:'utf8'}),oldUI);
// Phase 3 intentionally replaces stone artwork; mutation and battle behavior stay pinned.
for(const name of ['renderUpgrade','useStoneV600','applyStoneResultV610','updateStoneViewV610','getConfiguredPetSkills'])assert.equal(normalized(ui[name]),normalized(oldUI[name]),name+' UI unchanged');
let valueReads=0,commits=0;
const column=name=>[...name].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
context.Sheets.Spreadsheets.Values={batchGet(_id,{ranges}){
 valueReads++;return {valueRanges:ranges.map(range=>{
  const m=range.match(/^'((?:[^']|'')+)'!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);assert.ok(m,range);
  const sh=tables.get(m[1].replace(/''/g,"'")),c=column(m[2])-1,start=Number(m[3])-1,end=Number(m[5]);
  return {values:sh.values.slice(start,end).map(r=>[r[c]??''])};
 })};
}};
const atomic=context.Sheets.Spreadsheets.batchUpdate;context.Sheets.Spreadsheets.batchUpdate=(...args)=>{commits++;return atomic(...args);};
const password='test-only-password';
const coins=(entries,rid=randomUUID())=>call('grantCoinsBatchV610',password,entries,rid,'測試批次');
const items=(item,entries,rid=randomUUID())=>call('grantItemsBatchV610',password,item,entries,rid,'測試批次');
const ids=Array.from({length:25},(_,i)=>'505'+String(i+1).padStart(2,'0'));
makeSheet('學生資料',[['學號','姓名','生日','金幣','座號'],...ids.map((id,i)=>[id,'學生'+i,'01/01',1000,i+1])]);
const studentSheet=tables.get('學生資料'),inventory=tables.get('學生道具');
const student=id=>studentSheet.values.find(r=>r[0]===id);
const quantity=(id,item)=>Number(inventory.values.find(r=>r[0]===id&&r[1]===item)?.[2]||0);
const inputs=value=>ids.map(id=>({studentId:id,amount:value}));
const itemInputs=value=>ids.map(id=>({studentId:id,quantity:value}));
const preservedIDs=JSON.stringify(studentSheet.values.map(r=>r[0]));
assert.equal(coins(inputs(100)).ok,false,'setup required before grants');
call('setupAdminBatchV610');const ledger=tables.get('獎勵紀錄');const beforeSetup=JSON.stringify(ledger.values);call('setupAdminBatchV610');assert.equal(JSON.stringify(ledger.values),beforeSetup,'setup idempotent and additive');
assert.throws(()=>call('grantCoinsBatchV610','incorrect-test-credential',inputs(100),randomUUID()),/test-only-password/);
// Guard against per-student SpreadsheetApp I/O and full-table reads.
let ranges=[];
for(const sh of tables.values()){
 const data=sh.getDataRange.bind(sh),range=sh.getRange.bind(sh);
 sh.getDataRange=()=>{if(['學生資料','學生道具','信箱','技能強化紀錄','獎勵紀錄'].includes(sh.name))throw Error('full table read '+sh.name);return data();};
 sh.getRange=(r,c,n=1,m=1)=>{ranges.push({sheet:sh.name,r,c,n,m});return range(r,c,n,m);};
}
let start=writes.length,beforeReads=valueReads,beforeCommits=commits;
let r=coins(inputs(100));assert.equal(r.successCount,25);ids.forEach(id=>assert.equal(student(id)[3],1100));
assert.equal(valueReads-beforeReads,1,'one batched data read for 25 students');assert.equal(commits-beforeCommits,1,'one atomic commit');
assert.equal(writes.slice(start).filter(w=>w.name==='學生資料'&&w.atomic).length,1,'contiguous coin changes share one request');
assert.ok(writes.slice(start).filter(w=>w.name==='學生資料').every(w=>w.c===4&&w.m===1),'only coin column updated');
assert.ok(ranges.filter(x=>x.sheet==='學生資料'&&x.r>1).length===0,'no per-student getRange');
const different=ids.map((id,i)=>({studentId:id,amount:i}));r=coins(different);assert.equal(r.successCount,24);assert.equal(r.skippedCount,1);ids.forEach((id,i)=>assert.equal(student(id)[3],1100+i));
beforeReads=valueReads;beforeCommits=commits;start=writes.length;
r=items('STONE_LIGHT',itemInputs(5));assert.equal(r.successCount,25);ids.forEach(id=>assert.equal(quantity(id,'STONE_LIGHT'),5));
assert.equal(valueReads-beforeReads,1,'item inventory/mail/skill guards read in one Values.batchGet');assert.equal(commits-beforeCommits,1);
assert.equal(writes.slice(start).filter(w=>w.name==='學生道具'&&!w.atomic).length,1,'new zero rows reserved in one range');
assert.equal(writes.slice(start).filter(w=>w.name==='學生道具'&&w.atomic).length,1,'25 item counts batched into one contiguous request');
const mixed=ids.map((id,i)=>({studentId:id,quantity:i%6}));r=items('EXP010',mixed);assert.equal(r.skippedCount,5);assert.equal(r.successCount,20);ids.forEach((id,i)=>assert.equal(quantity(id,'EXP010'),(id==='50501'?7:0)+i%6));
r=coins([{studentId:'50501',amount:2},{studentId:'missing',amount:100},{studentId:'50502',amount:-1}]);assert.equal(r.successCount,1);assert.equal(r.failedCount,2);assert.match(r.results[1].reason,/學生不存在/);
const invalidBefore=writes.length;r=items('MISSING',itemInputs(1));assert.equal(r.failedCount,25);assert.equal(r.successCount,0);assert.ok(r.results.every(x=>/道具不存在/.test(x.reason)));assert.equal(writes.slice(invalidBefore).filter(w=>w.name==='學生道具').length,0);
// Both grant modes deduplicate permanently; same ID cannot change payload or API mode.
for(const mode of ['COINS','ITEMS']){
 const request=randomUUID(),entries=mode==='COINS'?inputs(3):itemInputs(2),send=()=>mode==='COINS'?coins(entries,request):items('STONE_LIGHT',entries,request);
 const original=send(),afterCoins=student('50501')[3],afterItems=quantity('50501','STONE_LIGHT'),afterWrites=writes.length;
 assert.equal(send().replayed,true);assert.equal(writes.length,afterWrites);assert.equal(student('50501')[3],afterCoins);assert.equal(quantity('50501','STONE_LIGHT'),afterItems);
 assert.equal(coins(inputs(4),request).ok,false,'content or kind mismatch blocked');assert.equal(original.successCount,25);
}
// Timeout after commit: inventory/coins AND permanent receipt commit together.
for(const mode of ['COINS','ITEMS']){
 const request=randomUUID(),send=()=>mode==='COINS'?coins(inputs(2),request):items('STONE_LIGHT',itemInputs(2),request);
 let lost=false;setFault((e,when)=>{if(e.atomic&&when==='after'&&!lost){lost=true;throw Error('reply lost');}});
 r=send();setFault(null);assert.equal(r.retryable,true);assert.equal(r.unconfirmedCount,25);
 const after=mode==='COINS'?student('50501')[3]:quantity('50501','STONE_LIGHT');r=send();assert.equal(r.replayed,true);assert.equal(r.successCount,25);assert.equal(mode==='COINS'?student('50501')[3]:quantity('50501','STONE_LIGHT'),after);
}
const twoTabs=randomUUID();let contested=false;beforeCommits=commits;
setFault((e,when)=>{if(e.atomic&&when==='before'&&!contested){contested=true;assert.equal(isLocked(),true);assert.throws(()=>coins(inputs(1),twoTabs));}});
coins(inputs(1),twoTabs);setFault(null);assert.equal(coins(inputs(1),twoTabs).replayed,true);assert.equal(commits-beforeCommits,1);
// Zero, duplicates, unsafe quantities, sparse rows and unknown students stay isolated.
r=coins([{studentId:'50501',amount:0},{studentId:'50502',amount:4},{studentId:'50503',amount:4},{studentId:'50503',amount:5},{studentId:'50504',amount:Number.MAX_SAFE_INTEGER}]);assert.equal(r.successCount,1);assert.equal(r.skippedCount,1);assert.equal(r.failedCount,3);
// Restore only spy methods for legacy API verification; legacy implementation may still scan tables.
for(const sh of tables.values())sh.getDataRange=()=>({getValues:()=>sh.values.map(row=>row.slice())});
let before=student('50501')[3];assert.equal(call('adminAddCoinsFastV599',password,'50501',9).coins,before+9);assert.equal(call('adminAddCoins',password,'50501',4),true);assert.equal(student('50501')[3],before+13);
before=quantity('50501','EXP010');call('adminGrantItemFast',password,'50501','EXP010',2);assert.equal(quantity('50501','EXP010'),before+2);
// Fail before commit: no partial credit, retry never redispatches, same-asset legacy writes blocked.
const uncertain=randomUUID();const originalAtomic=context.Sheets.Spreadsheets.batchUpdate;
let delayed;
context.Sheets.Spreadsheets.batchUpdate=(...args)=>{delayed=args;throw Error('RPC status unknown');};before=student('50501')[3];
r=coins([{studentId:'50501',amount:11}],uncertain);assert.equal(r.retryable,true);assert.equal(student('50501')[3],before);
context.Sheets.Spreadsheets.batchUpdate=originalAtomic;beforeCommits=commits;assert.equal(coins([{studentId:'50501',amount:11}],uncertain).retryable,true);assert.equal(commits,beforeCommits);
assert.throws(()=>call('adminAddCoinsFastV599',password,'50501',1),/尚未確認/);assert.throws(()=>call('spendCoins_','50501',1),/尚未確認/);
assert.equal(coins(inputs(1)).retryable,true,'new batches cannot bypass unresolved batch');
// Model a delayed server commit after the original execution returned: reserved audit rows remain owned.
let lock=context.LockService.getScriptLock();lock.waitLock(12000);try{originalAtomic(...delayed);}finally{lock.releaseLock();}
assert.equal(coins([{studentId:'50501',amount:11}],uncertain).replayed,true);assert.equal(student('50501')[3],before+11);
const uncertainItem=randomUUID(),itemBefore=quantity('50501','STONE_WATER');
context.Sheets.Spreadsheets.batchUpdate=(...args)=>{delayed=args;throw Error('RPC status unknown');};
r=items('STONE_WATER',[{studentId:'50501',quantity:5}],uncertainItem);context.Sheets.Spreadsheets.batchUpdate=originalAtomic;
assert.equal(r.retryable,true);assert.equal(quantity('50501','STONE_WATER'),itemBefore,'new inventory scaffolding does not grant items');
assert.throws(()=>call('adminGrantItemFast',password,'50501','STONE_WATER',1),/尚未確認/);
const reserved=ledger.values.length;
call('adminGrantItem',password,'50502','EXP010',2);const unrelated=quantity('50502','EXP010'),auditTail=JSON.stringify(ledger.values.slice(reserved));
assert.ok(ledger.values.length>reserved,'unrelated later audit appends after reserved rows');
lock=context.LockService.getScriptLock();lock.waitLock(12000);try{originalAtomic(...delayed);}finally{lock.releaseLock();}
assert.equal(items('STONE_WATER',[{studentId:'50501',quantity:5}],uncertainItem).replayed,true);
assert.equal(quantity('50501','STONE_WATER'),itemBefore+5);assert.equal(quantity('50502','EXP010'),unrelated);assert.equal(JSON.stringify(ledger.values.slice(reserved)),auditTail,'delayed commit never overwrites later rewards');
assert.equal(items('STONE_WATER',[{studentId:'50501',quantity:5}],uncertainItem).replayed,true);
// A single blocked student's item operation does not prevent valid classmates receiving their rewards.
call('appendObject_',tables.get('信箱'),{'信件ID':'PENDING-ADMIN-TEST','學號':'50502','附件ID':'EXP010','附件數量':1,'是否領取':false,'領取交易':JSON.stringify({version:2,status:'SUBMITTED',transactionId:'pending'})});
r=items('EXP010',[{studentId:'50501',quantity:1},{studentId:'50502',quantity:1}]);assert.equal(r.successCount,1);assert.equal(r.failedCount,1);assert.match(r.results[1].reason,/尚未完成/);
assert.equal(JSON.stringify(studentSheet.values.map(row=>row[0])),preservedIDs,'student ID column unchanged');
assert.ok(!JSON.stringify(ledger.values).includes(password),'teacher password never stored in receipts');
assert.equal(isLocked(),false);
console.log('PASS V6.1 teacher batch: 25 students same/different coins/items, zero skip, missing students/items, per-student errors, permanent replay + payload mismatch, post-commit timeout, lock contention, legacy single grants, unresolved-RPC protection, additive setup, ID/password safety, one Values.batchGet + one atomic commit, no per-student getRange/setValue or full-table reads.');
