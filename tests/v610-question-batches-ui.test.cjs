const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
async function run(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const [width,height] of [[1440,1000],[768,1024],[390,844]]){
  const page=await browser.newPage({viewport:{width,height}}),calls=[],images=[],errors=[];let release=null,active=0,maxActive=0,holdNext=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(file==='config.js')return route.fulfill({contentType:'text/javascript',body:"window.API_URL='https://pet-house.test/api';"});
   if(file.startsWith('assets/question-fixture/')){images.push(file);return route.abort();}
   const resolved=path.resolve(root,file);return resolved.startsWith(root+path.sep)&&fs.existsSync(resolved)?route.fulfill({path:resolved}):route.abort();
  });
  await page.exposeFunction('questionBatchFixture',async(subject,size,exclude)=>{
   calls.push({subject,size,exclude});active++;maxActive=Math.max(maxActive,active);
   if(calls.length===2||holdNext){holdNext=false;await new Promise(resolve=>{release=resolve;});}
   const all=Array.from({length:60},(_,i)=>({id:subject+'-'+i,subject,type:'選擇題',text:'分數 2/3',options:['2/3','1/3','1/2','3/4'],answer:'A',explanation:'測試',image:'assets/question-fixture/'+subject+'-'+i+'.png'}));
   const pool=all.filter(q=>!exclude.includes(q.id));active--;
   return {questions:pool.slice(0,size),total:60,remaining:Math.max(0,pool.length-size)};
  });
  await page.goto('https://pet-house.test/');
  await page.evaluate(()=>{
   currentId='50501';currentTab='challenge';state={pets:[{petId:'PET013',name:'草寵',level:30,stage:3,landId:'SLOT001'}],lands:[{土地ID:'SLOT001',config:{}}],activeLandId:'SLOT001',challengeStatus:{},skillEnhancements:{}};
   PET_CONFIGS.PET013={stage1:'',stage2:'',stage3:''};PET_BATTLE_CONFIGS={PET013:{attribute:'草',specialName:'專屬',specialDamage:150}};
   Object.assign(BATTLE_CONFIG_READY_V610,{monsters:true,backgrounds:true,pets:true});
   loginView.classList.add('hidden');studentView.classList.remove('hidden');window.alert=()=>{};
   gsRaw=gs=async(action,...args)=>{
    if(action==='getQuestionBatchV610')return questionBatchFixture(...args);
    if(action==='getBattleProgressV5105')return {exists:false};
    if(action==='syncChallengeBatch')return {ok:true,status:{...challenge.status}};
    throw Error('unexpected '+action);
   };
   renderChallengeHome();
  });
  assert.equal(calls.length,0,'home does not fetch any bank');
  await page.evaluate(()=>chooseChallenge('數學'));assert.equal(calls.length,1);assert.equal(calls[0].size,25);assert.equal(images.length,0,'batch metadata never downloads question images');
  await page.evaluate(()=>startChallengeUI());
  // Simulate the first 20 answers already consumed; prefetch must not lock the answer UI.
  await page.evaluate(()=>{challenge.seen=challenge.questions.slice(0,20).map(q=>q.id);challenge.qIndex=20;window.prefetchOne=prefetchBattleQuestionsV610();window.prefetchTwo=prefetchBattleQuestionsV610();});
  for(let i=0;!release&&i<100;i++)await new Promise(r=>setTimeout(r,10));assert.ok(release);assert.equal(calls.length,2);
  assert.equal(await page.evaluate(()=>prefetchOne===prefetchTwo),true,'one inflight prefetch');
  await page.locator('.skill-btn').first().click();assert.equal(await page.locator('#battleQuestionArea .option').count(),4);assert.equal(await page.locator('#battleQuestionArea .option').first().isEnabled(),true);
  const answered=await page.evaluate(()=>challenge.question.id);assert.ok(calls[1].exclude.includes(answered));
  await page.locator('#battleQuestionArea .option').first().click();await page.waitForFunction(()=>!challenge.answering);
  assert.equal(await page.evaluate(()=>challenge.status.correct),1);assert.equal(calls.length,2,'the current answer did not await or duplicate prefetch');
  release();release=null;await page.evaluate(()=>prefetchOne);
  const queue=await page.evaluate(()=>challenge.questions.slice(challenge.qIndex).map(q=>q.id));assert.equal(new Set(queue).size,queue.length);assert.ok(!queue.includes(answered));assert.equal(maxActive,1);
  assert.ok(images.length<=1,'only the displayed image was requested');
  // The last unseen page has 10 questions; only a fully consumed cycle may recycle.
  await page.evaluate(()=>{challenge.qIndex=challenge.questions.length;return loadMoreBattleQuestions();});
  assert.equal(calls.length,3);assert.equal(await page.evaluate(()=>challenge.questions.length),10);
  await page.evaluate(()=>{challenge.qIndex=challenge.questions.length;return loadMoreBattleQuestions();});
  assert.equal(calls.length,4);assert.equal(calls[3].exclude.length,0);
  // Background responses from a departed battle cannot write into its replacement view.
  holdNext=true;
  await page.evaluate(()=>{challenge.qIndex=challenge.questions.length-5;window.staleFetch=prefetchBattleQuestionsV610();});
  for(let i=0;!release&&i<100;i++)await new Promise(r=>setTimeout(r,10));assert.ok(release);
  await page.evaluate(()=>{switchTab('home');window.newSubject=chooseChallenge('英文');});
  assert.equal(active,1,'rapid subject switch never opens a second question request');
  release();release=null;await page.evaluate(()=>Promise.all([staleFetch,newSubject]));
  assert.equal(calls.at(-1).subject,'英文');assert.equal(maxActive,1);
  assert.equal(await page.locator('#chPet').count(),1,'old background response does not replace the new subject selection');
  await page.evaluate(()=>switchTab('home'));assert.equal(await page.locator('#battleMain').innerHTML(),'');
  const records=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('petHouseQuestion')));assert.deepEqual(records,[],'no persistent/full-bank cache');
  assert.deepEqual(errors,[]);await page.close();console.log('PASS Phase 5 '+width+'px: selected subject 25, zero home fetch, 5-question background threshold, one prefetch, interactive answer, no duplicates until exhaustion, small-bank cycle, displayed-only images, stale cancellation');
 }}finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
