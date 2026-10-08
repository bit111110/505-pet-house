const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');
const baseline=execFileSync('git',['show','e40a2e3:app.js'],{encoding:'utf8'});
let source=baseline;const network=[];
const server=http.createServer((req,res)=>{
 const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';network.push(file);
 if(file==='app.js'){res.setHeader('Content-Type','text/javascript');return res.end(source);}
 if(file==='config.js'){res.setHeader('Content-Type','text/javascript');return res.end("window.API_URL='/mock-api';");}
 if(file.startsWith('assets/battle-benchmark/')){res.setHeader('Cache-Control','public,max-age=3600');res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="60" fill="#82b979"/></svg>');}
 const absolute=path.resolve(root,file);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'text/html');res.setHeader('Cache-Control','public,max-age=3600');res.end(fs.readFileSync(absolute));
});
async function fixture(page,url){
 await page.goto(url);await page.evaluate(()=>{
  window.alert=()=>{};window.confirm=()=>true;window.calls=[];currentId='50501';currentTab='challenge';
  state={pets:[{petId:'PET013',name:'草寵',level:30,stage:3,landId:'SLOT001'}],lands:[{土地ID:'SLOT001',config:{}}],activeLandId:'SLOT001',challengeStatus:{},skillEnhancements:{PET013:{'ATTR-草-25':'20'}}};
  PET_CONFIGS.PET013={stage1:'assets/battle-benchmark/pet.png',stage2:'assets/battle-benchmark/pet.png',stage3:'assets/battle-benchmark/pet.png'};
  Object.keys(QUESTION_BANK_CACHE).forEach(key=>delete QUESTION_BANK_CACHE[key]);Object.keys(QUESTION_BANK_LOADED).forEach(key=>delete QUESTION_BANK_LOADED[key]);MONSTER_LIST=[];BATTLE_BG_LIST=[];PET_BATTLE_CONFIGS={};
  gs=gsRaw=async(action,...args)=>{
   calls.push({action,args});await new Promise(resolve=>setTimeout(resolve,100));
   if(action==='getQuestionBankSubjectFast')return Array.from({length:60},(_,i)=>({id:'Q'+i,type:'選擇',text:'分數 2/3',options:['甲','乙','丙','丁'],answer:'A'}));
   if(action==='getMonsterCatalogFresh')return [{monsterId:'M1',name:'測試怪物',image:'assets/battle-benchmark/monster.png',baseHp:10000,hpGrowth:0,enabled:true,subject:'全部'}];
   if(action==='getBattleBackgroundCatalogFast')return [{image:'assets/battle-benchmark/background.png',subject:'全部',enabled:true}];
   if(action==='getPetBattleConfigFast')return [{petId:'PET013',attribute:'草',specialName:'永恆森林',specialDamage:150}];
   if(action==='getBattleProgressV5105')return {exists:false};
   if(action==='syncChallengeBatch')return {ok:true,status:{...challenge.status}};
   if(action==='saveBattleProgressV5105')return {ok:true};
   throw Error('unexpected API '+action);
  };
  loginView.classList.add('hidden');studentView.classList.remove('hidden');renderChallengeHome();
  window.metrics={fullStage:0,fullControls:0,rootRenders:0,imageNodes:0,srcSets:0,storageCalls:0,storageMs:0,skillComputations:0};
  const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(Element.prototype,'innerHTML',{get:html.get,set(value){if(this.id==='battleScene')metrics.fullStage++;if(this.id==='battleControls')metrics.fullControls++;if(this.id==='battleMain')metrics.rootRenders++;return html.set.call(this,value);},configurable:true});
  const src=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{get:src.get,set(value){if(this.closest('#battleMain'))metrics.srcSets++;return src.set.call(this,value);},configurable:true});
  new MutationObserver(entries=>entries.forEach(entry=>entry.addedNodes.forEach(node=>{if(node.nodeType===1)metrics.imageNodes+=(node.matches('img')?1:0)+node.querySelectorAll('img').length;}))).observe(battleMain,{subtree:true,childList:true});
  for(const name of ['getItem','setItem','removeItem','key']){const fn=Storage.prototype[name];Storage.prototype[name]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{metrics.storageCalls++;metrics.storageMs+=performance.now()-start;}};}
  const skills=getConfiguredPetSkills;getConfiguredPetSkills=function(...args){metrics.skillComputations++;return skills(...args);};
 });
}
async function measure(browser,url,optimized,width,height){
 source=optimized?fs.readFileSync(path.join(root,'app.js'),'utf8'):baseline;network.length=0;
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page,url);
 const init=await page.evaluate(async()=>{const t=performance.now();await chooseChallenge('數學');const entered=performance.now()-t;await startChallengeUI();const first=performance.now();useBattleSkill('ATTR-草-25');return {entryMs:entered,firstQuestionMs:performance.now()-t,skillToQuestionMs:performance.now()-first,api:calls.length,configs:calls.filter(c=>['getMonsterCatalogFresh','getBattleBackgroundCatalogFast','getPetBattleConfigFast'].includes(c.action)).length};});
 assert.equal(init.api,5);assert.equal(init.configs,3);assert.equal(await page.locator('#battleQuestionArea .option').count(),4);
 await page.evaluate(async()=>{cancelBattleSkillV600_();await Promise.resolve();window.stageNode=battlePetSprite;window.skillNode=document.querySelector('.skill-btn');for(const key of Object.keys(metrics))metrics[key]=0;calls=[];});
 const attacks=[];
 for(const id of ['GEN-3','ATTR-草-25','SPECIAL-PET013','ATTR-草-1']){
  const result=await page.evaluate(async skill=>{const start=performance.now();useBattleSkill(skill);const questionMs=performance.now()-start,answerStart=performance.now();const promise=sendBattleAnswer('A');const animationMs=performance.now()-answerStart;const animated=battlePetSprite.classList.contains('attack-lunge')&&battlePetSprite.getAnimations().some(a=>a.playState==='running');await promise;return {questionMs,animationMs,nextMs:performance.now()-answerStart,animated};},id);attacks.push(result);assert.equal(result.animated,true);
 }
 // Twelfth answer triggers one background batch, never one request per stone/skill/question.
 await page.evaluate(()=>{for(let i=0;i<7;i++)challenge.pending.push({questionId:'Q0',answer:'A'});});
 await page.evaluate(async()=>{useBattleSkill('GEN-3');await sendBattleAnswer('A');if(challenge.syncing)await challenge.syncing;});
 const summary=await page.evaluate(()=>({...metrics,api:calls.filter(c=>c.action==='syncChallengeBatch').length,otherAPIs:calls.filter(c=>c.action!=='syncChallengeBatch').map(c=>c.action),stageRetained:stageNode===battlePetSprite,skillRetained:skillNode===document.querySelector('.skill-btn'),bonus:Number(challenge.monsterMaxHp)-Number(challenge.monsterHp)}));
 assert.equal(summary.api,1);assert.deepEqual(summary.otherAPIs,[]);assert.equal(summary.bonus,345,'25 +125 +150 +20 +25 unchanged');
 if(optimized){assert.equal(summary.fullStage,0);assert.equal(summary.fullControls,0);assert.equal(summary.imageNodes,0);assert.equal(summary.srcSets,0);assert.equal(summary.stageRetained,true);assert.equal(summary.skillRetained,true);assert.equal(summary.skillComputations,0);}
 else{assert.ok(summary.fullStage>=10);assert.ok(summary.fullControls>=10);assert.equal(summary.stageRetained,false);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 // Defeating multiple monsters changes HP/name without destroying pet or skills.
 for(let i=0;i<3;i++)await page.evaluate(async()=>{challenge.monsterHp=1;useBattleSkill('GEN-3');await sendBattleAnswer('A');});
 assert.equal(await page.evaluate(()=>challenge.monsterNo),4);
 if(optimized)assert.equal(await page.evaluate(()=>stageNode===battlePetSprite&&skillNode===document.querySelector('.skill-btn')),true);
 // Leave flushes outstanding answers; re-entry still restores the unchanged save fields.
 await page.evaluate(()=>switchTab('home',document.querySelector('[data-tab=home]')));
 assert.equal(await page.locator('#battleMain').innerHTML(),'');assert.deepEqual(await page.evaluate(()=>[BATTLE_TIMERS_V600.size,BATTLE_ANIMATIONS_V600.size]),[0,0]);
 await page.evaluate(async()=>{if(challenge.syncing)await challenge.syncing;await chooseChallenge('數學');challenge.savedProgress={exists:true,subject:'數學',petId:'PET013',monsterNo:9,monsterMaxHp:777,monsterHp:432,seen:['Q1','Q2']};await resumeSavedChallengeV5105();});
 assert.deepEqual(await page.evaluate(()=>[challenge.monsterNo,challenge.monsterHp,challenge.monsterMaxHp,challenge.seen]),[9,432,777,['Q1','Q2']]);
 if(optimized){
  // Confirm successful empty catalogs do not refetch on every subject entry.
  await page.evaluate(async()=>{BATTLE_BG_LIST=[];BATTLE_CONFIG_READY_V610.backgrounds=false;gsRaw=async(action)=>{calls.push({action});return [];};await ensureBattleConfigsV5106();const count=calls.length;await ensureBattleConfigsV5106();if(calls.length!==count)throw Error('empty catalog refetched');});
 }
 assert.deepEqual(errors,[]);
 const images=network.filter(x=>x.startsWith('assets/battle-benchmark/'));assert.equal(new Set(images).size,3);assert.equal(images.length,3,'real browser cached each combat asset once');
 await context.close();return {width,init,attacks,summary,imageDownloads:images.length};
}
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true}),url='http://127.0.0.1:'+server.address().port+'/';
 try{
  const results=[];for(const [width,height] of [[1440,1000],[768,1024],[390,844]]){const before=await measure(browser,url,false,width,height),after=await measure(browser,url,true,width,height);assert.ok(after.init.entryMs<before.init.entryMs*.8,'parallel cold initialization');results.push({before,after});}
  console.log('BATTLE_UI '+JSON.stringify(results));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
