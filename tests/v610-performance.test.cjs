const assert=require('node:assert/strict'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {context,call,tables}=require('./v600.test.cjs');
const old=vm.createContext({});vm.runInContext(execFileSync('git',['show','32d722a:apps-script/Code.gs'],{encoding:'utf8'}),old);
// Legacy transaction code must differ only in the safety guard for new batch journals.
const normalized=context.useAttributeStoneV600.toString().replace(/\r\n/g,'\n').replace(/\n    \/\/ V6\.1 原子提交[^\n]*\n    if\(operation\?\.\['使用數量'\][^\n]*\n/,'\n');
assert.equal(normalized,old.useAttributeStoneV600.toString().replace(/\r\n/g,'\n'),'legacy single-item transaction unchanged apart from batch guard');
call('setupOrUpgradeV610');
const token=call('createStudentSessionV600_','50501');
call('getUpgradeBundleV600','50501',token); // warm all shared catalog caches
call('appendObject_',tables.get('信箱'),{'信件ID':'PERF-MAIL','學號':'50501','附件ID':'STONE_GRASS','附件數量':1,'是否領取':true});
let reads=[],ranges=[];
for(const sh of tables.values()){
 const original=sh.getDataRange.bind(sh),range=sh.getRange.bind(sh);
 sh.getDataRange=()=>{reads.push(sh.name);return original();};
 sh.getRange=(r,c,n=1,m=1)=>{ranges.push({sheet:sh.name,r,c,n,m});return range(r,c,n,m);};
}
const newBundle=context.getUpgradeBundleV600;
const newEnhancements=context.getSkillEnhancementsV600_;
vm.runInContext(old.getSkillEnhancementsV600_.toString(),context); // Measure the complete historical implementation.
vm.runInContext(old.getUpgradeBundleV600.toString(),context);
vm.runInContext(old.useAttributeStoneV600.toString().replace('function useAttributeStoneV600(','function benchmarkOldStone('),context);
call('benchmarkOldStone','50501','PET001','GEN-7','STONE_GRASS',randomUUID(),token);
const oldReads=reads.slice();context.getUpgradeBundleV600=newBundle;context.getSkillEnhancementsV600_=newEnhancements;reads=[];ranges=[];
const result=call('useAttributeStonesBatchV610','50501','PET001','GEN-7','STONE_GRASS',10,randomUUID(),token);
assert.equal(result.usedQuantity,10);assert.equal(reads.length,0,'warm batch transaction has no getDataRange reads');
assert.equal(oldReads.filter(x=>x==='技能強化紀錄').length,3);
assert.equal(oldReads.filter(x=>x==='學生寵物').length,2);
assert.equal(oldReads.filter(x=>x==='學生道具').length,2);
assert.equal(oldReads.filter(x=>x==='信箱').length,1);
console.log('PASS performance: old single-item API performs 8 full-table reads (ledger 3, pets 2, inventory 2, mailbox 1); warm V6.1 ten-item API performs 0 full-table reads, scanning only student-ID columns + matching student rows. Ranges:',JSON.stringify(ranges));
