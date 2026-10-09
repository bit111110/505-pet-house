const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const ids=Array.from({length:26},(_,i)=>'505'+String(i+1).padStart(2,'0')).filter(id=>id!=='50521');
const students=ids.map(id=>({id,seat:Number(id.slice(-2)),name:id==='50526'?'':'學生'+id,coins:100}));
const records=[...students,{id:'50521',name:'不顯示'},{id:'',name:'空學號'},{name:'無學號'},{id:'invalid',name:'無效'},...Array.from({length:80},()=>({id:'',name:''})),{id:'50501',name:'重複'}];
const storage=new Map(),report={innerHTML:''},review={innerHTML:''};
const inputs=[...ids.map(student=>({dataset:{student},value:'0'})),{dataset:{student:'50521'},value:'777'},{dataset:{student:''},value:'999'}];
const calls=[],alerts=[];
const localStorage={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const context=vm.createContext({window:{},localStorage,sessionStorage:{getItem:()=>null},crypto:{randomUUID},alert:m=>alerts.push(m),document:{
  querySelectorAll:selector=>selector.includes('.admin-batch-value')?inputs:[],
  getElementById:id=>id==='adminBatchReviewV610'?review:id==='adminBatchResultV610'?report:null
}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8'),context);
context.records=records;
vm.runInContext("adminData={students:records,items:[{'道具ID':'STONE_GRASS','名稱':'草之石'}]};adminPassword='fixture';ADMIN_BATCH_ITEM_V610='STONE_GRASS';showAdminBatchLoadingV610=()=>{};hideAdminBatchLoadingV610=()=>{};renderAdminBatchV610=()=>{};",context);
const plain=value=>JSON.parse(JSON.stringify(value));
const run=source=>vm.runInContext(source,context);
async function main(){
  const snapshot=JSON.stringify(records);
  assert.deepEqual(plain(run('adminBatchStudentsV610().map(s=>s.id)')),ids);
  assert.equal(run("adminBatchStudentsV610().find(s=>s.id==='50526').name"),'老師測試');
  students[2].name=' \t\n';
  assert.equal(run('adminBatchStudentsV610().length'),24,'blank official name is excluded');
  assert.equal(run("adminBatchStudentsV610().some(s=>s.id==='50503')"),false);
  students[2].name='學生50503';
  assert.equal(JSON.stringify(records),snapshot,'normalization never changes source student records');
  context.gs=async(action,...args)=>{calls.push({action,args:plain(args)});const entries=action==='grantCoinsBatchV610'?args[1]:args[2];return {ok:true,successCount:999,results:entries.map(e=>({studentId:e.studentId,ok:true,amount:e.amount,quantity:e.quantity,coins:200}))};};
  for(const mode of ['COINS','ITEMS']){
    run(`ADMIN_BATCH_MODE_V610='${mode}';fillAdminBatchV610(${mode==='COINS'?100:5});previewAdminBatchV610();`);
    assert.deepEqual(plain(run('ADMIN_BATCH_PREVIEW_V610.entries.map(e=>e.studentId)')),ids);
    assert.equal(inputs.at(-2).value,'777','excluded row is not quick-filled');
    assert.equal(inputs.at(-1).value,'999');
    await context.submitAdminBatchV610();
    const sent=calls.at(-1),entries=mode==='COINS'?sent.args[1]:sent.args[2];
    assert.deepEqual(entries.map(e=>e.studentId),ids);
    assert.ok(entries.every(e=>e[mode==='COINS'?'amount':'quantity']===(mode==='COINS'?100:5)));
  }
  context.mixed={ok:true,successCount:999,failedCount:999,results:[{studentId:'50501',ok:true},{studentId:'50502',ok:false,reason:'fixture'},{studentId:'50501',ok:true},{studentId:'50521',ok:true},{studentId:'',ok:false}]};
  run('showAdminBatchResultV610(mixed)');
  assert.match(report.innerHTML,/成功 1 人／失敗 1 人／略過 0 人/);
  assert.ok(!report.innerHTML.includes('50521'));
  const pending={requestId:randomUUID(),mode:'COINS',entries:[{studentId:'50521',amount:100}],reason:'legacy pending'};
  const key='petHouseAdminBatchV610:'+pending.requestId;
  storage.set(key,JSON.stringify(pending));const original=storage.get(key),before=calls.length;
  await context.submitAdminBatchV610(pending.requestId);
  assert.equal(calls.length,before,'invalid legacy payload is not resubmitted or rewritten');
  assert.equal(storage.get(key),original,'original requestId/receipt is retained');
  assert.match(run('ADMIN_BATCH_RESULT_V610.message'),/有效名單以外/);
  assert.deepEqual(alerts,[]);
  const identity=rows=>rows.map(({coins,...row})=>row);
  assert.deepEqual(identity(records),identity(JSON.parse(snapshot)),'IDs, names and source rows remain intact; existing coin display cache updates are allowed');
  console.log('PASS shared batch roster: exact 25 IDs, 50521/invalid/empty/duplicate exclusion, blank names, test alias, quick fill, both API payloads, filtered statistics, immutable old pending request and untouched student data');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
