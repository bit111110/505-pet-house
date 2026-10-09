const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
async function run(){
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const [width,height] of [[1440,1000],[768,1024],[390,844]]){
      const page=await browser.newPage({viewport:{width,height}}),calls=[],errors=[];
      let complete=null;
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{
        const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
        if(file==='config.js')return route.fulfill({contentType:'text/javascript',body:"window.API_URL='https://pet-house.test/mock-api';"});
        const resolved=path.resolve(root,file);
        return resolved.startsWith(root+path.sep)&&fs.existsSync(resolved)?route.fulfill({path:resolved}):route.abort();
      });
      await page.exposeFunction('mockAdminEventsAPI',async(action,args)=>{
        calls.push({action,args});
        if(action==='adminLogin')return {ok:true};
        if(action==='getAdminDataSecure')return {
          students:[{id:'50501',seat:1,name:'學生1',coins:100},{id:'50502',seat:2,name:'學生2',coins:100}],
          items:[{'道具ID':'EXP010','名稱':'經驗糖果'},{'道具ID':'STONE_GRASS','名稱':'草之石'}],pets:[]
        };
        assert.ok(['grantCoinsBatchV610','grantItemsBatchV610'].includes(action));
        // The overlay and input lock must already exist when the API is invoked.
        assert.equal(await page.locator('#adminBatchLoadingV610').count(),1);
        assert.equal(await page.evaluate(()=>document.getElementById('adminView').inert),true);
        assert.equal(await page.locator('.admin-batch-value').first().isDisabled(),true);
        return new Promise((resolve,reject)=>{complete={resolve,reject};});
      });
      await page.clock.install();
      await page.goto('https://pet-house.test/');
      await page.evaluate(()=>{
        askAdminPassword=async()=>'fixture-only-credential';
        gs=(action,...args)=>mockAdminEventsAPI(action,args);
        window.modeClicks=0;
        const original=setAdminBatchModeV610;
        setAdminBatchModeV610=mode=>{modeClicks++;original(mode);};
      });
      const open=async()=>{
        await page.getByRole('button',{name:'老師後台',exact:true}).click();
        await page.locator('#adminBatchCoinsV610').waitFor({state:'visible'});
      };
      const switchMode=async mode=>{
        const before=await page.evaluate(()=>modeClicks);
        await page.locator(mode==='COINS'?'#adminBatchCoinsV610':'#adminBatchItemsV610').click();
        assert.equal(await page.evaluate(()=>modeClicks),before+1,'exactly one delegated listener');
        assert.equal(await page.locator('#adminBatchV610 [onclick],#adminBatchV610 [oninput],#adminBatchV610 [onchange]').count(),0);
      };
      const submit=async(mode,{retry=false,fail=false}={})=>{
        const writesBefore=calls.filter(c=>c.action.startsWith('grant')).length;
        if(!retry){
          await switchMode(mode);
          await page.getByRole('button',{name:mode==='COINS'?'全班填入 100':'全班填入 5',exact:true}).click();
          await page.locator('#adminBatchPreviewV610').click();
          assert.equal(calls.filter(c=>c.action.startsWith('grant')).length,writesBefore,'preview is not a write');
          await page.locator('#adminBatchSubmitV610').click();
        }else await page.locator('.admin-batch-retry').click();
        await page.locator('#adminBatchLoadingV610').waitFor({state:'visible'});
        await page.evaluate(()=>submitAdminBatchV610());
        for(let i=0;!complete&&i<100;i++)await new Promise(resolve=>setTimeout(resolve,10));
        assert.ok(complete,'delegated click reached API');
        assert.equal(calls.filter(c=>c.action.startsWith('grant')).length,writesBefore+1,'one API, no duplicate listener/write');
        await page.clock.fastForward(15001);
        assert.match(await page.locator('#adminBatchLoadingV610').innerText(),/仍在處理中，請稍候/);
        const reply=complete;complete=null;
        if(fail)reply.reject(new Error('fixture timeout'));
        else reply.resolve({ok:true,successCount:1,failedCount:1,results:[{studentId:'50501',ok:true,amount:100,quantity:5,coins:200},{studentId:'50502',ok:false,reason:'fixture failure'}]});
        await page.waitForFunction(()=>!ADMIN_BATCH_BUSY_V610);
        assert.equal(await page.locator('#adminBatchLoadingV610').count(),0);
        assert.equal(await page.evaluate(()=>document.getElementById('adminView').inert),false);
        assert.match(await page.locator('#adminBatchResultV610').innerText(),fail?/fixture timeout/:/成功 1 人／失敗 1 人/);
      };
      await open();await submit('COINS');
      // Replacing both the outer adminArea content and the inner batch card keeps the binding.
      await page.evaluate(async()=>{await loadAdmin();await loadAdmin();renderAdminBatchV610();renderAdminBatchV610();});
      assert.equal(await page.locator('#adminBatchCoinsV610').count(),1);
      await submit('ITEMS');
      await page.getByRole('button',{name:'回登入',exact:true}).click();await open();
      await submit('COINS',{fail:true});
      const pending=await page.evaluate(()=>pendingAdminBatchClientV610());assert.equal(pending.length,1);
      await page.clock.fastForward(30000);
      const originalWrite=calls.filter(c=>c.action==='grantCoinsBatchV610').at(-1);
      await page.evaluate(()=>loadAdmin());await submit('COINS',{retry:true});
      const retryWrite=calls.filter(c=>c.action==='grantCoinsBatchV610').at(-1);
      assert.equal(retryWrite.args[2],originalWrite.args[2],'same durable requestId after rerender');
      assert.equal(await page.evaluate(()=>pendingAdminBatchClientV610().length),0);
      assert.deepEqual(errors,[]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await page.close();
      console.log(`PASS ${width}px delegated teacher events: first open, outer/inner rerenders, return/reopen, coin/item overlay before API, one write, 15s hint, error cleanup, original requestId retry`);
    }
  }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
