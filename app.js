const FRONTEND_BUILD='20261004-1605';
const BUILTIN_LAND_BACKGROUNDS = {
  'LAND001': 'assets/maps/grassland.png',
  'LAND002': 'assets/maps/forest.png',
  'LAND003': 'assets/maps/beach.png',
  'LAND004': 'assets/maps/snowfield.png'

};

let PET_CONFIGS = {};
let LAND_CONFIGS = {};
let STATIC_PETS = [];
let STATIC_LANDS = [];

async function loadStaticGameData(){
  try{
    const [pets,lands]=await Promise.all([
      fetch('data/pets.json?v=' + FRONTEND_BUILD,{cache:'force-cache'}).then(r=>{
        if(!r.ok)throw new Error('pets.json '+r.status);
        return r.json();
      }),
      fetch('data/lands.json?v=' + FRONTEND_BUILD,{cache:'force-cache'}).then(r=>{
        if(!r.ok)throw new Error('lands.json '+r.status);
        return r.json();
      })
    ]);
    STATIC_PETS=Array.isArray(pets)?pets:[];
    STATIC_LANDS=Array.isArray(lands)?lands:[];
    PET_CONFIGS=Object.fromEntries(STATIC_PETS.map(p=>[String(p.petId),p]));
    LAND_CONFIGS=Object.fromEntries(STATIC_LANDS.map(l=>[String(l.landId),l]));
    return true;
  }catch(err){
    console.warn('GitHub 固定資料載入失敗，改用 Apps Script 回傳資料。',err);
    PET_CONFIGS={}; LAND_CONFIGS={}; STATIC_PETS=[]; STATIC_LANDS=[];
    return false;
  }
}
const STATIC_DATA_READY=loadStaticGameData();

function getPetImage(petId,stage){
  const cfg=PET_CONFIGS[String(petId)];
  if(!cfg)return '';
  const s=Number(stage||1);
  return s>=3?(cfg.stage3||''):(s===2?(cfg.stage2||''):(cfg.stage1||''));
}

function applyStaticConfigsToState(s){
  if(!s)return s;

  if(Array.isArray(s.pets)){
    s.pets=s.pets.map(p=>{
      const cfg=PET_CONFIGS[String(p.petId)]||null;
      if(!cfg)return p;
      return {
        ...p,
        name:cfg.name||p.name||p.petId,
        image:getPetImage(p.petId,p.stage)||p.image||'',
        movementType:cfg.moveType||p.movementType||'地面型',
        dialogs:(Array.isArray(cfg.dialogues)&&cfg.dialogues.length)
          ? cfg.dialogues
          : (Array.isArray(p.dialogs)&&p.dialogs.length?p.dialogs:['今天也一起努力吧！','我喜歡這裡～','一起變強吧！'])
      };
    });
  }

  if(Array.isArray(s.lands)){
    s.lands=s.lands.map(l=>{
      const id=String(l['土地ID']||l.landId||'');
      const cfg=LAND_CONFIGS[id]||null;
      if(!cfg)return l;
      return {
        ...l,
        config:{
          ...(l.config||{}),
          '土地ID':cfg.landId,
          '名稱':cfg.name,
          '價格':cfg.price,
          '背景圖片':cfg.background,
          '寬度':cfg.width,
          '高度':cfg.height,
          '是否開放':cfg.enabled
        }
      };
    });
  }
  return s;
}

function getLandShopRows(){
  if(STATIC_LANDS.length){
    return STATIC_LANDS.filter(l=>l.enabled!==false).map(l=>({
      '土地ID':l.landId,
      '名稱':l.name,
      '價格':Number(l.price||0),
      '背景圖片':l.background,
      '寬度':l.width,
      '高度':l.height,
      '是否開放':l.enabled
    }));
  }
  return Array.isArray(shop?.lands)?shop.lands:[];
}

let currentId='' '',state=null,currentTab='home',wanderTimer=null,inventory=[],mailbox=[],shop=null,adminData=null,challenge={subject:'',petId:'',question:null};
let mailboxLoaded=false,mailboxAt=0,mailRefreshPromise=null,backgroundMailTimer=null;
const CLIENT_CACHE={shop:null,shopAt:0,inventory:null,inventoryAt:0};
function cacheFresh(ts,ms=300000){return Date.now()-ts<ms;}

