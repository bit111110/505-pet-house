const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'apps-script/Code.gs'),'utf8');
assert.equal(backend.replace(/\r\n/g,'\n'),execFileSync('git',['show','HEAD:apps-script/Code.gs'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'),'no backend/drop/schema changes');
const output=process.env.BATTLE_SCREENSHOT_DIR;
async function fixture(page){
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url()),file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
   if(file==='config.js')return route.fulfill({contentType:'text/javascript',body:"window.API_URL='http://pet-house.test/mock-api';"});
   if(!['index.html','app.js','style.css'].includes(file)&&!file.startsWith('assets/'))return route.abort();
   const resolved=path.resolve(root,file);if(!resolved.startsWith(root+path.sep)||!fs.existsSync(resolved))return route.abort();
   return route.fulfill({path:resolved});
 });
 await page.goto('http://pet-house.test/');
 await page.evaluate(()=>{
   window.testCalls=[];window.alert=()=>{};window.confirm=()=>true;
   gsRaw=gs=async(action,...args)=>{
     testCalls.push({action,args});
     if(action==='syncChallengeBatch')return {status:{...challenge.status}};
     if(action==='saveBattleProgressV5105')return {ok:true};
     if(action==='getBattleProgressV5105')return {exists:false};
     throw Error('unexpected API '+action);
   };
   currentId='50501';currentTab='challenge';mainMode='home';
   state={student:{id:currentId,name:'UI測試'},pets:[{petId:'PET013',name:'測試草寵',level:30,stage:3,attr:'草',landId:'SLOT001'}],lands:[{'土地ID':'SLOT001',config:{}}],activeLandId:'SLOT001',challengeStatus:{},skillEnhancements:{PET013:{'ATTR-草-25':'20'}}};
   PET_CONFIGS['PET013']={stage1:'assets/pets/PET013_1.png',stage2:'assets/pets/PET013_2.png',stage3:'assets/pets/PET013_3.png'};
   PET_BATTLE_CONFIGS={PET013:{petId:'PET013',attribute:'草',specialName:'永恆森林',specialDamage:150}};
   const qs=Array.from({length:40},(_,i)=>({id:'Q'+i,type:'選擇',text:'下列何者為正確答案？ 2/3',options:['正確選項','第二選項','第三選項','第四選項'],answer:'A',explanation:'測試解析',image:'assets/math/IMG001.png'}));
   QUESTION_BANK_CACHE['數學']=qs;QUESTION_BANK_LOADED['數學']=true;
   challenge={subject:'數學',petId:'PET013',active:true,questions:qs,qIndex:0,question:null,selectedSkill:null,status:{correct:0,wrong:0,exp:0,locked:false},pending:[],seen:[],monsterNo:3,monsterMaxHp:500,monsterHp:400,monsterCfg:{name:'訓練怪物',image:'',baseHp:500,hpGrowth:0},lastMsg:'',saving:false};
   loginView.classList.add('hidden');studentView.classList.remove('hidden');
   switchMainMode('battle');
 });
}
async function run(){
 const browser=await chromium.launch({channel:process.env.BATTLE_BROWSER_CHANNEL||'chrome',headless:true});
 const failures=[];
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['phone',390,844]]){
   const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>failures.push(e.message));await fixture(page);
   assert.equal(await page.locator('#studentSidebar').count(),1);assert.equal(await page.locator('#studentSidebar').isVisible(),false);
   assert.equal(await page.locator('#battlePetSprite').count(),1);assert.equal(await page.locator('#battleMonsterSprite').count(),1);
   assert.ok((await page.locator('.battle-status').innerText()).includes('怪物 3'));
   assert.ok((await page.locator('.battle-monster-side').innerText()).includes('HP 400 / 500'));
   const skill=page.locator('.skill-btn').filter({hasText:'萬木甦醒'});
   assert.ok((await skill.innerText()).includes('威力 125（強化 +20）'));
   await skill.click();
   assert.equal(await page.locator('#battleQuestionArea .option').count(),4);
   assert.equal(await page.locator('#battleQuestionArea .question-image').count(),1);
   assert.equal(await page.locator('.question-overlay,.modal').count(),0,'question is fixed lower UI');
   const stage=await page.locator('#battleScene').boundingBox(),controls=await page.locator('#battleControls').boundingBox();
   assert.ok(controls.y>=stage.y+stage.height-1,'controls below stage');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,name+' has no horizontal overflow');
   if(output){await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(60);fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'battle-'+name+'.png'),fullPage:true});}
   await page.evaluate(()=>{window.answerPromise=sendBattleAnswer('A');sendBattleAnswer('B');});
   await page.waitForFunction(()=>!challenge.answering);
   assert.equal(await page.evaluate(()=>challenge.monsterHp),275,'final stone damage applies');
   assert.equal(await page.evaluate(()=>challenge.status.correct),1,'double submit counted once');
   assert.equal(await page.evaluate(()=>challenge.status.exp),1,'EXP unchanged');
   assert.ok((await page.locator('#battleResult').innerText()).includes('125'));
   // Existing formats: fill-in, true/false, fractions retain normAns and formatMathText.
   await page.evaluate(()=>{challenge.questions[challenge.qIndex]={id:'F',type:'填充',text:'填入 2/3',answer:'2/3',options:[]};useBattleSkill('GEN-3');});
   assert.equal(await page.locator('#fillAns').count(),1);
   await page.evaluate(()=>{challenge.question={id:'T',type:'是非',text:'判斷',answer:'A'};renderBattleQuestion();});
   assert.equal(await page.locator('#battleQuestionArea .option').count(),2);
   // Animation and in-flight answer cannot rebuild DOM after navigation.
   await page.evaluate(()=>{challenge.monsterHp=400;window.pendingAnswer=sendBattleAnswer('A');switchTab('home',document.querySelector('[data-tab=home]'));});
   await page.evaluate(()=>pendingAnswer);
   assert.equal(await page.locator('#battleMain').innerHTML(),'');
   assert.deepEqual(await page.evaluate(()=>[BATTLE_TIMERS_V600.size,BATTLE_ANIMATIONS_V600.size]),[0,0]);
   await page.evaluate(()=>showBattleModeV600_());assert.equal(await page.locator('#battlePetSprite').count(),1);
   // A pending response from saved-progress lookup must not reopen the battle after switching away.
   await page.evaluate(()=>{renderChallengeHome();ensureBattleConfigsV5106=async()=>{};gsRaw=async action=>action==='getBattleProgressV5105'?new Promise(resolve=>window.releaseLookup=resolve):{};window.lookup=chooseChallenge('數學');});
   await page.waitForFunction(()=>typeof releaseLookup==='function');
   await page.evaluate(()=>{switchTab('home');releaseLookup({exists:true,petId:'PET013'});});await page.evaluate(()=>lookup);
   assert.equal(await page.locator('#battleMain').innerHTML(),'');
   // Cold question-bank loading does not replace the subject-selection view mid-request.
   await page.evaluate(()=>{renderChallengeHome();delete QUESTION_BANK_LOADED['自然'];delete QUESTION_BANK_CACHE['自然'];gsRaw=async action=>action==='getQuestionBankSubjectFast'?[{id:'N1',type:'選擇',text:'自然題',options:['甲','乙'],answer:'A'}]:{exists:false};});
   await page.evaluate(()=>chooseChallenge('自然'));assert.equal(await page.locator('#chPet').count(),1,'cold bank selection completed');
   await page.evaluate(()=>startChallengeUI());assert.equal(await page.locator('#battlePetSprite').count(),1,'cold bank battle started');
   // V5.10.5 resume restores all persisted fields, including saved maximum HP.
   await page.evaluate(()=>{renderChallengeHome();challenge.savedProgress={exists:true,subject:'數學',petId:'PET013',monsterNo:9,monsterMaxHp:777,monsterHp:432,seen:['Q1','Q2']};});
   await page.evaluate(()=>resumeSavedChallengeV5105());
   assert.deepEqual(await page.evaluate(()=>({subject:challenge.subject,petId:challenge.petId,no:challenge.monsterNo,hp:challenge.monsterHp,max:challenge.monsterMaxHp,seen:challenge.seen})),{subject:'數學',petId:'PET013',no:9,hp:432,max:777,seen:['Q1','Q2']});
   assert.equal(await page.evaluate(()=>challenge.questions.some(q=>['Q1','Q2'].includes(q.id))),false,'seen questions excluded');
   // Wrong answer at third error locks skills while preserving 30% damage and answer sync.
   await page.evaluate(()=>{gs=gsRaw=async(action,...args)=>{testCalls.push({action,args});return action==='syncChallengeBatch'?{status:{...challenge.status}}:{ok:true};};challenge.status.wrong=2;useBattleSkill('ATTR-草-25');window.lockAnswer=sendBattleAnswer('B');});
   await page.evaluate(()=>lockAnswer);
   assert.equal(await page.evaluate(()=>challenge.status.wrong),3);assert.equal(await page.evaluate(()=>challenge.status.locked),true);
   assert.equal(await page.evaluate(()=>challenge.monsterHp),394,'wrong answer 30% of 125 rounds to 38');
   assert.equal(await page.locator('.skill-btn').count(),0);assert.ok((await page.locator('#battleControls').innerText()).includes('今日對戰結束'));
   assert.ok(await page.evaluate(()=>testCalls.some(c=>c.action==='syncChallengeBatch')));
   // Save uses existing API/payload and returns to clean challenge home.
   await page.evaluate(()=>{challenge.status={correct:1,wrong:0,exp:1};state.challengeStatus={};challenge.monsterHp=432;challenge.monsterMaxHp=777;challenge.seen=['Q1','Q2'];challenge.active=true;renderBattle();});
   await page.locator('.battle-exit-actions .btn').filter({hasText:'儲存並離開'}).click();
   await page.waitForFunction(()=>!challenge.saving);
   const saved=await page.evaluate(()=>testCalls.findLast(c=>c.action==='saveBattleProgressV5105'));
   assert.deepEqual(saved.args,['50501',{subject:'數學',petId:'PET013',monsterNo:9,monsterHp:432,monsterMaxHp:777,seen:['Q1','Q2']}]);
   assert.equal(await page.locator('#battlePetSprite').count(),0);
   await page.evaluate(()=>{STUDENT_TOKEN_V600='test';gs=async()=>({ok:true,pets:state.pets,inventory:[],skillEnhancements:state.skillEnhancements,petBattleConfigs:Object.values(PET_BATTLE_CONFIGS),stones:[],ready:true});switchTab('upgrade',document.querySelector('[data-tab=upgrade]'));});
   await page.waitForSelector('#upgradeMain .upgrade-heading');
   assert.equal(await page.locator('#battleMain').innerHTML(),'');assert.deepEqual(await page.evaluate(()=>[BATTLE_TIMERS_V600.size,BATTLE_ANIMATIONS_V600.size]),[0,0]);
   await page.close();
  }
  assert.deepEqual(failures,[],'no browser JavaScript errors');
  console.log('PASS V6.0 battle UI: real Chrome desktop/tablet/phone layout, fixed questions and image, all question types, boosted final damage, EXP/double-submit guard, 3-error lock, V5.10.5 save/resume and seen list, late lookup cancellation, animation/DOM cleanup, unchanged backend.');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
