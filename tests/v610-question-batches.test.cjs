const assert=require('node:assert/strict'),{context,call,tables,cache,makeSheet,writes,setFault}=require('./v600.test.cjs');
const subjects=['國語','數學','英文','自然','社會'];
const headers=['題目ID','科目','題型','題目','選項A','選項B','選項C','選項D','答案','解析','是否啟用','單元','圖片ID','圖片路徑','舊額外欄'];
const rows=subjects.flatMap((s,k)=>Array.from({length:500},(_,i)=>[`${k}-${i}`,s,'選擇題','分數 2/3 比較','2/3','1/3','1/2','3/4','A','保留解析',i===499?'FALSE':'TRUE','單元1',i===0?'IMG001':'',i===0?'assets/math/IMG001.png':'','保留'+i]));
const legacy=makeSheet('挑戰題庫',[headers,...rows]);
let reads=[];
function instrument(sh){
  const getRange=sh.getRange.bind(sh),getDataRange=sh.getDataRange.bind(sh);
  sh.getRange=(r,c,n=1,m=1)=>{const range=getRange(r,c,n,m),read=range.getDisplayValues;return {...range,getValues:()=>{reads.push({sheet:sh.name,r,c,n,m});return range.getValues();},getDisplayValues:()=>{reads.push({sheet:sh.name,r,c,n,m});return read();}};};
  sh.getDataRange=()=>{const range=getDataRange();return {...range,getValues:()=>{reads.push({sheet:sh.name,full:true});return range.getValues();},getDisplayValues:()=>{reads.push({sheet:sh.name,full:true});return range.getDisplayValues();}};};
}
instrument(legacy);
// Student fixture already has pets; suppress unrelated first-login starter creation.
context.ensureStudentReadyFast_=()=>{};
cache.clear();reads=[];
call('loginFastV596','50501','01/01');call('getPostLoginBundleV5101','50501');call('getChallengeHomeBundleV5101','50501');
assert.equal(reads.length,0,'login/post-login/challenge home never read questions');
const original=JSON.stringify(legacy.values),protectedRows=new Map(['學生資料','學生寵物','挑戰紀錄','對戰存檔'].map(s=>[s,JSON.stringify(tables.get(s)?.values)]));
const migration=call('setupOrMigrateSubjectQuestionBanksV610');assert.ok(migration.ok);
assert.ok(migration.subjects.every(s=>s.added===500));
for(const s of subjects){const sh=tables.get('題庫_'+s);assert.equal(sh.values.length,501);assert.ok(sh.values[0].includes('舊額外欄'));assert.equal(sh.values[1][4],'2/3');instrument(sh);}
const snapshots=subjects.map(s=>JSON.stringify(tables.get('題庫_'+s).values));
assert.ok(call('setupOrMigrateSubjectQuestionBanksV610').subjects.every(s=>s.added===0));
subjects.forEach((s,i)=>assert.equal(JSON.stringify(tables.get('題庫_'+s).values),snapshots[i]));
assert.equal(JSON.stringify(legacy.values),original);for(const [s,old] of protectedRows)assert.equal(JSON.stringify(tables.get(s)?.values),old);
const sizes=[];
for(const s of subjects){
  reads=[];const result=call('getQuestionBatchV610',s,25,[]);
  assert.equal(result.questions.length,25);assert.equal(result.total,499);
  assert.deepEqual(reads.map(r=>r.sheet),['題庫_'+s],'one subject-only bounded display read');
  const whole=call('getQuestionBankSubjectFast',s);sizes.push({subject:s,before:Buffer.byteLength(JSON.stringify(whole)),after:Buffer.byteLength(JSON.stringify(result))});
  assert.ok(sizes.at(-1).after<sizes.at(-1).before/10);
  reads=[];for(let tablet=0;tablet<25;tablet++)assert.equal(call('getQuestionBatchV610',s,25,[]).questions.length,25);
  assert.equal(reads.length,0,'25 warm tablets share the cached bank without Sheet reads');
  const excluded=whole.slice(0,480).map(q=>q.id),tail=call('getQuestionBatchV610',s,25,excluded);
  assert.equal(tail.questions.length,19);assert.ok(tail.questions.every(q=>!excluded.includes(q.id)));
  assert.equal(call('getQuestionBatchV610',s,25,whole.map(q=>q.id)).questions.length,0,'no silent recycling before the queue is exhausted');
}
context.verifyAdminPassword_=password=>assert.equal(password,'fixture-only');
const otherKeys=[...cache.keys()].filter(k=>k.startsWith('question-bank:')&&!k.includes(':數學:')).map(k=>[k,cache.get(k)]);
call('adminRefreshQuestionBankV610','fixture-only','數學');
for(const [k,value] of otherKeys)assert.equal(cache.get(k),value,'other subjects stay cached');
reads=[];call('getQuestionBatchV610','國語',25,[]);assert.equal(reads.length,0);
reads=[];call('getQuestionBatchV610','數學',25,[]);assert.deepEqual(reads.map(r=>r.sheet),['題庫_數學']);
const math=call('getQuestionBankSubjectFast','數學').find(q=>q.id==='1-0');assert.equal(math.options[0],'2/3');assert.equal(math.answer,'A');assert.equal(math.imageId,'IMG001');
if(!tables.has('挑戰紀錄'))makeSheet('挑戰紀錄',[['週期','學號','科目','寵物ID','答對數','錯誤數','總EXP','最後題目ID','最後更新']]);
const batchId=require('node:crypto').randomUUID();
const synced=call('syncChallengeBatch','50501','數學','PET003',[{questionId:'1-0',answer:'A'}],batchId);
assert.equal(synced.processed,1);assert.equal(synced.gained,1);
const committedPets=JSON.stringify(tables.get('學生寵物').values);
assert.equal(JSON.stringify(call('syncChallengeBatch','50501','數學','PET003',[{questionId:'1-0',answer:'A'}],batchId)),JSON.stringify(synced));
assert.equal(JSON.stringify(tables.get('學生寵物').values),committedPets,'migrated-bank retry awards EXP once');
call('onEdit',{range:{getSheet:()=>tables.get('題庫_英文')}});reads=[];call('getQuestionBatchV610','英文',25,[]);assert.deepEqual(reads.map(r=>r.sheet),['題庫_英文']);
// Losing one chunk must cause a subject-only rebuild, never a truncated bank.
const currentBase=call('questionCacheBaseV610_','英文'),currentMeta=JSON.parse(cache.get(currentBase+':meta'));
const missing=currentBase+':'+currentMeta.generation+':0';
cache.delete(missing);reads=[];assert.equal(call('getQuestionBankSubjectFast','英文').length,499);assert.deepEqual(reads.map(r=>r.sheet),['題庫_英文']);
// A partially completed migration can be rerun without duplicating already copied subjects.
for(const [i,s] of subjects.entries())legacy.appendRow([`${i}-new`,s,'選擇題','新設定測試','甲','乙','','','A','',true,'','','','extra']);
const sourceBeforeRetry=JSON.stringify(legacy.values);let interrupted=false;
setFault((e,phase)=>{if(!interrupted&&e.name==='題庫_英文'&&phase==='before'){interrupted=true;throw Error('migration interrupted');}});
assert.throws(()=>call('setupOrMigrateSubjectQuestionBanksV610'),/migration interrupted/);setFault(null);
const repaired=call('setupOrMigrateSubjectQuestionBanksV610');assert.deepEqual(Array.from(repaired.subjects,s=>s.added),[0,0,1,1,1]);
for(const s of subjects)assert.equal(tables.get('題庫_'+s).values.length,502);
assert.equal(JSON.stringify(legacy.values),sourceBeforeRetry);
console.log('QUESTION_PAYLOAD '+JSON.stringify(sizes));
console.log('PASS Phase 5 subject banks: five isolated reads, 25-question batch, 0-read cache hits/home/login, 25 shared-cache tablets, exclusion, subject-only invalidation/onEdit, fraction/image fields, additive idempotent migration, original extra columns/IDs/student records preserved');
