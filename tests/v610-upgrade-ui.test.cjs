const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
async function run(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [width,height] of [[1440,1000],[768,1024],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
    if(file==='config.js')return route.fulfill({contentType:'text/javascript',body:"window.API_URL='https://pet-house.test/mock-api';"});
    if(!['index.html','app.js','style.css'].includes(file)&&!file.startsWith('assets/'))return route.abort();
    const resolved=path.resolve(root,file);return resolved.startsWith(root+path.sep)&&fs.existsSync(resolved)?route.fulfill({path:resolved}):route.abort();
   });
   await page.goto('https://pet-house.test/');
   await page.evaluate(async()=>{
    window.calls=[];window.confirmText='';window.confirm=text=>{confirmText=text;return true;};window.alert=()=>{};
    currentId='50501';STUDENT_TOKEN_V600='test';currentTab='upgrade';UPGRADE_MODE_V600='stone';
    state={pets:[{petId:'PET013',name:'測試草寵',level:30,stage:3,attribute:'草'}],lands:[],skillEnhancements:{PET013:{'ATTR-草-10':'20'}}};
    PET_CONFIGS.PET013={stage1:'',stage2:'',stage3:''};
    window.server={quantity:30,bonus:20n,receipts:{}};
    gs=async(action,...args)=>{
     calls.push({action,args});
     if(action==='getUpgradeBundleV600')return {ok:true,pets:state.pets,inventory:[{itemId:'STONE_GRASS',quantity:server.quantity,config:{類型:'屬性石'}}],petBattleConfigs:[{petId:'PET013',attribute:'草'}],skillEnhancements:{PET013:{'ATTR-草-10':server.bonus.toString()}},stones:[{attribute:'草',itemId:'STONE_GRASS',name:'草之石',increment:'5'}],ready:true};
     if(action!=='useAttributeStonesBatchV610')throw Error('unexpected API '+action);
     await new Promise(resolve=>setTimeout(resolve,40));
     const [id,petId,skillId,itemId,q,requestId]=args;
     if(server.receipts[requestId])return {...server.receipts[requestId],replayed:true};
     const used=q==='ALL'?server.quantity:Number(q);server.quantity-=used;server.bonus+=BigInt(used)*5n;
     const result={ok:true,petId,skillId,itemId,requestId,usedQuantity:used,remainingStone:server.quantity,addedDamage:String(used*5),totalBonus:server.bonus.toString(),finalDamage:(45n+server.bonus).toString()};server.receipts[requestId]=result;
     if(window.loseNext){loseNext=false;throw Error('timeout after commit');}return result;
    };
    loginView.classList.add('hidden');studentView.classList.remove('hidden');switchMainMode('upgrade');await renderUpgrade();
    window.originalHeading=upgradeMain.firstElementChild;window.originalCard=document.querySelector('.upgrade-skill');
    window.originalButton=document.querySelector('[data-stone-bonus="ATTR-草-10"]').closest('.upgrade-skill').querySelector('button');
   });
   const card=page.locator('.upgrade-skill').filter({hasText:'森林之息'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'responsive upgrade controls');
   for(const q of [1,5,10]){
    const before=await page.evaluate(()=>calls.filter(c=>c.action==='useAttributeStonesBatchV610').length);
    const button=card.locator(`[data-stone-quantity="${q}"]`);await button.click();
    assert.equal(await button.isDisabled(),true,'busy guard');
    await page.evaluate(()=>useStoneV600('ATTR-草-10',10));
    await page.waitForFunction(()=>!STONE_BUSY_V600);
    assert.equal(await page.evaluate(()=>calls.filter(c=>c.action==='useAttributeStonesBatchV610').length),before+1);
    assert.ok((await page.evaluate(()=>confirmText)).includes('草之石 ×'+q));
    assert.ok((await page.evaluate(()=>confirmText)).includes('森林之息'));
    assert.equal(await page.evaluate(()=>originalHeading===upgradeMain.firstElementChild&&originalCard===document.querySelector('.upgrade-skill')&&originalButton===document.querySelector('[data-stone-bonus="ATTR-草-10"]').closest('.upgrade-skill').querySelector('button')),true,'nodes retained');
    assert.equal(await card.locator('[data-stone-final]').innerText(),await page.evaluate(()=>(45n+server.bonus).toString()));
   }
   await page.evaluate(()=>window.loseNext=true);await card.locator('[data-stone-quantity="1"]').click();await page.waitForFunction(()=>!STONE_BUSY_V600);
   const pending=await page.evaluate(()=>readStonePendingV600());assert.equal(pending.quantity,1);assert.equal(pending.batch,true);
   assert.equal(await page.locator('#stoneRetryV610').isVisible(),true);
   const stock=await page.evaluate(()=>server.quantity);await page.locator('.stone-retry').click();await page.waitForFunction(()=>!STONE_BUSY_V600);
   assert.equal(await page.evaluate(()=>server.quantity),stock,'timeout retry does not debit again');
   assert.equal(await page.evaluate(()=>readStonePendingV600()),null);
   const mutations=await page.evaluate(()=>calls.filter(c=>c.action==='useAttributeStonesBatchV610').slice(-2));assert.equal(mutations[0].args[5],mutations[1].args[5]);
   await card.locator('[data-stone-quantity="ALL"]').click();await page.waitForFunction(()=>!STONE_BUSY_V600);
   assert.equal(await page.evaluate(()=>inventoryQty('STONE_GRASS')),0);
   assert.equal(await card.locator('[data-stone-quantity="1"]').isDisabled(),true);
   assert.ok((await page.locator('.stone-balance').innerText()).includes('持有 0 顆'));
   assert.equal(await page.evaluate(()=>calls.filter(c=>c.action==='getUpgradeBundleV600').length),1,'no post-mutation bundle fetch');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS V6.1 real Chrome desktop/tablet/phone: 1/5/10/ALL confirmation, one API per operation, busy guard, timeout requestId recovery, zero-stock disabling, local span updates without page/node rebuild or bundle refresh.');
 }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