const LOCAL_TTL=24*60*60*1000;
function localKey(kind,id=currentId){return `petHouse:${kind}:${id}`;}
function saveLocal(kind,value){
  try{localStorage.setItem(localKey(kind),JSON.stringify({at:Date.now(),value}));}catch(e){}
}
function loadLocal(kind,maxAge=LOCAL_TTL){
  try{
    const raw=localStorage.getItem(localKey(kind));
    if(!raw)return null;
    const obj=JSON.parse(raw);
    if(!obj || Date.now()-Number(obj.at||0)>maxAge)return null;
    return obj.value;
  }catch(e){return null;}
}
function hydrateLocalStudentCache(){
  const m=loadLocal('mailbox');
  if(Array.isArray(m)){mailbox=m;mailboxLoaded=true;mailboxAt=Date.now();}
  const inv=loadLocal('inventory');
  if(Array.isArray(inv)){inventory=inv;CLIENT_CACHE.inventory=inv;CLIENT_CACHE.inventoryAt=Date.now();}
  const sh=loadLocal('shop');
  if(sh){shop=sh;CLIENT_CACHE.shop=sh;CLIENT_CACHE.shopAt=Date.now();}
}

async function gs(fn,...args){
  if(!window.API_URL || /PASTE|YOUR|貼上/i.test(window.API_URL)){
    throw new Error('尚未設定 Apps Script API 網址。請打開 config.js 貼上部署後的 /exec 網址。');
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch(window.API_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:fn,args:args}),
      redirect:'follow',
      cache:'no-store',
      signal:controller.signal
    });
    const text=await response.text();
    let payload;
    try{payload=JSON.parse(text);}catch(e){throw new Error('API 回傳格式錯誤：'+text.slice(0,120));}
    if(!payload || payload.apiOk!==true) throw new Error(payload?.message||'API 呼叫失敗');
    return payload.result;
  }catch(e){
    if(e.name==='AbortError') throw new Error('連線逾時，請再試一次。');
    throw e;
  }finally{clearTimeout(timer);}
}
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}

function applyStudentState(s){
  state=applyStaticConfigsToState(s);
  if(!state)throw new Error('後端回傳空值。');
  if(!state.ok)throw new Error(state.message||'讀取學生資料失敗');
  state.pets=Array.isArray(state.pets)?state.pets:[];
  state.lands=Array.isArray(state.lands)?state.lands:[];
  state.furniture=Array.isArray(state.furniture)?state.furniture:[];
  if(Array.isArray(state.inventory)){inventory=state.inventory;CLIENT_CACHE.inventory=inventory;CLIENT_CACHE.inventoryAt=Date.now();}
  if(Array.isArray(state.mailbox)){mailbox=state.mailbox;mailboxLoaded=true;mailboxAt=Date.now();}
  if(state.shop){shop=state.shop;CLIENT_CACHE.shop=shop;CLIENT_CACHE.shopAt=Date.now();}
  studentName.textContent=state.student?.name||currentId;
  coins.textContent=state.student?.coins??0;
  ver.textContent=state.version||'';
  mailBadge.textContent=state.unreadMail||0;
  mailBadge.classList.toggle('hidden',!state.unreadMail);
  renderYard();
}

async function prefetchStudentData(){
  if(!currentId)return;
  const jobs=[
    gs('getMailboxFresh',currentId).then(r=>{
      if(Array.isArray(r?.mailbox)){
        mailbox=r.mailbox;mailboxLoaded=true;mailboxAt=Date.now();saveLocal('mailbox',mailbox);
      }
      if(state){
        state.unreadMail=Number(r?.unreadMail||0);
        mailBadge.textContent=state.unreadMail;
        mailBadge.classList.toggle('hidden',!state.unreadMail);
      }
      if(currentTab==='mail')renderMailFromCache();
    }).catch(()=>null),
    gs('getInventory',currentId).then(r=>{
      if(Array.isArray(r)){inventory=r;CLIENT_CACHE.inventory=r;CLIENT_CACHE.inventoryAt=Date.now();saveLocal('inventory',r);}
    }).catch(()=>null),
    Promise.resolve().then(()=>{
      if(STATIC_LANDS.length){
        shop={lands:getLandShopRows(),furniture:[]};
        CLIENT_CACHE.shop=shop;CLIENT_CACHE.shopAt=Date.now();saveLocal('shop',shop);
      }
    })
  ];
  Promise.allSettled(jobs);
}

