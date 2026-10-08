const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),credential='fixture-only-credential';
async function run(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [width,height] of [[1440,1000],[768,1024],[390,844]]){
   const context=await browser.newContext({viewport:{width,height}}),calls=[],receipts=new Map(),errors=[];
   const students=Array.from({length:25},(_,i)=>({id:'505'+String(i+1).padStart(2,'0'),seat:i+1,name:'學生'+(i+1),coins:1000}));
   const serverItems=new Map();let loseNext=false;
   await context.route('**/*',route=>{
    const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
    if(file==='config.js')return route.fulfill({contentType:'text/javascript',body:"window.API_URL='https://pet-house.test/mock-api';"});
    if(!['index.html','app.js','style.css'].includes(file)&&!file.startsWith('assets/'))return route.abort();
    const resolved=path.resolve(root,file);return resolved.startsWith(root+path.sep)&&fs.existsSync(resolved)?route.fulfill({path:resolved}):route.abort();
   });
   const setup=async page=>{
    page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('mockAdminAPI',async(action,args)=>{
     calls.push({action,args});assert.equal(args[0],credential);
     if(action==='getAdminDataSecure')return {students:students.map(s=>({...s})),items:[{'道具ID':'EXP010','名稱':'經驗糖果'},{'道具ID':'STONE_GRASS','名稱':'草之石'}],pets:[]};
     if(!['grantCoinsBatchV610','grantItemsBatchV610'].includes(action))throw Error('unexpected '+action);
     await new Promise(resolve=>setTimeout(resolve,60));
     const coins=action==='grantCoinsBatchV610',item=coins?'':args[1],entries=coins?args[1]:args[2],rid=coins?args[2]:args[3];
     if(receipts.has(rid))return {...receipts.get(rid),replayed:true};
     const results=entries.map(e=>{
      const n=e[coins?'amount':'quantity'];if(!n)return {studentId:e.studentId,ok:true,skipped:true};
      if(e.studentId==='50525')return {studentId:e.studentId,ok:false,reason:'測試學生暫停發放'};
      if(coins){const s=students.find(s=>s.id===e.studentId);s.coins+=n;return {studentId:e.studentId,ok:true,amount:n,coins:s.coins};}
      const key=e.studentId+':'+item,value=(serverItems.get(key)||0)+n;serverItems.set(key,value);return {studentId:e.studentId,ok:true,quantity:n,remainingQuantity:value};
     });
     const result={ok:true,requestId:rid,successCount:results.filter(r=>r.ok&&!r.skipped).length,failedCount:results.filter(r=>!r.ok).length,skippedCount:results.filter(r=>r.skipped).length,results};receipts.set(rid,result);
     if(loseNext){loseNext=false;throw Error('timeout after commit');}return result;
    });
    await page.goto('https://pet-house.test/');
    await page.evaluate(async pw=>{adminPassword=pw;window.alert=()=>{};gs=async(action,...args)=>mockAdminAPI(action,args);loginView.classList.add('hidden');adminView.classList.remove('hidden');await loadAdmin();},credential);
   };
   const page=await context.newPage();await setup(page);
   assert.equal(await page.locator('.admin-batch-value').count(),25);
   assert.equal(await page.locator('#adminBatchV610 tbody tr').first().locator('td').first().innerText(),'01');
   await page.getByRole('button',{name:'全班填入 100',exact:true}).click();
   await page.locator('.admin-batch-value[data-student="50502"]').fill('50');
   await page.getByRole('button',{name:'確認批次發放',exact:true}).click();
   assert.ok((await page.locator('#adminBatchReviewV610').innerText()).includes('50502：+50'));
   assert.equal(calls.filter(c=>c.action==='grantCoinsBatchV610').length,0,'preview sends no write API');
   await page.getByRole('button',{name:'確定發放',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'全班填入 100',exact:true}).isDisabled(),true);
   await page.evaluate(()=>submitAdminBatchV610());await page.waitForFunction(()=>!ADMIN_BATCH_BUSY_V610);
   assert.equal(calls.filter(c=>c.action==='grantCoinsBatchV610').length,1,'one API for 25 students + double-click guard');
   assert.equal(students[0].coins,1100);assert.equal(students[1].coins,1050);
   assert.ok((await page.locator('#adminBatchResultV610').innerText()).includes('成功 24 人／失敗 1 人'));assert.ok((await page.locator('#adminBatchResultV610').innerText()).includes('50525：❌'));
   await page.getByRole('button',{name:'批次發道具',exact:true}).click();await page.locator('#adminBatchItemV610').selectOption('STONE_GRASS');
   await page.getByRole('button',{name:'全班填入 5',exact:true}).click();await page.locator('.admin-batch-value[data-student="50502"]').fill('3');await page.locator('.admin-batch-value[data-student="50503"]').fill('0');
   await page.getByRole('button',{name:'確認批次發放',exact:true}).click();assert.ok((await page.locator('#adminBatchReviewV610').innerText()).includes('草之石'));
   await page.getByRole('button',{name:'確定發放',exact:true}).click();await page.waitForFunction(()=>!ADMIN_BATCH_BUSY_V610);
   assert.equal(calls.filter(c=>c.action==='grantItemsBatchV610').length,1);assert.equal(serverItems.get('50501:STONE_GRASS'),5);assert.equal(serverItems.get('50502:STONE_GRASS'),3);assert.equal(serverItems.has('50503:STONE_GRASS'),false);
   await page.getByRole('button',{name:'全部清空',exact:true}).click();assert.equal(await page.locator('.admin-batch-value').first().inputValue(),'');
   await page.getByRole('button',{name:'全班填入 1',exact:true}).click();await page.getByRole('button',{name:'確認批次發放',exact:true}).click();loseNext=true;
   await page.getByRole('button',{name:'確定發放',exact:true}).click();await page.waitForFunction(()=>!ADMIN_BATCH_BUSY_V610);
   const pending=await page.evaluate(()=>pendingAdminBatchClientV610());assert.equal(pending.length,1);assert.ok(!JSON.stringify(pending).includes(credential),'no password in persistent retry data');
   assert.equal(await page.getByRole('button',{name:'全班填入 1',exact:true}).isDisabled(),true);
   // A new tab sees the same durable request, including quantity and selected item.
   const tab=await context.newPage();await setup(tab);
   assert.equal(await tab.locator('.admin-batch-retry').count(),1);const before=serverItems.get('50501:STONE_GRASS');
   await tab.locator('.admin-batch-retry').click();await tab.waitForFunction(()=>!ADMIN_BATCH_BUSY_V610);
   assert.equal(serverItems.get('50501:STONE_GRASS'),before,'new-tab timeout retry never grants twice');
   const attempts=calls.filter(c=>c.action==='grantItemsBatchV610').slice(-2);assert.equal(attempts[0].args[3],attempts[1].args[3]);
   assert.equal(await tab.evaluate(()=>pendingAdminBatchClientV610().length),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'responsive teacher UI');
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS V6.1 teacher UI in Chrome desktop/tablet/phone: 25 seat/ID inputs, coin/item modes, quick fill/clear, custom/zero values, preview with no API, one API on confirm, busy guard, per-student results, durable timeout retry from another tab, no persisted teacher password.');
 }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
