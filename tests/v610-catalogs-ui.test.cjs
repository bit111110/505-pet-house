const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let requests=[],failSprite=false;
const image='<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#82b979"/></svg>';
const server=http.createServer((req,res)=>{
 const file=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';requests.push(file);
 if(file==='config.js'){res.setHeader('Content-Type','text/javascript');return res.end("window.API_URL='/mock-api';");}
 if(file.startsWith('assets/furniture/fixture-')){if(file.includes('missing')){res.writeHead(404);return res.end();}res.setHeader('Content-Type','image/svg+xml');res.setHeader('Cache-Control','public,max-age=3600');return res.end(image);}
 if(file==='assets/items/stones/attribute-stones.png'&&failSprite){res.writeHead(404);return res.end();}
 const resolved=path.resolve(root,file);if(!resolved.startsWith(root+path.sep)||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'text/html');
 res.setHeader('Cache-Control','public,max-age=3600');res.end(fs.readFileSync(resolved));
});
async function seed(page){
 await page.evaluate(()=>{
  window.calls=[];window.alert=()=>{};currentId='50501';currentTab='home';
  const codes=Object.keys(STONE_SPRITES_V610);
  inventory=codes.map((code,i)=>({itemId:'STONE_'+code,quantity:20,config:{名稱:STONE_ATTRIBUTES_V610[i]+'之石',類型:'屬性石'}}));
  state={pets:[{petId:'PET013',name:'草寵',level:30,stage:3,attribute:'草',landId:'SLOT001',exp:0,expNeed:0}],lands:[],backgrounds:[],activeLandId:'SLOT001',skillEnhancements:{}};
  PET_CONFIGS.PET013={stage1:'',stage2:'',stage3:''};PET_BATTLE_CONFIGS.PET013={attribute:'草'};
  STONE_CATALOG_V600=codes.map((code,i)=>({itemId:'STONE_'+code,attribute:STONE_ATTRIBUTES_V610[i],name:STONE_ATTRIBUTES_V610[i]+'之石',increment:'5'}));
  UPGRADE_AT_V600=Date.now();UPGRADE_READY_V600=true;
  gs=async(action,...args)=>{
   calls.push({action,args});
   if(window.delayFurniture&&action==='getFurnitureBySeriesV610')await new Promise(resolve=>window.releaseFurniture=resolve);
   if(action==='getFurnitureSeriesV610')return {ok:true,series:[{seriesId:'FOREST',name:'森林系列',previewImage:'assets/furniture/fixture-forest-preview.webp',itemCount:24},{seriesId:'OCEAN',name:'海洋系列',previewImage:'assets/furniture/fixture-ocean-preview.webp',itemCount:1}]};
   if(action==='getFurnitureBySeriesV610')return {ok:true,items:args[0]==='FOREST'?Array.from({length:24},(_,i)=>({furnitureId:'F'+i,seriesId:'FOREST',name:'森林家具'+i,thumbnail:'assets/furniture/fixture-'+(i===1?'missing-thumb':('thumb-'+i))+'.webp',image:'assets/furniture/fixture-'+(i===1?'missing-full':('full-'+i))+'.png',type:i%2?'浮空型':'地面型',price:100})): [{furnitureId:'O1',name:'海洋燈',type:'浮空型',price:20,thumbnail:'assets/furniture/fixture-ocean-thumb.webp',image:'assets/furniture/fixture-ocean-full.png'}]};
   throw Error('Unexpected Phase 3 API '+action);
  };
  loginView.classList.add('hidden');studentView.classList.remove('hidden');renderHome();switchMainMode('home');
 });
}
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [width,height] of [[1440,1000],[768,1024],[390,844]]){
   requests=[];const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await seed(page);
   assert.equal(requests.filter(x=>x.includes('attribute-stones')).length,0,'login does not preload stones');
   assert.equal(await page.evaluate(()=>calls.length),0,'no furniture APIs before visit');
   await page.evaluate(async()=>{currentTab='bag';await renderBag();});await page.waitForFunction(()=>STONE_IMAGE_STATE_V610==='ready');
   assert.equal(await page.locator('[data-stone-sprite]').count(),12);
   const mappings=await page.locator('[data-stone-sprite]').evaluateAll(elements=>elements.map(el=>({index:Number(el.dataset.stoneSprite),url:el.style.backgroundImage,size:getComputedStyle(el).backgroundSize,pos:el.style.backgroundPosition})));
   mappings.forEach((m,i)=>{assert.equal(m.index,i);assert.equal(m.size,'400% 300%');assert.equal(m.pos,`${Math.round(i%4*100/3*1e4)/1e4}% ${Math.floor(i/4)*50}%`);});
   assert.equal(new Set(mappings.map(m=>m.url)).size,1,'all 12 cells share one URL');
   await page.evaluate(async()=>{currentTab='upgrade';UPGRADE_MODE_V600='stone';switchMainMode('upgrade');await renderUpgrade();});
   assert.equal(await page.locator('#stoneModeContent>h3 [data-stone-sprite="3"]').count(),1,'upgrade renderer');
   await page.evaluate(()=>{mailbox=[{'信件ID':'m','標題':'石頭','附件ID':'STONE_WATER','附件名稱':'水之石','附件數量':2}];renderMailFromCache();});
   assert.equal(await page.locator('#panel [data-stone-sprite="4"]').count(),1,'mail renderer');
   await page.evaluate(()=>{adminArea.innerHTML='<div id="adminBatchV610"></div>';adminData={students:[],items:[{'道具ID':'STONE_FIRE','名稱':'火之石'}]};ADMIN_BATCH_MODE_V610='ITEMS';renderAdminBatchV610();});
   assert.equal(await page.locator('#adminItemPreviewV610 [data-stone-sprite="6"]').count(),1,'teacher renderer');
   assert.equal(requests.filter(x=>x==='assets/items/stones/attribute-stones.png').length,1,'one actual browser download across renderers');
   await page.evaluate(()=>switchTab('furniture',document.querySelector('[data-tab=furniture]')));await page.waitForSelector('.furniture-series-button');
   assert.deepEqual(await page.evaluate(()=>calls.map(c=>c.action)),['getFurnitureSeriesV610']);
   await page.waitForFunction(()=>document.querySelector('.furniture-series-button img')?.complete);
   assert.equal(requests.some(x=>x.includes('fixture-thumb')||x.includes('fixture-full')),false,'no series items/images before click');
   await page.locator('.furniture-series-button[data-series="FOREST"]').click();await page.waitForSelector('.furniture-preview-button');
   assert.equal(await page.evaluate(()=>calls.filter(c=>c.action==='getFurnitureBySeriesV610').length),1);
   assert.equal(await page.evaluate(()=>calls.at(-1).args[0]),'FOREST');
   assert.equal(requests.some(x=>x.includes('ocean-thumb')||x.includes('fixture-full')),false);
   assert.equal(requests.includes('assets/furniture/fixture-thumb-23.webp'),false,'offscreen thumbnails stay deferred');
   await page.waitForFunction(()=>!document.querySelector('.furniture-card:nth-child(2) img'));
   assert.equal(await page.locator('.furniture-card').nth(1).locator('.furniture-image-fallback').isVisible(),true,'missing thumbnail fallback');
   await page.locator('.furniture-preview-button').first().click();await page.waitForFunction(()=>document.querySelector('#furniturePreviewV610 img')?.complete);
   assert.equal(requests.includes('assets/furniture/fixture-full-0.png'),true,'original only after preview');
   await page.locator('.furniture-preview-button').nth(1).click();await page.waitForFunction(()=>!document.querySelector('#furniturePreviewV610 img'));
   assert.equal(await page.locator('#furniturePreviewV610 .furniture-image-fallback').isVisible(),true,'missing full asset fallback');
   await page.getByRole('button',{name:'返回系列',exact:true}).click();await page.waitForSelector('.furniture-series-button');
   await page.locator('.furniture-series-button[data-series="OCEAN"]').click();await page.waitForSelector('.furniture-preview-button');
   assert.equal(await page.evaluate(()=>calls.at(-1).args[0]),'OCEAN');
   await page.getByRole('button',{name:'返回系列',exact:true}).click();await page.waitForSelector('.furniture-series-button');
   await page.locator('.furniture-series-button[data-series="FOREST"]').click();await page.waitForSelector('.furniture-preview-button');
   assert.equal(await page.evaluate(()=>calls.filter(c=>c.action==='getFurnitureBySeriesV610').length),2,'return to forest cache');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'responsive furniture grid');
   if(process.env.CATALOG_SCREENSHOT_DIR){fs.mkdirSync(process.env.CATALOG_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CATALOG_SCREENSHOT_DIR,`furniture-${width}.png`),fullPage:false});}
   await page.evaluate(()=>switchTab('home',document.querySelector('[data-tab=home]')));
   assert.equal(await page.evaluate(()=>furnitureMain.childElementCount===0&&FURNITURE_OBSERVER_V610===null&&FURNITURE_VISIBILITY_V610===null),true,'navigation cleans DOM/observer/listeners');
   await page.evaluate(()=>{currentTab='furniture';switchMainMode('furniture');FURNITURE_CACHE_V610.bySeries={};window.delayFurniture=true;renderFurnitureV610('FOREST');});
   await page.waitForFunction(()=>typeof releaseFurniture==='function');await page.evaluate(()=>{switchTab('home',document.querySelector('[data-tab=home]'));releaseFurniture();});
   await page.waitForFunction(()=>!FURNITURE_CACHE_V610.loading['SERIES:FOREST']);
   assert.equal(await page.locator('#furnitureMain').innerHTML(),'','stale response cannot resurrect DOM');
   await page.evaluate(()=>{window.delayFurniture=false;currentTab='furniture';switchMainMode('furniture');renderFurnitureV610('',true);});await page.waitForSelector('.furniture-series-button');
   assert.equal(await page.evaluate(()=>calls.filter(c=>c.action==='getFurnitureSeriesV610').length),2,'manual refresh refetches metadata');
   await page.reload();await seed(page);await page.evaluate(()=>switchTab('furniture',document.querySelector('[data-tab=furniture]')));await page.waitForSelector('.furniture-series-button');
   assert.equal(await page.evaluate(()=>calls.length),0,'same-build persistent cache survives reload');
   assert.deepEqual(errors,[]);await context.close();
  }
  failSprite=true;requests=[];const page=await browser.newPage();await page.goto(url);await seed(page);await page.evaluate(async()=>{currentTab='bag';await renderBag();});await page.waitForFunction(()=>STONE_IMAGE_STATE_V610==='failed');
  assert.equal(await page.locator('.stone-item-sprite.sprite-ready').count(),0);assert.equal(await page.locator('.stone-item-sprite>span').first().isVisible(),true,'missing sprite has visible fallback');
  await page.evaluate(()=>activateStoneSpritesV610());assert.equal(requests.filter(x=>x==='assets/items/stones/attribute-stones.png').length,1,'failed sprite not repeatedly downloaded');await page.close();
  console.log('PASS Phase 3 Chrome desktop/tablet/phone: exact 12-cell mapping, one network sprite download, 4 shared renderers/fallback, no furniture preload, selected-series API and cache, visible-only thumbnails, explicit originals/fallback, persistent/manual-refresh cache, responsive layout, cleanup and stale response guard.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