function startBackgroundMailboxRefresh(){
  if(backgroundMailTimer)clearInterval(backgroundMailTimer);
  // 進站後延遲 45 秒再背景更新，之後每 5 分鐘更新一次，不阻塞任何按鈕。
  setTimeout(()=>refreshMailboxInBackground(false),45000);
  backgroundMailTimer=setInterval(()=>refreshMailboxInBackground(false),300000);
}
async function refreshMailboxInBackground(forceRender=false){
  if(!currentId)return;
  if(mailRefreshPromise)return mailRefreshPromise;
  mailRefreshPromise=gs('getMailboxFresh',currentId)
    .then(r=>{
      if(Array.isArray(r?.mailbox)){mailbox=r.mailbox;saveLocal('mailbox',mailbox);}
      mailboxLoaded=true;mailboxAt=Date.now();
      if(state){
        state.unreadMail=Number(r?.unreadMail||0);
        mailBadge.textContent=state.unreadMail;
        mailBadge.classList.toggle('hidden',!state.unreadMail);
      }
      if(forceRender && currentTab==='mail')renderMailFromCache();
      return r;
    })
    .catch(()=>null)
    .finally(()=>mailRefreshPromise=null);
  return mailRefreshPromise;
}
async function login(){
  const id=sid.value.trim(),bd=bday.value;
  loginMsg.textContent='登入中…';
  try{
    // V5.3：登入只拿首頁必要資料，不再同步掃信箱/背包/商店。
    const loginPromise=gs('loginCore',id,bd);
    await STATIC_DATA_READY;
    const r=await loginPromise;
    if(!r){loginMsg.textContent='登入失敗：後端沒有回傳資料。';return;}
    if(!r.ok){loginMsg.textContent=r.message||'登入失敗';return;}

    currentId=id;
    hydrateLocalStudentCache();

    loginView.classList.add('hidden');
    studentView.classList.remove('hidden');
    applyStudentState(r.state);

    currentTab='home';
    document.querySelectorAll('.tabbtn').forEach(x=>x.classList.remove('active'));
    document.querySelector('[data-tab="home"]')?.classList.add('active');
    renderHome();

    // UI 已經顯示後才背景預抓；不阻塞登入。
    prefetchStudentData();
    startBackgroundMailboxRefresh();
  }catch(e){loginMsg.textContent=e.message||e;}
}
async function refreshState(){
  try{
    const s=await gs('getStudentState',currentId);
    applyStudentState(s);
    await renderCurrentTab();
  }catch(e){alert('讀取失敗：'+(e.message||e));}
}

function normalizeMapUrlFast(url){
  const s=String(url||'').trim();
  if(!s)return '';
  let m=s.match(/drive\.google\.com\/file\/d\/([^\/?]+)/i);
  if(m)return 'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w1200';
  m=s.match(/[?&]id=([^&]+)/i);
  if(/drive\.google\.com/i.test(s)&&m)return 'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w1200';
  return s;
}

