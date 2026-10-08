const assert=require('node:assert/strict'),vm=require('node:vm'),{execFileSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {context,tables,cache,makeSheet,backend,setFault,isLocked}=require('./v600.test.cjs');
const baseline=execFileSync('git',['show','e40a2e3:apps-script/Code.gs'],{encoding:'utf8'});
let metrics;
const fresh=()=>({reads:0,readCells:0,fullReads:0,writeRpcs:0,writeCells:0,sheets:{}});
const col=name=>[...name].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
context.Sheets.Spreadsheets.Values={batchGet(_id,{ranges}){
 metrics.reads++;return {valueRanges:ranges.map(range=>{const m=range.match(/^'((?:[^']|'')+)'!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);assert.ok(m,range);const sh=tables.get(m[1].replace(/''/g,"'")),r=Number(m[3]),n=Number(m[5])-r+1,c=col(m[2]),w=col(m[4])-c+1;recordRead(sh.name,n*w,false);return {values:Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>sh.values[r+i-1]?.[c+j-1]??''))};})};
}};
function recordRead(name,cells,full){metrics.readCells+=cells;metrics.fullReads+=Number(full);metrics.sheets[name]=(metrics.sheets[name]||0)+cells;}
const atomic=context.Sheets.Spreadsheets.batchUpdate;context.Sheets.Spreadsheets.batchUpdate=(...args)=>{metrics.writeRpcs++;metrics.writeCells+=args[0].requests.filter(r=>r.updateCells).reduce((n,r)=>n+r.updateCells.rows.reduce((sum,row)=>sum+row.values.length,0),0);return atomic(...args);};
function seed(ctx){
 cache.clear();
 makeSheet('學生寵物',[['學號','寵物ID','等級','EXP'],['50501','PET001',1,0],...Array.from({length:499},(_,i)=>['OTHER'+i,'PET001',1,0])]);
 const rh=['時間','學號','姓名','金幣變動','EXP變動','原因','答題批次ID','答題科目','答題寵物ID','答題內容','答題交易狀態','答題結果'];
 makeSheet('獎勵紀錄',[rh,...Array.from({length:5000},(_,i)=>['2026','OTHER'+i,'',0,0,'','','','','','',''])]);
 makeSheet('挑戰紀錄',[['週期','學號','科目','寵物ID','答對數','錯誤數','總EXP','最後題目ID','最後更新'],...Array.from({length:250},(_,i)=>['2026','OTHER'+i,'數學','PET001',0,0,0,'',''])]);
 makeSheet('挑戰題庫',[['題目ID','科目','題型','題目','選項A','選項B','答案','是否啟用'],['Q1','數學','選擇','題目','甲','乙','A',true]]);
 makeSheet('技能強化紀錄',[['學號','寵物ID','技能ID','傷害加成','狀態'],...Array.from({length:2500},(_,i)=>[i===100?'50501':'OTHER'+i,'PET001','GEN-3','5','DONE'])]);
 makeSheet('怪物設定',[['怪物ID','名稱','圖片','基礎HP','HP成長','適用科目','是否開放'],['M1','怪物','','100','25','全部',true]]);
 makeSheet('對戰背景設定',[['背景ID','名稱','圖片','適用科目','是否開放'],['B1','背景','','全部',true]]);
 makeSheet('寵物戰鬥設定',[['寵物代碼','屬性','專屬技能','專屬技能傷害'],['PET001','草','永恆森林',150]]);
 makeSheet('對戰存檔',[['學號','科目','寵物ID','怪物編號','怪物HP','怪物最大HP','已看題目','最後更新'],['50501','數學','PET001',3,100,500,'[]','2026']]);
 for(const sh of tables.values()){
  const data=sh.getDataRange.bind(sh),range=sh.getRange.bind(sh);
  sh.getDataRange=()=>{const d=data();return {...d,getValues:()=>{metrics.reads++;recordRead(sh.name,sh.getLastRow()*sh.getLastColumn(),true);return d.getValues();},getDisplayValues:()=>{metrics.reads++;recordRead(sh.name,sh.getLastRow()*sh.getLastColumn(),true);return d.getDisplayValues();}};};
  sh.getRange=(r,c,n=1,m=1)=>{const v=range(r,c,n,m);return {...v,getValue:()=>{metrics.reads++;recordRead(sh.name,1,false);return v.getValue();},getValues:()=>{metrics.reads++;recordRead(sh.name,n*m,false);return v.getValues();},setValues:rows=>{metrics.writeRpcs++;metrics.writeCells+=n*m;return v.setValues(rows);},setValue:value=>{metrics.writeRpcs++;metrics.writeCells++;return v.setValue(value);}};};
  ctx.headerMap_(sh);
 }
 ctx.cachedQuestionObjectsDisplay_();
}
function measure(source){
 const ctx=vm.createContext({...context});vm.runInContext(source,ctx);metrics=fresh();seed(ctx);metrics=fresh();
 cache.delete('QUESTION_DISPLAY_V5106_STABILITY');cache.delete('QUESTION_SUBJECT_V5106_DISPLAY:數學');
 const entry={};for(const action of ['getQuestionBankSubjectFast','getMonsterCatalogCached_','getBattleBackgroundCatalogFast','getPetBattleConfigFast','getBattleProgressV5105']){
  metrics=fresh();if(action==='getQuestionBankSubjectFast')ctx[action]('數學');else if(action==='getBattleProgressV5105')ctx[action]('50501','數學');else ctx[action]();entry[action]={...metrics};
 }
 metrics=fresh();
 const id=randomUUID(),answers=Array.from({length:12},()=>({questionId:'Q1',answer:'A'}));
 const result=ctx.syncChallengeBatch('50501','數學','PET001',answers,id),sync={...metrics};assert.equal(result.status.correct,12);assert.equal(result.gained,15);
 metrics=fresh();assert.equal(ctx.syncChallengeBatch('50501','數學','PET001',answers,id).status.correct,12);const replay={...metrics};assert.equal(replay.writeRpcs,0);
 metrics=fresh();assert.equal(ctx.syncChallengeBatch('50501','數學','PET001',answers,randomUUID()).status.correct,24);const ongoing={...metrics};
 metrics=fresh();const bonus=ctx.getSkillEnhancementsV600_('50501');assert.equal(bonus.PET001['GEN-3'],'5');const enhancement={...metrics};
 return {entry,sync,ongoing,replay,enhancement};
}
const before=measure(baseline),after=measure(backend);
if(!process.env.BATTLE_BASELINE_ONLY){assert.equal(after.sync.fullReads,0);assert.ok(after.sync.readCells<before.sync.readCells);assert.ok(after.sync.reads<before.sync.reads);assert.equal(after.sync.writeRpcs,before.sync.writeRpcs);assert.equal(after.enhancement.fullReads,0);}
console.log('BATTLE_IO '+JSON.stringify({before,after}));
// Exercise the new advanced-service path, not only the SpreadsheetApp fallback.
metrics=fresh();seed(context);metrics=fresh();
const answer=[{questionId:'Q1',answer:'A'}],id=randomUUID();let lost=false;
setFault((e,phase)=>{if(!lost&&e.atomic&&phase==='after'){lost=true;throw Error('timeout after atomic commit');}});
assert.throws(()=>context.syncChallengeBatch('50501','數學','PET001',answer,id),/timeout/);setFault(null);
const once=JSON.stringify(tables.get('學生寵物').values);
assert.equal(context.syncChallengeBatch('50501','數學','PET001',answer,id).gained,1);assert.equal(JSON.stringify(tables.get('學生寵物').values),once);
const contender=randomUUID();let competed=false;
setFault((e,phase)=>{if(!competed&&e.atomic&&phase==='before'){competed=true;assert.equal(isLocked(),true);assert.throws(()=>context.syncChallengeBatch('50501','數學','PET001',answer,contender));}});
context.syncChallengeBatch('50501','數學','PET001',answer,contender);setFault(null);
assert.equal(context.syncChallengeBatch('50501','數學','PET001',answer,contender).status.correct,2);
const locked=context.syncChallengeBatch('50501','數學','PET001',Array.from({length:4},()=>({questionId:'Q1',answer:'B'})),randomUUID());assert.equal(locked.processed,3);assert.equal(locked.status.locked,true);
assert.equal(context.syncChallengeBatch('50501','數學','PET001',answer,randomUUID()).processed,0);
const uncertain=randomUUID();let rejected=false;
setFault((e,phase)=>{if(!rejected&&e.atomic&&phase==='before'){rejected=true;throw Error('unknown atomic result');}});
assert.throws(()=>context.syncChallengeBatch('50501','數學','PET001',answer,uncertain),/unknown/);setFault(null);
assert.throws(()=>context.syncChallengeBatch('50501','數學','PET001',answer,uncertain),/尚未確認/);
makeSheet('技能強化紀錄',[['學號','寵物ID','技能ID','傷害加成','狀態'],...Array.from({length:520},(_,i)=>[i%2?'OTHER':'50501','PET001','GEN-3','5','DONE'])]);cache.delete('SKILL_BONUS_V600:50501');metrics=fresh();
assert.equal(context.getSkillEnhancementsV600_('50501').PET001['GEN-3'],'1300');assert.equal(metrics.reads,5,'one ID scan + four bounded row batches');assert.equal(metrics.fullReads,0);
console.log('PASS Phase 4 advanced Sheets reads: post-commit timeout/replay, shared-lock contention, EXP exactly once, 3-error lock and post-lock rejection.');
