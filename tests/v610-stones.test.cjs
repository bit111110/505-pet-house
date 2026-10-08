const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {call,context,tables,cache,writes,setFault,frontend,isLocked}=require('./v600.test.cjs');
call('setupOrUpgradeV610');
const ledger=tables.get('技能強化紀錄'),items=tables.get('學生道具');
const snapshot=JSON.stringify(ledger.values);call('setupOrUpgradeV610');assert.equal(JSON.stringify(ledger.values),snapshot,'setup preserves existing enhancements');
const token=call('createStudentSessionV600_','50501');
const stock=()=>items.values[1][2];
const setStock=q=>{items.values[1][2]=q;};
const send=(q,rid=randomUUID(),pet='PET001',skill='GEN-7',item='STONE_GRASS')=>call('useAttributeStonesBatchV610','50501',pet,skill,item,q,rid,token);
const sum=skill=>ledger.values.slice(1).filter(r=>r[0]==='50501'&&r[3]===skill&&r[8]==='DONE').reduce((n,r)=>n+BigInt(r[6]||0),0n);
setStock(100);
for(const n of [1,5,10]){
 const before=stock(),bonus=sum('GEN-7'),start=writes.length,result=send(n);
 assert.equal(result.usedQuantity,n);assert.equal(stock(),before-n);assert.equal(result.addedDamage,String(n*5));
 assert.equal(result.totalBonus,String(bonus+BigInt(n*5)));assert.equal(result.finalDamage,String(35n+bonus+BigInt(n*5)));
 assert.ok(!('inventory' in result)&&!('pets' in result),'minimal response');
 assert.equal(writes.slice(start).filter(w=>w.atomic&&w.name==='學生道具').length,1,'one inventory deduction');
 assert.equal(writes.slice(start).filter(w=>w.name==='技能強化紀錄'&&!w.atomic).length,1,'one journal row per batch');
}
const all=send('ALL');assert.equal(all.usedQuantity,84);assert.equal(stock(),0);
setStock(4);const rejectedWrites=writes.length;
assert.equal(send(5).ok,false,'insufficient stones');
assert.equal(send(1,randomUUID(),'PET001','GEN-7','STONE_FIRE').ok,false,'wrong attribute');
assert.equal(send(1,randomUUID(),'PET003','GEN-7').ok,false,'locked skill');
assert.equal(send(1,randomUUID(),'PET002','GEN-7','STONE_FIRE').ok,false,'ownership');
assert.equal(writes.length,rejectedWrites,'rejections do not write');
setStock(80);const rid=randomUUID(),first=send(10,rid);assert.equal(stock(),70);
assert.equal(send(10,rid).replayed,true);assert.equal(stock(),70);
assert.throws(()=>send(5,rid),/請求編號/,'same ID cannot change quantity');
// A later legitimate consumption does not cause the old request to grant or debit again.
send(5);const afterLater=stock(),laterReplay=send(10,rid);
assert.equal(laterReplay.usedQuantity,first.usedQuantity);assert.equal(laterReplay.addedDamage,first.addedDamage);
assert.equal(laterReplay.totalBonus,sum('GEN-7').toString());assert.equal(laterReplay.remainingStone,afterLater);assert.equal(stock(),afterLater);
// Commit succeeds but Apps Script never returns its response.
const timeoutId=randomUUID();let lost=false;
setFault((event,when)=>{if(event.atomic&&when==='after'&&!lost){lost=true;throw Error('response timeout');}});
const beforeTimeout=stock();assert.throws(()=>send(10,timeoutId),/response timeout/);setFault(null);
assert.equal(stock(),beforeTimeout-10);const replay=send(10,timeoutId);assert.equal(replay.replayed,true);assert.equal(stock(),beforeTimeout-10);
// Both simulated tab requests enter the shared ScriptLock; one atomic commit only.
const tabs=randomUUID(),start=writes.length;let contested=false;
setFault((event,when)=>{if(event.atomic&&when==='before'&&!contested){contested=true;assert.equal(isLocked(),true);assert.throws(()=>send(5,tabs),'contender cannot bypass shared lock');}});
const a=send(5,tabs);setFault(null);const b=send(5,tabs);assert.equal(contested,true);
assert.equal(a.replayed,false);assert.equal(b.replayed,true);
assert.equal(writes.slice(start).filter(w=>w.atomic&&w.name==='學生道具').length,1);
// General, attribute and Lv30 special skills all work and survive a new session.
send(1,randomUUID(),'PET001','ATTR-草-10');send(1,randomUUID(),'PET001','SPECIAL-PET001');
cache.delete('SKILL_BONUS_V600:50501');
const bundle=call('getUpgradeBundleV600','50501',call('createStudentSessionV600_','50501'));
assert.equal(bundle.skillEnhancements.PET001['GEN-7'],sum('GEN-7').toString());
const ui=vm.createContext({BigInt,localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},window:{}});vm.runInContext(frontend,ui);ui.bundle=bundle;
vm.runInContext('state={pets:bundle.pets,skillEnhancements:bundle.skillEnhancements};PET_BATTLE_CONFIGS=Object.fromEntries(bundle.petBattleConfigs.map(p=>[p.petId,p]));',ui);
assert.equal(vm.runInContext("getConfiguredPetSkills(state.pets[0]).find(s=>s.id==='GEN-7').damage",ui),(35n+sum('GEN-7')).toString(),'existing battle damage uses permanent bonus');
const oldStock=stock(),old=call('useAttributeStoneV600','50501','PET001','GEN-7','STONE_GRASS',randomUUID(),token);
assert.equal(old.ok,true);assert.equal(stock(),oldStock-1);assert.equal(old.skillEnhancements.PET001['GEN-7'],sum('GEN-7').toString(),'legacy single API compatible');
// Warm config cache: batch mutation may only scan student ID columns and selected rows.
const ranges=[],originalDataRanges=[];
for(const name of ['學生道具','學生寵物','技能強化紀錄','信箱']){
 const sh=tables.get(name);if(!sh)continue;
 originalDataRanges.push([sh,sh.getDataRange]);sh.getDataRange=()=>{throw Error('full sheet read: '+name);};
 const original=sh.getRange.bind(sh);sh.getRange=(r,c,n=1,m=1)=>{ranges.push({name,r,c,n,m});return original(r,c,n,m);};
}
const compact=send(1);assert.equal(compact.ok,true);
assert.ok(ranges.filter(r=>r.n>1&&r.name==='學生道具').every(r=>r.m===1||r.n<items.getLastRow()-1),'no full inventory snapshot');
// Ambiguous RPC before any update remains PENDING; a retry cannot dispatch another batch.
const pendingId=randomUUID();setFault((e,when)=>{if(e.atomic&&when==='before')throw Error('RPC status unknown');});
const unknownBefore=stock();assert.throws(()=>send(1,pendingId),/RPC status unknown/);setFault(null);
const pendingWrites=writes.length;assert.equal(send(1,pendingId).retryable,true);assert.equal(stock(),unknownBefore);assert.equal(writes.length,pendingWrites);
originalDataRanges.forEach(([sh,original])=>sh.getDataRange=original);
assert.equal(call('useAttributeStoneV600','50501','PET001','GEN-7','STONE_GRASS',pendingId,token).retryable,true,'legacy cannot recover a batch by inventory inference');
assert.equal(send(1).ok,false,'new mutations blocked while outcome uncertain');
const recovery=call('getUpgradeBundleV600','50501',token).pendingOperation;
assert.equal(recovery.requestId,pendingId);assert.equal(recovery.batch,true);assert.equal(String(recovery.quantity),'1','pending batch is recoverable after a new device login');
assert.ok(fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8').includes('useAttributeStonesBatchV610: useAttributeStonesBatchV610'));
console.log('PASS V6.1 batch stones: 1/5/10/ALL, insufficient/attribute/unlock/ownership, request replay + changed payload rejection, post-commit timeout, serialized two-tab submission, persistence, all skill kinds + battle damage, legacy single API, targeted reads/atomic writes, uncertain RPC fail-closed.');