function renderYard(){
  const y=document.getElementById('yard');
  y.querySelectorAll('.pet-pos,.bubble').forEach(x=>x.remove());
  const land=state.lands.find(x=>String(x['土地ID'])===String(state.activeLandId))||state.lands[0];
  landTitle.textContent=land?.config?.['名稱']||'土地';

  // 最快模式：直接套用試算表背景，不先做圖片預載等待。
  // Google Drive 分享網址會即時轉成縮圖網址。
  const configured=normalizeMapUrlFast(land?.config?.['背景圖片']);
  const fallback=BUILTIN_LAND_BACKGROUNDS[String(land?.['土地ID']||state.activeLandId)]||'';
  const bg=configured||fallback;
  y.style.backgroundImage=bg?`url("${bg}")`:'linear-gradient(#bfe6ff 0 50%,#addd86 50%)';
  y.style.backgroundSize='cover';
  y.style.backgroundPosition='center';
  y.style.backgroundRepeat='no-repeat';

  const visible=state.pets.filter(p=>String(p.landId)===String(state.activeLandId));
  visible.forEach((p,i)=>createPet(p,i));
  if(wanderTimer)clearInterval(wanderTimer);
  wanderTimer=setInterval(wanderPets,3800);
}
function createPet(p,i){const y=document.getElementById('yard'),wrap=document.createElement('div');wrap.className='pet-pos';wrap.dataset.pet=p.petId;let px=Math.max(2,Math.min(88,Number(p.x)||45));let py=Number(p.y)||70;if(p.movementType==='地面型')py=Math.max(55,Math.min(82,py));else py=Math.max(8,Math.min(82,py));wrap.style.left=px+'%';wrap.style.top=py+'%';const alive=document.createElement('div');alive.className='pet-alive';alive.style.animationDuration=(1.9+(i%5)*.17)+'s';const petImg=getPetImage(p.petId,p.stage)||p.image||'';if(petImg){const img=document.createElement('img');img.src=petImg;img.loading='eager';img.decoding='async';img.onerror=()=>alive.innerHTML=`<div class="fallback">🐾<br>${esc(p.petId)}</div>`;alive.appendChild(img);}else alive.innerHTML=`<div class="fallback">🐾<br>${esc(p.petId)}</div>`;wrap.appendChild(alive);wrap.onclick=()=>petTalk(p,wrap);y.appendChild(wrap);}
function wanderPets(){
  if(!state)return;
  const moved=[];
  state.pets.filter(p=>String(p.landId)===String(state.activeLandId)).forEach(p=>{
    const el=document.querySelector(`.pet-pos[data-pet="${CSS.escape(p.petId)}"]`);if(!el)return;
    const x=4+Math.random()*82;
    const yy=p.movementType==='地面型'?(58+Math.random()*22):(10+Math.random()*70);
    el.style.left=x+'%';el.style.top=yy+'%';p.x=x;p.y=yy;
    moved.push({petId:p.petId,landId:p.landId,x,y:yy});
  });
  // 約每 6 次移動才批次存一次（約 23 秒），避免每隻寵物每 3.8 秒都連後端
  positionSaveTick++;
  if(moved.length && positionSaveTick%6===0 && !positionSaveBusy){
    positionSaveBusy=true;
    gs('savePetPositionsBatch',currentId,moved).catch(()=>{}).finally(()=>positionSaveBusy=false);
  }
}
function petTalk(p,el){document.querySelectorAll('.bubble').forEach(x=>x.remove());const b=document.createElement('div');b.className='bubble';b.textContent=p.dialogs[Math.floor(Math.random()*p.dialogs.length)];b.style.left=(el.offsetLeft+el.offsetWidth/2)+'px';b.style.top=el.offsetTop+'px';yard.appendChild(b);setTimeout(()=>b.remove(),2400);}
function switchTab(tab,btn){currentTab=tab;document.querySelectorAll('.tabbtn').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');renderCurrentTab();}
async function renderCurrentTab(){if(currentTab==='home')renderHome();if(currentTab==='upgrade')await renderUpgrade();if(currentTab==='bag')await renderBag();if(currentTab==='challenge')renderChallengeHome();if(currentTab==='mail')await renderMail();if(currentTab==='shop')await renderShop();}
function renderHome(){const pets=state.pets.filter(p=>String(p.landId)===String(state.activeLandId));panel.innerHTML=`<h3>🐾 目前土地上的寵物</h3>${pets.map(p=>petCardHtml(p)).join('')||'<div class="petcard">目前這塊土地沒有寵物。</div>'}<button class="btn blue" style="width:100%;margin:8px 0 12px" onclick="switchTab('challenge',document.querySelector('[data-tab=challenge]'))">⚔️ 前往五科挑戰</button><h3>🗺️ 切換土地</h3><div class="row">${state.lands.map(l=>`<button class="btn ${String(l['土地ID'])===String(state.activeLandId)?'gray':'secondary'}" onclick="changeLand('${l['土地ID']}')">${esc(l.config?.['名稱']||l['土地ID'])}</button>`).join('')}</div><p class="small">地圖上半部為天空區、下半部為地面區。地面型寵物只會在地面活動；天空型可自由活動。</p>`;}
function petCardHtml(p){const pct=Math.min(100,p.exp/p.expNeed*100);return `<div class="petcard"><b>${esc(p.nickname||p.name)}</b> <span class="small">${esc(p.movementType)}</span><br>Lv.${p.level}・第${p.stage}階<div class="xp"><div style="width:${pct}%"></div></div><small>EXP ${p.exp}/${p.expNeed}</small></div>`;}
async function changeLand(id){try{const r=await gs('setActiveLandFast',currentId,id);state.activeLandId=r.activeLandId;state.furniture=Array.isArray(r.furniture)?r.furniture:[];renderYard();renderHome();}catch(e){alert(e.message||e);}}
async function renderUpgrade(){if(!Array.isArray(inventory)||!inventory.length)inventory=await gs('getInventory',currentId);const expItems=inventory.filter(x=>x.config?.['類型']==='經驗型');panel.innerHTML=`<h3>⬆️ 寵物升級</h3><label>選擇寵物</label><select id="upPet" class="full">${state.pets.map(p=>`<option value="${p.petId}">${esc(p.name)} Lv.${p.level}</option>`).join('')}</select><div id="upPetInfo" style="margin-top:8px"></div><h4>使用經驗道具</h4>${expItems.length?expItems.map(x=>`<div class="itemcard"><b>${esc(x.config['名稱'])}</b> ×${x.quantity}<br><span class="small">+${x.config['效果值']} EXP/個</span><div class="row" style="margin-top:6px"><input id="qty-${x.itemId}" type="number" min="1" max="${x.quantity}" value="1" style="width:80px"><button class="btn" onclick="useExp('${x.itemId}')">使用</button></div></div>`).join(''):'<div class="itemcard">目前沒有經驗型道具。</div>'}`;upPet.onchange=renderUpPetInfo;renderUpPetInfo();}
function renderUpPetInfo(){const p=state.pets.find(x=>x.petId===upPet.value);if(p)upPetInfo.innerHTML=petCardHtml(p);}
async function useExp(itemId){
  const petId=upPet.value,qty=Number(document.getElementById('qty-'+itemId).value||1);
  try{
    const btn=document.activeElement;if(btn)btn.disabled=true;
    const r=await gs('useExpItem',currentId,itemId,petId,qty);
    inventory=Array.isArray(r.inventory)?r.inventory:inventory;
    const p=state.pets.find(x=>x.petId===petId);
    if(p){p.level=Number(r.level||p.level);p.exp=Number(r.exp??p.exp);p.stage=Number(r.stage||p.stage);p.expNeed=Number(r.expNeed||p.expNeed);p.image=getPetImage(p.petId,p.stage)||r.image||p.image;}
    await renderUpgrade();renderYard();
    const note=document.createElement('div');note.className='success';note.textContent=`✅ +${r.gained} EXP`;panel.prepend(note);setTimeout(()=>note.remove(),1400);
  }catch(e){alert(e.message||e);}
}
async function renderBag(){if(!Array.isArray(inventory)||!inventory.length)inventory=await gs('getInventory',currentId);panel.innerHTML=`<h3>🎒 我的道具</h3>${inventory.map(x=>`<div class="itemcard"><b>${esc(x.config?.['名稱']||x.itemId)}</b> ×${x.quantity}<br><span class="small">${esc(x.config?.['類型']||'')}｜${esc(x.config?.['說明']||'')}</span></div>`).join('')||'<div class="itemcard">背包目前是空的。</div>'}`;}
function renderChallengeHome(){const subjects=['國語','數學','英文','自然','社會'];panel.innerHTML=`<h3>⚔️ 五科挑戰</h3><p class="small">每科答錯 3 次後，會鎖定到下一個早上 7:00。答對越多，每題 EXP 會逐階增加。</p>${subjects.map(s=>{const st=state.challengeStatus?.[s]||{correct:0,wrong:0,locked:false};return `<div class="subjectcard"><b>${s}</b>　答對 ${st.correct}　<span class="lives">${'❤️'.repeat(Math.max(0,3-st.wrong))}${'🖤'.repeat(st.wrong)}</span><br><button class="btn ${st.locked?'gray':'blue'}" ${st.locked?'disabled':''} onclick="chooseChallenge('${s}')">${st.locked?'今日已結束':'開始挑戰'}</button></div>`}).join('')}`;}
function chooseChallenge(subject){challenge.subject=subject;panel.innerHTML=`<h3>⚔️ ${subject}挑戰</h3><label>派遣寵物</label><select id="chPet" class="full">${state.pets.map(p=>`<option value="${p.petId}">${esc(p.name)} Lv.${p.level}</option>`).join('')}</select><div class="nav"><button class="btn blue" onclick="startChallengeUI()">出發</button><button class="btn gray" onclick="renderChallengeHome()">返回</button></div>`;}
async function startChallengeUI(){
  challenge.petId=chPet.value;
  try{
    const r=await gs('startChallengeBatch',currentId,challenge.subject,challenge.petId);
    if(!r.ok&&r.locked){showLocked(r);return;}
    challenge.questions=r.questions||[];challenge.qIndex=0;challenge.status={...r.status};challenge.pending=[];challenge.seen=[];
    challenge.question=challenge.questions[0]||null;renderQuestion(challenge.status);
  }catch(e){alert(e.message||e);}
}
function renderQuestion(status,msg=''){
  const q=challenge.question;
  if(!q){panel.innerHTML='<div class="qbox">正在載入下一批題目...</div>';loadMoreChallengeQuestions();return;}
  let answer='';
  if(q.type==='填充題')answer=`<input id="fillAns" class="full" type="text" placeholder="輸入答案"><button class="btn blue" style="margin-top:8px" onclick="sendAnswer(document.getElementById('fillAns').value)">送出</button>`;
  else answer=q.options.map((o,i)=>`<button class="btn option blue" onclick="sendAnswer('${String.fromCharCode(65+i)}')">${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('');
  panel.innerHTML=`<div class="qbox"><div class="row"><b>${esc(challenge.subject)}</b><span>答對 ${status.correct}</span><span class="lives">${'❤️'.repeat(Math.max(0,3-status.wrong))}${'🖤'.repeat(status.wrong)}</span></div><div class="qtext">${esc(q.text)}</div>${answer}${msg?`<div style="margin-top:10px">${msg}</div>`:''}<div style="margin-top:10px"><button class="btn gray" onclick="finishChallengeUI()">結束挑戰</button></div></div>`;
}
function challengeLocalExp(n){if(n>=50)return 6;if(n>=40)return 5;if(n>=30)return 4;if(n>=20)return 3;if(n>=10)return 2;return 1;}
function normAns(v){return String(v??'').trim().toUpperCase().replace(/\s+/g,'');}
async function sendAnswer(ans){
  const q=challenge.question;if(!q)return;
  const good=normAns(ans)===normAns(q.answer);
  let gained=0;
  if(good){challenge.status.correct=Number(challenge.status.correct||0)+1;gained=challengeLocalExp(challenge.status.correct);challenge.status.exp=Number(challenge.status.exp||0)+gained;}
  else challenge.status.wrong=Number(challenge.status.wrong||0)+1;
  challenge.pending.push({questionId:q.id,answer:ans});challenge.seen.push(q.id);
  const msg=good?`<span class="success">✅ 正確！+${gained} EXP</span>`:`<span class="wrong">❌ 錯誤。正確答案：${esc(q.answer)}<br>${esc(q.explanation||'')}</span>`;
  if(challenge.status.wrong>=3){await flushChallengeAnswers(true);panel.innerHTML=`<div class="qbox"><h3>今日挑戰結束</h3>${msg}<p>答對：${challenge.status.correct} 題</p><p>累積 EXP：${challenge.status.exp}</p><p>明早 7:00 後重置。</p><button class="btn gray" onclick="refreshState().then(()=>renderChallengeHome())">返回</button></div>`;return;}
  challenge.qIndex++;
  if(challenge.qIndex>=challenge.questions.length){challenge.question=null;renderQuestion(challenge.status,msg);}
  else{challenge.question=challenge.questions[challenge.qIndex];renderQuestion(challenge.status,msg);}
  if(challenge.pending.length>=5)flushChallengeAnswers(false);
}
async function flushChallengeAnswers(force){
  if(challenge.syncing){if(force)await challenge.syncing;else return;}
  if(!challenge.pending.length)return;
  const batch=challenge.pending.splice(0,challenge.pending.length);
  challenge.syncing=gs('syncChallengeBatch',currentId,challenge.subject,challenge.petId,batch)
    .then(r=>{if(r?.status){challenge.status={...r.status};state.challengeStatus=state.challengeStatus||{};state.challengeStatus[challenge.subject]={...r.status};}return r;})
    .catch(e=>{challenge.pending.unshift(...batch);if(force)throw e;})
    .finally(()=>challenge.syncing=null);
  if(force)return await challenge.syncing;
}
async function loadMoreChallengeQuestions(){
  try{await flushChallengeAnswers(true);const qs=await gs('getChallengeQuestionBatch',challenge.subject,challenge.seen.slice(-50),30);challenge.questions=qs||[];challenge.qIndex=0;challenge.question=challenge.questions[0]||null;renderQuestion(challenge.status);}catch(e){alert(e.message||e);}
}
async function finishChallengeUI(){try{await flushChallengeAnswers(true);await refreshState();currentTab='challenge';renderChallengeHome();}catch(e){alert(e.message||e);}}
function showLocked(r){panel.innerHTML=`<div class="qbox"><h3>今天這科已挑戰結束</h3><p>明早 7:00 後會重新有 3 次機會。</p><p>重置：${esc(r.resetAt)}</p><button class="btn gray" onclick="renderChallengeHome()">返回</button></div>`;}
async function renderMail(){
  // 有快取就立刻畫出來，不等待 Apps Script。
  if(!mailboxLoaded){
    const local=loadLocal('mailbox');
    if(Array.isArray(local)){mailbox=local;mailboxLoaded=true;mailboxAt=Date.now();}
  }
  if(mailboxLoaded){
    renderMailFromCache();
    // 超過 60 秒才在背景偷偷更新，不阻塞畫面。
    if(Date.now()-mailboxAt>60000)refreshMailboxInBackground(true);
    return;
  }
  panel.innerHTML='<h3>📬 信箱</h3><div class="mailcard">正在載入信箱…</div>';
  await refreshMailboxInBackground(true);
}
function renderMailFromCache(){
  panel.innerHTML=`<h3>📬 信箱</h3>${mailbox.map(m=>`<div class="mailcard"><b>${esc(m['標題'])}</b><br><span class="small">寄件者：${esc(m['寄件者'])}</span><p>${esc(m['內容'])}</p>${m['附件ID']?`🎁 ${esc(m['附件名稱'])} ×${m['附件數量']}<br>`:''}<button class="btn ${m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE'?'gray':''}" ${(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')?'disabled':''} onclick="claimMailUI('${m['信件ID']}')">${(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')?'已領取':'領取附件'}</button></div>`).join('')||'<div class="mailcard">目前沒有信件。</div>'}`;
}
async function claimMailUI(id){
  const m=mailbox.find(x=>String(x['信件ID'])===String(id));
  if(!m)return;
  const wasClaimed=m['是否領取'];
  const oldUnread=Number(state?.unreadMail||0);

  // 先更新畫面，學生不需要等後端。
  m['是否領取']=true;
  if(state)state.unreadMail=Math.max(0,oldUnread-1);
  mailBadge.textContent=state?.unreadMail||0;
  mailBadge.classList.toggle('hidden',!(state?.unreadMail));
  renderMailFromCache();
  saveLocal('mailbox',mailbox);

  try{
    const r=await gs('claimMailFast',currentId,id);
    if(Array.isArray(r?.inventory)){inventory=r.inventory;CLIENT_CACHE.inventory=inventory;CLIENT_CACHE.inventoryAt=Date.now();saveLocal('inventory',inventory);}
    if(state){
      state.unreadMail=Number(r?.unreadMail??state.unreadMail);
      mailBadge.textContent=state.unreadMail;
      mailBadge.classList.toggle('hidden',!state.unreadMail);
    }
  }catch(e){
    // 後端失敗才回復原狀。
    m['是否領取']=wasClaimed;
    if(state)state.unreadMail=oldUnread;
    mailBadge.textContent=oldUnread;
    mailBadge.classList.toggle('hidden',!oldUnread);
    renderMailFromCache();
    alert(e.message||e);
  }
}
async function renderShop(){if(!shop){if(STATIC_LANDS.length)shop={lands:getLandShopRows(),furniture:[]};else shop=await gs('getShop');}const rows=STATIC_LANDS.length?getLandShopRows():shop.lands;const owned=new Set(state.lands.map(x=>String(x['土地ID'])));panel.innerHTML=`<h3>🗺️ 土地商店</h3><p class="small">買新土地後，可以讓不同寵物住在不同地圖。</p>${rows.map(l=>`<div class="itemcard"><b>${esc(l['名稱'])}</b>　🪙${l['價格']}<br><button class="btn ${owned.has(String(l['土地ID']))?'gray':'secondary'}" ${owned.has(String(l['土地ID']))?'disabled':''} onclick="buyLandUI('${l['土地ID']}')">${owned.has(String(l['土地ID']))?'已擁有':'購買'}</button></div>`).join('')}`;}
async function buyLandUI(id){try{const r=await gs('buyLandFast',currentId,id);if(r.land&&!state.lands.some(x=>String(x['土地ID'])===String(id))){
      const tmp={...r.land};
      const cfg=LAND_CONFIGS[String(id)];
      if(cfg)tmp.config={...(tmp.config||{}),'土地ID':cfg.landId,'名稱':cfg.name,'價格':cfg.price,'背景圖片':cfg.background,'寬度':cfg.width,'高度':cfg.height,'是否開放':cfg.enabled};
      state.lands.push(tmp);
    }state.student.coins=Number(r.coins||0);coins.textContent=state.student.coins;renderYard();await renderShop();}catch(e){alert(e.message||e);}}
function logout(){
  currentId='';state=null;inventory=[];mailbox=[];shop=null;mailboxLoaded=false;mailboxAt=0;
  if(wanderTimer)clearInterval(wanderTimer);
  if(backgroundMailTimer)clearInterval(backgroundMailTimer);
  studentView.classList.add('hidden');adminView.classList.add('hidden');loginView.classList.remove('hidden');
}
async function openAdmin(){loginView.classList.add('hidden');adminView.classList.remove('hidden');await loadAdmin();}
async function loadAdmin(){adminData=await gs('getAdminData');const itemOpts=adminData.items.map(x=>`<option value="${x['道具ID']}">${esc(x['名稱'])}</option>`).join('');const petOpts=adminData.pets.map(x=>`<option value="${x.petId}">${esc(x.name)}</option>`).join('');adminArea.innerHTML=`<table class="admin-table"><thead><tr><th>座號</th><th>學生</th><th>金幣</th><th>發獎勵</th></tr></thead><tbody>${adminData.students.map(s=>`<tr><td>${s.seat||''}</td><td>${esc(s.name)}<br><span class="small">${esc(s.id)}</span></td><td>${s.coins}</td><td><div class="row"><button class="btn" onclick="adminCoin('${s.id}',10)">+10🪙</button><select id="it-${s.id}">${itemOpts}</select><input id="iq-${s.id}" type="number" min="1" value="1" style="width:65px"><button class="btn purple" onclick="adminItem('${s.id}')">發道具</button><select id="pt-${s.id}">${petOpts}</select><button class="btn secondary" onclick="adminPet('${s.id}')">發寵物</button></div></td></tr>`).join('')}</tbody></table>`;}
async function adminCoin(id,n){await gs('addCoins',id,n,'課堂獎勵');await loadAdmin();}
async function adminItem(id){const item=document.getElementById('it-'+id).value,qty=Number(document.getElementById('iq-'+id).value||1);try{await gs('grantItem',id,item,qty,'課堂獎勵');alert('已發放');}catch(e){alert(e.message||e);}}
async function adminPet(id){const p=document.getElementById('pt-'+id).value;try{await gs('assignPetToStudent',id,p);alert('已分配寵物');}catch(e){alert(e.message||e);}}
