const assert=require('node:assert/strict'),vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const {context,call,tables,cache,writes,frontend,makeSheet,setFault,isLocked}=require('./v600.test.cjs');
const questions=makeSheet('挑戰題庫',[['題目ID','科目','題型','題目','選項A','選項B','答案','是否啟用'],['F1','數學','填充','填入 2/3','','',new Date('2026-02-03'),true],['C1','數學','選擇','選 A','甲','乙','A',true],['T1','數學','是非','選否','是','否','B',true]]);
const originalData=questions.getDataRange;questions.getDataRange=()=>{const range=originalData();return {...range,getDisplayValues:()=>questions.values.map((row,i)=>row.map((v,j)=>i===1&&j===6?'2/3':String(v)))};};
cache.delete('QUESTION_DISPLAY_V5106_STABILITY');cache.delete('QUESTION_SUBJECT_V5106_DISPLAY:數學');
assert.equal(call('getQuestionBankSubjectFast','數學')[0].answer,'2/3');
makeSheet('挑戰紀錄',[['週期','學號','科目','寵物ID','答對數','錯誤數','總EXP','最後題目ID','最後更新']]);
const ps=tables.get('學生寵物'),rewards=tables.get('獎勵紀錄'),cs=tables.get('挑戰紀錄');ps.values[1][2]=1;ps.values[1][3]=0;
const students=JSON.stringify(tables.get('學生資料').values),inventory=JSON.stringify(tables.get('學生道具').values),mail=JSON.stringify(tables.get('信箱').values);
const afterSchema=JSON.stringify(rewards.values);call('setupOrUpgradeV600');assert.equal(JSON.stringify(rewards.values),afterSchema,'setup is idempotent, preserves existing reward rows');
const rh=call('headerMap_',rewards),ch=call('headerMap_',cs);
for(const header of ['答題批次ID','答題科目','答題寵物ID','答題內容','答題交易狀態','答題結果'])assert.ok(rh[header]);
const answer=[{questionId:'F1',answer:' 2/3 '},{questionId:'C1',answer:'a'},{questionId:'T1',answer:'B'}],bid=randomUUID();
const sync=(batchId,answers=answer,id='50501',pet='PET001')=>call('syncChallengeBatch',id,'數學',pet,answers,batchId);
const plain=x=>JSON.parse(JSON.stringify(x));
const stats=id=>{const row=cs.values.find((r,i)=>i>0&&r[ch['學號']-1]===id);return row?{correct:row[ch['答對數']-1],wrong:row[ch['錯誤數']-1],exp:row[ch['總EXP']-1]}:null;};
const transaction=(id,batchId)=>rewards.values.find(r=>r[rh['學號']-1]===id&&r[rh['答題批次ID']-1]===batchId);
// Normal submission, exact first-result replay, immutable payload and EXP only once.
const first=sync(bid);assert.equal(first.status.correct,3);assert.equal(first.status.wrong,0);assert.equal(first.gained,3);assert.equal(ps.values[1][3],3);
const writesBefore=writes.length;assert.deepEqual(plain(sync(bid)),plain(first));assert.equal(writes.length,writesBefore);assert.equal(ps.values[1][3],3);
assert.throws(()=>sync(bid,[{questionId:'C1',answer:'B'}]),/不同答題內容/);
const second=sync(randomUUID(),[{questionId:'C1',answer:'A'}]);assert.equal(second.status.correct,4);assert.equal(ps.values[1][3],4);
assert.deepEqual(plain(sync(bid)),plain(first),'replay returns FIRST result even after a newer batch');assert.equal(stats('50501').correct,4);
// Same student, two contenders using same ID serialize under the shared lock.
const concurrent=randomUUID();let injected=false;
setFault((event,when)=>{if(!injected&&event.atomic&&when==='before'){injected=true;assert.equal(isLocked(),true);assert.throws(()=>sync(concurrent,[{questionId:'C1',answer:'A'}]));}});
const concurrentResult=sync(concurrent,[{questionId:'C1',answer:'A'}]);setFault(null);
assert.deepEqual(plain(sync(concurrent,[{questionId:'C1',answer:'A'}])),plain(concurrentResult));assert.equal(stats('50501').correct,5);assert.equal(ps.values[1][3],5);
// Atomic commit succeeds, reply is lost; client retry does not increment EXP or any counters.
const lost=randomUUID();injected=false;
setFault((event,when)=>{if(!injected&&event.atomic&&event.name==='學生寵物'&&when==='after'){injected=true;throw Error('lost batch response');}});
assert.throws(()=>sync(lost,[{questionId:'C1',answer:'A'}]),/lost batch/);setFault(null);
assert.equal(transaction('50501',lost)[rh['答題交易狀態']-1],'COMMITTED');assert.equal(stats('50501').correct,6);assert.equal(ps.values[1][3],6);
const persisted=JSON.parse(transaction('50501',lost)[rh['答題結果']-1]);assert.deepEqual(plain(sync(lost,[{questionId:'C1',answer:'A'}])),persisted);assert.equal(ps.values[1][3],6);
// Namespace includes student, so the same UUID for another student is independent; capped pet level is preserved.
const other=sync(bid,[{questionId:'C1',answer:'A'}],'50502','PET002');assert.equal(other.status.correct,1);assert.equal(ps.values[3][2],30);assert.equal(ps.values[3][3],0);
// Three wrong answers still lock immediately and ignore the remainder of that batch.
const wrongs=Array.from({length:4},()=>({questionId:'C1',answer:'B'})),wrongId=randomUUID();
const locked=sync(wrongId,wrongs,'50502','PET002');assert.equal(locked.processed,3);assert.equal(locked.status.wrong,3);assert.equal(locked.locked,true);assert.equal(locked.gained,0);
assert.deepEqual(plain(sync(wrongId,wrongs,'50502','PET002')),plain(locked));assert.equal(stats('50502').wrong,3);
const afterLock=sync(randomUUID(),[{questionId:'C1',answer:'A'}],'50502','PET002');assert.equal(afterLock.processed,0);assert.equal(stats('50502').correct,1);assert.equal(stats('50502').exp,1);
// Replay does not depend on the current reset period.
const originalPeriod=context.challengePeriodKey_;context.challengePeriodKey_=()=> '2099-01-01';assert.deepEqual(plain(sync(bid)),plain(first));context.challengePeriodKey_=originalPeriod;
// Keep old 4-argument array calls safe with deterministic legacy batch IDs, plus 4-argument envelope support.
const legacy=call('syncChallengeBatch','50501','數學','PET001',[{questionId:'F1',answer:'2/3'}]);assert.ok(legacy.batchId.startsWith('LEGACY-'));
assert.deepEqual(plain(call('syncChallengeBatch','50501','數學','PET001',[{questionId:'F1',answer:'2/3'}])),plain(legacy));
const envelopeId=randomUUID();assert.equal(call('syncChallengeBatch','50501','數學','PET001',{batchId:envelopeId,answers:[{questionId:'C1',answer:'A'}]}).batchId,envelopeId);
// Existing EXP thresholds and level-up curve remain unchanged across a larger batch.
const curve=sync(randomUUID(),Array.from({length:42},()=>({questionId:'C1',answer:'A'})));assert.equal(curve.status.correct,50);assert.equal(curve.gained,147);assert.equal(curve.status.exp,155);assert.equal(ps.values[1][2],6);assert.equal(ps.values[1][3],5);
// A subrequest failure leaves all scores/EXP unchanged; unknown request is never blindly resubmitted.
const uncertain=randomUUID(),beforeUnknown=plain(stats('50501')),expBefore=ps.values[1][3];injected=false;
setFault((event,when)=>{if(!injected&&event.atomic&&event.name==='獎勵紀錄'&&event.c===rh['答題交易狀態']&&when==='before'){injected=true;throw Error('receipt commit rejected');}});
assert.throws(()=>sync(uncertain,[{questionId:'C1',answer:'A'}]),/rejected/);setFault(null);
assert.deepEqual(plain(stats('50501')),beforeUnknown);assert.equal(ps.values[1][3],expBefore);
assert.throws(()=>sync(uncertain,[{questionId:'C1',answer:'A'}]),/尚未確認/);assert.throws(()=>sync(randomUUID(),[{questionId:'C1',answer:'A'}]),/上一筆/);
assert.throws(()=>call('useExpItem','50501','EXP010','PET001',1),/答題批次尚未確認/);
assert.equal(JSON.stringify(tables.get('學生資料').values),students);assert.equal(JSON.stringify(tables.get('學生道具').values),inventory);assert.equal(JSON.stringify(tables.get('信箱').values),mail);assert.equal(isLocked(),false);
// Frontend: durable original ID/content across timeouts, new answers in a NEW batch, reload and multi-tab storage.
async function frontendQueueTests(){
 const entries=new Map(),storage={get length(){return entries.size;},key:i=>[...entries.keys()][i]||null,getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
 const ui=vm.createContext({console,Date,JSON,BigInt,crypto:{randomUUID},localStorage:storage,sessionStorage:{getItem:()=>null},window:{}});vm.runInContext(frontend,ui);
 vm.runInContext("currentId='50501';state={challengeStatus:{}};challenge={subject:'數學',petId:'PET001',pending:[{questionId:'C1',answer:'A'}],status:{correct:1,wrong:0,exp:1}};",ui);
 const calls=[],commits=new Map();let lost=true,correct=0;
 ui.gs=ui.gsRaw=async(action,id,subject,pet,answers,batchId)=>{assert.equal(action,'syncChallengeBatch');calls.push({id,subject,pet,answers:plain(answers),batchId});if(!commits.has(batchId)){correct+=answers.length;commits.set(batchId,{ok:true,batchId,status:{correct,wrong:0,exp:correct,locked:false}});}if(lost){lost=false;throw Error('network timeout');}return commits.get(batchId);};
 await assert.rejects(()=>vm.runInContext('flushChallengeAnswers(true)',ui),/timeout/);
 assert.equal(entries.size,1);const saved=JSON.parse([...entries.values()][0]);assert.equal(saved.batchId,calls[0].batchId);
 vm.runInContext("challenge.pending.push({questionId:'F1',answer:'2/3'});challenge.status.correct=2;",ui);
 await vm.runInContext('flushChallengeAnswers(true)',ui);
 assert.equal(calls[1].batchId,calls[0].batchId);assert.deepEqual(calls[1].answers,calls[0].answers);assert.notEqual(calls[2].batchId,calls[0].batchId);assert.equal(correct,2);assert.equal(entries.size,0);
 // Reload uses the saved envelope, even if the currently selected subject has changed.
 storage.setItem('petHouseChallengeBatchV600:50501:'+saved.batchId,JSON.stringify(saved));
 vm.runInContext("challenge.subject='自然';challenge.petId='PET003';challenge.pending=[];",ui);await vm.runInContext('flushChallengeAnswers(true)',ui);
 assert.equal(calls.at(-1).batchId,saved.batchId);assert.equal(calls.at(-1).subject,'數學');assert.equal(correct,2);
 // Separate per-batch keys preserve a second tab's unsent batch when the first batch is acknowledged.
 const foreign={...saved,batchId:randomUUID(),createdAt:Date.now()+100,answers:[{questionId:'C1',answer:'A'}]};storage.setItem('petHouseChallengeBatchV600:50501:'+saved.batchId,JSON.stringify(saved));storage.setItem('petHouseChallengeBatchV600:50501:'+foreign.batchId,JSON.stringify(foreign));
 await vm.runInContext('flushChallengeAnswers(true)',ui);assert.equal(correct,3);assert.equal(entries.size,0);
 // A storage failure sends nothing and retains the original pending answers.
 vm.runInContext("challenge.subject='數學';challenge.petId='PET001';challenge.pending=[{questionId:'C1',answer:'A'}];",ui);const oldSetter=storage.setItem;storage.setItem=()=>{throw Error('storage full');};const count=calls.length;
 await assert.rejects(()=>vm.runInContext('flushChallengeAnswers(true)',ui),/storage full/);assert.equal(calls.length,count);assert.equal(vm.runInContext('challenge.pending.length',ui),1);storage.setItem=oldSetter;
}
frontendQueueTests().then(()=>console.log('PASS challenge idempotency: first result replay, different batches, post-commit timeout, two-tab lock contention, 3-error lock, EXP exactly once, fractions/display values, max level, reset-period replay, legacy/envelope compatibility, atomic failure + pending EXP guard, durable frontend retry/reload/new-batch separation and per-tab storage.')).catch(e=>{console.error(e);process.exitCode=1;});
