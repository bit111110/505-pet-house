const FRONTEND_BUILD='20261004-2010';
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
let LIVE_LAND_CONFIGS = {};
let liveLandCatalogAt = 0;
let MONSTER_CONFIGS = {};
let MONSTER_LIST = [];

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
    s.lands=s.lands.map((l,i)=>{
      const bgId=String(l['背景ID']||l.backgroundId||l['土地ID']||'LAND001');
      const cfg=LAND_CONFIGS[bgId]||null;
      return {
        ...l,
        plotIndex:Number(l['土地序號']||i+1),
        backgroundId:bgId,
        config:cfg?{
          ...(l.config||{}),
          '土地ID':(l.config?.['土地ID']||cfg.landId),
          '背景圖片':cfg.background || l.config?.['背景圖片'] || '',
          '寬度':(l.config?.['寬度']||cfg.width),
          '高度':(l.config?.['高度']||cfg.height)
        }:(l.config||{})
      };
    });
  }
  s.backgrounds=Array.isArray(s.backgrounds)?s.backgrounds.map(String):[];
  return s;
}

function getLandShopRows(){
  const source = Object.keys(LIVE_LAND_CONFIGS).length
    ? Object.values(LIVE_LAND_CONFIGS)
    : (STATIC_LANDS||[]).map(l=>({
        landId:l.landId,
        name:l.name,
        price:Number(l.price||0),
        background:l.background,
        width:l.width,
        height:l.height,
        enabled:l.enabled,
        acquireType:'金幣',
        exchangeItemId:'',
        exchangeQty:0,
        exchangeItemName:''
      }));

  return source.filter(l=>l.enabled!==false).map(l=>{
    const asset=LAND_CONFIGS[String(l.landId)]||{};
    return {
      '土地ID':l.landId,
      '名稱':l.name,
      '價格':(l.price===''||l.price===null||l.price===undefined)?'':Number(l.price),
      '背景圖片':asset.background || l.background || '',
      '寬度':l.width||asset.width||900,
      '高度':l.height||asset.height||560,
      '是否開放':l.enabled!==false,

      // V5.6.3：保留 Google 試算表的取得方式資料。
      '取得方式':String(l.acquireType||'金幣'),
      '兌換道具ID':String(l.exchangeItemId||''),
      '兌換數量':(l.exchangeQty===''||l.exchangeQty===null||l.exchangeQty===undefined)?'':Number(l.exchangeQty),
      '兌換道具名稱':String(l.exchangeItemName||l.exchangeItemId||'')
    };
  });
}

function liveLandById(id){
  const live=LIVE_LAND_CONFIGS[String(id)];
  const asset=LAND_CONFIGS[String(id)]||{};
  if(live){
    return {
      landId:String(live.landId),
      name:live.name,
      price:(live.price===''||live.price===null||live.price===undefined)?'':Number(live.price),
      background:asset.background||live.background||'',
      width:live.width||asset.width||900,
      height:live.height||asset.height||560,
      enabled:live.enabled!==false,
      acquireType:String(live.acquireType||'金幣'),
      exchangeItemId:String(live.exchangeItemId||''),
      exchangeQty:(live.exchangeQty===''||live.exchangeQty===null||live.exchangeQty===undefined)?'':Number(live.exchangeQty),
      exchangeItemName:String(live.exchangeItemName||live.exchangeItemId||'')
    };
  }
  return LAND_CONFIGS[String(id)]||null;
}

async function refreshLiveLandCatalog(forceRender=false){
  if(!currentId && !forceRender) return null;
  const rows=await gs('getBackgroundCatalogFresh');
  if(!Array.isArray(rows))throw new Error('背景設定同步失敗：後端沒有回傳背景資料');
  LIVE_LAND_CONFIGS=Object.fromEntries(rows.map(r=>[String(r.landId),r]));
  liveLandCatalogAt=Date.now();
  saveLocal('landCatalog',rows);

  if(state && Array.isArray(state.lands)){
    state.lands=state.lands.map(l=>{
      const id=String(l.backgroundId||l['背景ID']||'LAND001');
      const cfg=liveLandById(id);
      if(!cfg)return l;
      return {...l,config:{...(l.config||{}),
        '土地ID':cfg.landId,'名稱':cfg.name,'價格':cfg.price,
        '背景圖片':cfg.background,'寬度':cfg.width,'高度':cfg.height,'是否開放':cfg.enabled
      }};
    });
  }
  if(forceRender){
    if(currentTab==='home')renderHome();
    renderYard();
  }
  return rows;
}

let currentId='',state=null,currentTab='home',mainMode='home',wanderTimer=null,inventory=[],mailbox=[],shop=null,adminData=null,challenge={subject:'',petId:'',question:null};
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
  const lc=loadLocal('landCatalog');
  if(Array.isArray(lc)){
    LIVE_LAND_CONFIGS=Object.fromEntries(lc.map(r=>[String(r.landId),r]));
    liveLandCatalogAt=Date.now();
  }
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
    refreshLiveLandCatalog(true).catch(()=>null),
    loadMonsterCatalog().catch(()=>null)
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
function normalizeBirthdayInput(v){const d=String(v||'').replace(/[^0-9]/g,'');if(d.length===3)return '0'+d[0]+'/'+d.slice(1);if(d.length>=4)return d.slice(-4,-2)+'/'+d.slice(-2);const m=String(v||'').match(/(\d{1,2})\D+(\d{1,2})/);return m?String(Number(m[1])).padStart(2,'0')+'/'+String(Number(m[2])).padStart(2,'0'):String(v||'').trim();}
async function login(){
  const id=sid.value.trim(),bd=normalizeBirthdayInput(bday.value);
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
    renderHome();switchMainMode('home');

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



async function loadMonsterCatalog(){
  try{
    const rows=await gs('getMonsterCatalogFresh');
    MONSTER_LIST=Array.isArray(rows)?rows:[];
    MONSTER_CONFIGS=Object.fromEntries(MONSTER_LIST.map(m=>[String(m.monsterId),m]));
    return MONSTER_LIST;
  }catch(e){
    console.warn('怪物設定載入失敗',e);
    MONSTER_LIST=[];MONSTER_CONFIGS={};
    return [];
  }
}
function getAvailableMonsters(subject){
  const s=String(subject||'');
  return MONSTER_LIST.filter(m=>{
    if(m.enabled===false)return false;
    const ms=String(m.subject||'全部');
    return ms==='全部'||ms===s;
  });
}
function getMonsterForBattle(subject,no){
  const list=getAvailableMonsters(subject);
  if(!list.length){
    return {
      monsterId:'MON000',
      name:'訓練怪物',
      image:'',
      baseHp:100,
      hpGrowth:25,
      subject:'全部',
      enabled:true
    };
  }
  return list[(Math.max(1,Number(no||1))-1)%list.length];
}
function getMonsterHp(monster,no){
  const base=Math.max(1,Number(monster?.baseHp||100));
  const growth=Math.max(0,Number(monster?.hpGrowth||25));
  return base + Math.max(0,Number(no||1)-1)*growth;
}

function switchMainMode(mode){
  mainMode=mode==='battle'?'battle':'home';
  const y=document.getElementById('yard'),b=document.getElementById('battleMain');
  const hb=document.getElementById('homeModeBtn'),bb=document.getElementById('battleModeBtn');
  if(y)y.classList.toggle('hidden',mainMode!=='home');
  if(b)b.classList.toggle('hidden',mainMode!=='battle');
  hb?.classList.toggle('active',mainMode==='home');
  bb?.classList.toggle('active',mainMode==='battle');
  if(mainMode==='home')renderYard();else renderBattleMain();
}
function renderBattleMain(){
  const root=document.getElementById('battleMain');if(!root)return;
  root.classList.remove('empty');
  const pet=state?.pets?.find(p=>String(p.petId)===String(challenge.petId));
  if(!pet || !challenge.subject){
    root.classList.add('empty');
    root.innerHTML=`<div><div style="font-size:74px">⚔️</div><h2>寵物對戰</h2><p>請從右側選擇科目與出戰寵物。</p><button class="btn blue" onclick="switchTab('challenge',document.querySelector('[data-tab=challenge]'))">選擇對戰</button></div>`;
    return;
  }
  const mhp=Math.max(0,Number(challenge.monsterHp??challenge.monsterMaxHp??100));
  const mmax=Math.max(1,Number(challenge.monsterMaxHp||100));
  root.innerHTML=`<div class="battle-main-scene">
    <div class="battle-sky"></div><div class="battle-ground"></div>
    <div class="battle-status"><div><b>${esc(challenge.subject)}對戰</b>　怪物 ${challenge.monsterNo||1}</div><div>答對 ${challenge.status?.correct||0}　<span class="lives">${'❤️'.repeat(Math.max(0,3-(challenge.status?.wrong||0)))}${'🖤'.repeat(challenge.status?.wrong||0)}</span></div></div>
    <div class="battle-pet-side"><div class="battle-pet-name">${esc(pet.name)}</div><div id="battlePetSprite" class="battle-pet-sprite">${getPetImage(pet.petId,pet.stage)?`<img src="${getPetImage(pet.petId,pet.stage)}">`:'🐾'}</div></div>
    <div class="battle-monster-side"><div class="battle-monster-name">${esc((challenge.monsterCfg||{}).name||('怪物 '+(challenge.monsterNo||1)))}</div><div id="battleMonsterSprite" class="battle-monster-sprite">${(challenge.monsterCfg||{}).image?`<img src="${esc((challenge.monsterCfg||{}).image)}" alt="${esc((challenge.monsterCfg||{}).name||'怪物')}">`:'👾'}</div><div class="hpbar"><div style="width:${Math.max(0,mhp/mmax*100)}%"></div></div><small>HP ${Math.ceil(mhp)} / ${mmax}</small></div>
  </div>`;
}
function playPetAttackAnimation(damage){
  return new Promise(resolve=>{
    const pet=document.getElementById('battlePetSprite');
    const mon=document.getElementById('battleMonsterSprite');
    const root=document.getElementById('battleMain');
    if(pet){pet.classList.remove('attack-lunge');void pet.offsetWidth;pet.classList.add('attack-lunge');}
    setTimeout(()=>{
      if(mon){mon.classList.remove('hit-shake');void mon.offsetWidth;mon.classList.add('hit-shake');}
      if(root){
        const d=document.createElement('div');d.className='battle-damage-float';d.textContent='-'+damage;root.appendChild(d);setTimeout(()=>d.remove(),850);
      }
    },260);
    setTimeout(resolve,620);
  });
}

function renderYard(){
  const y=document.getElementById('yard');
  y.querySelectorAll('.pet-pos,.bubble').forEach(x=>x.remove());
  const land=state.lands.find(x=>String(x['土地ID'])===String(state.activeLandId))||state.lands[0];
  landTitle.textContent=`土地 ${land?.plotIndex||''}・${land?.config?.['名稱']||'背景'}`;

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
function switchTab(tab,btn){currentTab=tab;if(tab==='home')switchMainMode('home');if(tab==='challenge')switchMainMode('battle');document.querySelectorAll('.tabbtn').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');renderCurrentTab();}
async function renderCurrentTab(){if(currentTab==='home')renderHome();if(currentTab==='upgrade')await renderUpgrade();if(currentTab==='bag')await renderBag();if(currentTab==='challenge')renderChallengeHome();if(currentTab==='mail')await renderMail();if(currentTab==='shop')await renderShop();}
function renderHome(){
  const petsHere=state.pets.filter(p=>String(p.landId)===String(state.activeLandId));
  const ownedBgs=(state.backgrounds||[]).map(id=>liveLandById(id)).filter(Boolean);
  const activePlot=state.lands.find(l=>String(l['土地ID'])===String(state.activeLandId))||state.lands[0];
  panel.innerHTML=`<h3>🏠 小屋管理</h3>
    <div class="home-section"><h4>土地切換</h4><div class="row">${state.lands.map((l,i)=>`<button class="btn ${String(l['土地ID'])===String(state.activeLandId)?'gray':'secondary'}" onclick="changeLand('${l['土地ID']}')">土地 ${l.plotIndex||i+1}</button>`).join('')}</div><p class="small">目前背景：${esc(activePlot?.config?.['名稱']||'')}</p></div>
    <div class="home-section"><h4>🖼️ 這塊土地的背景</h4><select id="homeBg" class="full">${ownedBgs.map(bg=>`<option value="${bg.landId}" ${String(bg.landId)===String(activePlot?.backgroundId)?'selected':''}>${esc(bg.name)}</option>`).join('')}</select><button class="btn blue" style="margin-top:7px" onclick="applyHomeBackground()">套用背景</button></div>
    <div class="home-section"><h4>🐾 分配寵物到土地</h4>${state.pets.map(p=>`<div class="petcard"><b>${esc(p.nickname||p.name)}</b><div class="row" style="margin-top:6px"><select id="plot-${p.petId}">${state.lands.map((l,i)=>`<option value="${l['土地ID']}" ${String(p.landId)===String(l['土地ID'])?'selected':''}>土地 ${l.plotIndex||i+1}</option>`).join('')}</select><button class="btn" onclick="movePetUI('${p.petId}')">分配</button></div></div>`).join('')}</div>
    <h4>目前土地上的寵物</h4>${petsHere.map(p=>petCardHtml(p)).join('')||'<div class="petcard">目前這塊土地沒有寵物。</div>'}
    <button class="btn blue" style="width:100%;margin:8px 0" onclick="switchMainMode('battle');switchTab('challenge',document.querySelector('[data-tab=challenge]'))">⚔️ 切換到對戰畫面</button>`;
}
function petCardHtml(p){const pct=Math.min(100,p.exp/p.expNeed*100);return `<div class="petcard"><b>${esc(p.nickname||p.name)}</b> <span class="small">${esc(p.movementType)}</span><br>Lv.${p.level}・第${p.stage}階<div class="xp"><div style="width:${pct}%"></div></div><small>EXP ${p.exp}/${p.expNeed}</small></div>`;}
async function changeLand(id){try{const r=await gs('setActiveLandFast',currentId,id);state.activeLandId=r.activeLandId;state.furniture=Array.isArray(r.furniture)?r.furniture:[];renderYard();renderHome();}catch(e){alert(e.message||e);}}
async function movePetUI(petId){const sel=document.getElementById('plot-'+petId);if(!sel)return;try{await gs('movePetToLand',currentId,petId,sel.value);const p=state.pets.find(x=>x.petId===petId);if(p)p.landId=sel.value;renderYard();renderHome();}catch(e){alert(e.message||e);}}
async function applyHomeBackground(){const bg=document.getElementById('homeBg')?.value;if(!bg)return;await useBackgroundFromShop(bg);}
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
function renderChallengeHome(){const subjects=['國語','數學','英文','自然','社會'];panel.innerHTML=`<h3>⚔️ 寵物對戰挑戰</h3><p class="small">選擇科目與寵物。使用技能時會出題；答對造成完整傷害，答錯仍可造成 30% 傷害。每科累積答錯 3 次後鎖定到下一個早上 7:00。</p>${subjects.map(s=>{const st=state.challengeStatus?.[s]||{correct:0,wrong:0,locked:false};return `<div class="subjectcard"><b>${s}</b>　答對 ${st.correct}　<span class="lives">${'❤️'.repeat(Math.max(0,3-st.wrong))}${'🖤'.repeat(st.wrong)}</span><br><button class="btn ${st.locked?'gray':'blue'}" ${st.locked?'disabled':''} onclick="chooseChallenge('${s}')">${st.locked?'今日已結束':'進入對戰'}</button></div>`}).join('')}`;}
function chooseChallenge(subject){challenge.subject=subject;switchMainMode('battle');renderBattleMain();panel.innerHTML=`<h3>⚔️ ${subject}對戰</h3><label>選擇出戰寵物</label><select id="chPet" class="full">${state.pets.map(p=>`<option value="${p.petId}">${esc(p.name)} Lv.${p.level}・第${p.stage}階</option>`).join('')}</select><div class="nav"><button class="btn blue" onclick="startChallengeUI()">開始戰鬥</button><button class="btn gray" onclick="renderChallengeHome()">返回</button></div>`;}
function getPetSkills(pet){const cfg=PET_CONFIGS[String(pet.petId)]||{};const arr=Array.isArray(cfg.skills)?cfg.skills:[];return arr.filter(s=>Number(s.minStage||1)<=Number(pet.stage||1));}
async function startChallengeUI(){
  challenge.petId=chPet.value;
  try{
    const r=await gs('startChallengeBatch',currentId,challenge.subject,challenge.petId);
    if(!r.ok&&r.locked){showLocked(r);return;}
    challenge.questions=r.questions||[];challenge.qIndex=0;challenge.status={...r.status};challenge.pending=[];challenge.seen=[];
    await loadMonsterCatalog();
    challenge.monsterNo=1;
    challenge.monsterCfg=getMonsterForBattle(challenge.subject,challenge.monsterNo);
    challenge.monsterMaxHp=getMonsterHp(challenge.monsterCfg,challenge.monsterNo);
    challenge.monsterHp=challenge.monsterMaxHp;
    challenge.selectedSkill=null;challenge.question=null;challenge.lastMsg='';
    switchMainMode('battle');renderBattleMain();renderBattle();
  }catch(e){alert(e.message||e);}
}
function renderBattle(){
  const pet=state.pets.find(p=>p.petId===challenge.petId);if(!pet)return;
  renderBattleMain();
  const skills=getPetSkills(pet);
  panel.innerHTML=`<h3>⚔️ ${esc(challenge.subject)}對戰控制</h3>
  <div class="petcard"><b>${esc(pet.name)}</b> Lv.${pet.level}・第${pet.stage}階<br><span class="small">怪物 ${challenge.monsterNo}｜HP ${Math.ceil(challenge.monsterHp)} / ${challenge.monsterMaxHp}</span></div>
  ${challenge.lastMsg?`<div style="margin:8px 0">${challenge.lastMsg}</div>`:''}
  <h4>選擇技能</h4><div class="skill-grid">${skills.map(s=>`<button class="btn purple skill-btn" onclick="useBattleSkill('${s.id}')"><b>${esc(s.icon||'✨')} ${esc(s.name)}</b><br><span class="small" style="color:white">威力 ${s.damage}</span></button>`).join('')}</div>
  <div class="nav"><button class="btn gray" onclick="finishChallengeUI()">結束對戰</button><button class="btn secondary" onclick="switchMainMode('home')">看一下小屋</button></div>`;
}
function useBattleSkill(skillId){const pet=state.pets.find(p=>p.petId===challenge.petId);const skill=getPetSkills(pet).find(s=>String(s.id)===String(skillId));if(!skill)return;challenge.selectedSkill=skill;if(!challenge.questions?.length || challenge.qIndex>=challenge.questions.length){loadMoreBattleQuestions();return;}challenge.question=challenge.questions[challenge.qIndex];renderBattleQuestion();}
function renderBattleQuestion(){switchMainMode('battle');renderBattleMain();const q=challenge.question,skill=challenge.selectedSkill;if(!q||!skill){renderBattle();return;}let answer='';if(String(q.type).includes('填充'))answer=`<input id="fillAns" class="full" type="text" placeholder="輸入答案"><button class="btn blue" style="margin-top:8px" onclick="sendBattleAnswer(document.getElementById('fillAns').value)">送出</button>`;else if(String(q.type).includes('是非'))answer=`<div class="grid2"><button class="btn blue option" onclick="sendBattleAnswer('A')">⭕ 是</button><button class="btn red option" onclick="sendBattleAnswer('B')">❌ 否</button></div>`;else answer=q.options.map((o,i)=>`<button class="btn option blue" onclick="sendBattleAnswer('${String.fromCharCode(65+i)}')">${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('');panel.innerHTML=`<div class="question-overlay"><div class="row"><b>${esc(skill.icon||'✨')} ${esc(skill.name)}</b><span>威力 ${skill.damage}</span></div><div class="qtext">${esc(q.text)}</div>${answer}<button class="btn gray" style="margin-top:8px" onclick="renderBattle()">取消技能</button></div>`;}
async function sendBattleAnswer(ans){
  const q=challenge.question,skill=challenge.selectedSkill;if(!q||!skill)return;
  const good=normAns(ans)===normAns(q.answer);
  let gained=0;
  if(good){challenge.status.correct=Number(challenge.status.correct||0)+1;gained=challengeLocalExp(challenge.status.correct);challenge.status.exp=Number(challenge.status.exp||0)+gained;}
  else challenge.status.wrong=Number(challenge.status.wrong||0)+1;

  const damage=Math.max(1,Math.round(Number(skill.damage||0)*(good?1:.3)));
  challenge.pending.push({questionId:q.id,answer:ans});challenge.seen.push(q.id);challenge.qIndex++;
  challenge.lastMsg=good?`<span class="success">✅ 正確！${esc(skill.name)}造成 <span class="damage-pop">${damage}</span> 傷害，+${gained} EXP</span>`:`<span class="wrong">❌ 答錯，只造成 30% 傷害：<span class="damage-pop">${damage}</span><br>正確答案：${esc(q.answer)} ${esc(q.explanation||'')}</span>`;
  challenge.question=null;challenge.selectedSkill=null;

  // 先播放寵物向怪物撞擊的動畫，再扣血。
  await playPetAttackAnimation(damage);
  challenge.monsterHp=Math.max(0,Number(challenge.monsterHp||0)-damage);

  if(challenge.status.wrong>=3){
    renderBattleMain();
    await flushChallengeAnswers(true);
    panel.innerHTML=`<div class="qbox"><h3>今日對戰結束</h3>${challenge.lastMsg}<p>答對：${challenge.status.correct} 題</p><p>明早 7:00 後重置。</p><button class="btn gray" onclick="refreshState().then(()=>{renderChallengeHome();renderBattleMain();})">返回</button></div>`;
    return;
  }

  if(challenge.monsterHp<=0){
    challenge.lastMsg+=`<br><span class="success">🏆 擊敗怪物！下一隻怪物出現。</span>`;
    challenge.monsterNo++;
    challenge.monsterCfg=getMonsterForBattle(challenge.subject,challenge.monsterNo);
    challenge.monsterMaxHp=getMonsterHp(challenge.monsterCfg,challenge.monsterNo);
    challenge.monsterHp=challenge.monsterMaxHp;
  }
  if(challenge.pending.length>=5)flushChallengeAnswers(false);
  renderBattleMain();renderBattle();
}
async function loadMoreBattleQuestions(){try{await flushChallengeAnswers(true);const qs=await gs('getChallengeQuestionBatch',challenge.subject,challenge.seen.slice(-50),30);challenge.questions=qs||[];challenge.qIndex=0;if(!challenge.questions.length)throw new Error('沒有可用題目');challenge.question=challenge.questions[0];renderBattleQuestion();}catch(e){alert(e.message||e);}}
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
async function finishChallengeUI(){try{await flushChallengeAnswers(true);await refreshState();currentTab='challenge';switchMainMode('battle');challenge.subject='';challenge.petId='';renderBattleMain();renderChallengeHome();}catch(e){alert(e.message||e);}}
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
  const unclaimed=mailbox.filter(m=>!(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')).length;
  panel.innerHTML=`<h3>📬 信箱</h3><div class="mail-actions"><button class="btn blue" ${unclaimed?'':'disabled'} onclick="claimAllMailUI()">📦 一鍵收取全部（${unclaimed}）</button><button class="btn gray" onclick="refreshMailboxInBackground(true)">更新信箱</button></div>${mailbox.map(m=>`<div class="mailcard"><b>${esc(m['標題'])}</b><br><span class="small">寄件者：${esc(m['寄件者'])}</span><p>${esc(m['內容'])}</p>${m['附件ID']?`🎁 ${esc(m['附件名稱'])} ×${m['附件數量']}<br>`:''}<button class="btn ${m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE'?'gray':''}" ${(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')?'disabled':''} onclick="claimMailUI('${m['信件ID']}')">${(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')?'已領取':'領取附件'}</button></div>`).join('')||'<div class="mailcard">目前沒有信件。</div>'}`;
}
async function claimAllMailUI(){const targets=mailbox.filter(m=>!(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE'));if(!targets.length)return;targets.forEach(m=>m['是否領取']=true);if(state)state.unreadMail=0;mailBadge.classList.add('hidden');renderMailFromCache();saveLocal('mailbox',mailbox);try{const r=await gs('claimAllMailFast',currentId);if(Array.isArray(r?.mailbox))mailbox=r.mailbox;if(Array.isArray(r?.inventory)){inventory=r.inventory;saveLocal('inventory',inventory);}saveLocal('mailbox',mailbox);renderMailFromCache();}catch(e){alert(e.message||e);await refreshMailboxInBackground(true);}}
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
let purchaseBusy=false,purchaseDotsTimer=null;
function showPurchaseBusy(text='購買中'){
  if(purchaseBusy)return false;
  purchaseBusy=true;
  const ov=document.getElementById('purchaseBusyOverlay');
  const t=document.getElementById('purchaseBusyText');
  const d=document.getElementById('purchaseBusyDots');
  if(t)t.textContent=text;
  if(ov)ov.classList.remove('hidden');
  const seq=['.','..','...','..','.','..','...','..'];let i=0;
  if(d)d.textContent=seq[0];
  clearInterval(purchaseDotsTimer);
  purchaseDotsTimer=setInterval(()=>{i=(i+1)%seq.length;if(d)d.textContent=seq[i];},320);
  return true;
}
function hidePurchaseBusy(){
  purchaseBusy=false;
  clearInterval(purchaseDotsTimer);purchaseDotsTimer=null;
  document.getElementById('purchaseBusyOverlay')?.classList.add('hidden');
}


function inventoryQty(itemId){
  const row=(inventory||[]).find(x=>String(x.itemId)===String(itemId));
  return Number(row?.quantity||0);
}
function backgroundAcquireInfo(bg){
  const raw=String(bg['取得方式']??bg.acquireType??'').trim().replace(/\s+/g,'');
  const itemId=String(bg['兌換道具ID']??bg.exchangeItemId??'').trim();
  const qtyRaw=(bg['兌換數量']??bg.exchangeQty);
  const qty=(qtyRaw===''||qtyRaw===null||qtyRaw===undefined)?null:Number(qtyRaw);

  // V5.6.4：只要有「兌換道具ID + 正數兌換數量」，一律視為寶物背景。
  // 這樣即使舊快取把取得方式誤傳成金幣，也不會跑錯區。
  const hasTreasureRule=!!itemId && Number.isFinite(qty) && qty>0;
  const method=(raw==='寶物'||raw.includes('兌換')||hasTreasureRule)?'寶物':'金幣';

  const coinPriceRaw=(bg['價格']??bg.price);
  const coinPrice=(coinPriceRaw===''||coinPriceRaw===null||coinPriceRaw===undefined)?null:Number(coinPriceRaw);
  const itemName=String(bg['兌換道具名稱']??bg.exchangeItemName??itemId);
  const validCoin=method==='金幣' && Number.isFinite(coinPrice) && coinPrice>0;
  const validTreasure=method==='寶物' && hasTreasureRule;
  return {method,coinPrice,itemId,qty,itemName,validCoin,validTreasure};
}
async function redeemBackgroundUI(id){
  const bg=getLandShopRows().find(x=>String(x['土地ID'])===String(id));if(!bg)return;
  const ex=backgroundAcquireInfo(bg);
  if(!ex.itemId||ex.qty<=0){alert('這張背景尚未設定兌換寶物與數量。');return;}
  if(inventoryQty(ex.itemId)<ex.qty){alert(`寶物不足，需要 ${ex.itemName} ×${ex.qty}`);return;}
  if(!confirm(`使用 ${ex.itemName} ×${ex.qty} 兌換「${bg['名稱']}」嗎？`))return;
  beginPurchaseBusy('兌換中');
  try{
    const r=await gs('redeemBackgroundFast',currentId,id);
    state.backgrounds=Array.isArray(r.backgrounds)?r.backgrounds:state.backgrounds;
    inventory=Array.isArray(r.inventory)?r.inventory:inventory;
    CLIENT_CACHE.inventory=inventory;CLIENT_CACHE.inventoryAt=Date.now();saveLocal('inventory',inventory);
    await renderShop();
  }catch(e){alert(e.message||e);}
  finally{endPurchaseBusy();}
}

async function renderShop(){
  panel.innerHTML=`<h3>🛒 土地／背景</h3><div class="itemcard">正在同步最新背景設定...</div>`;

  // 每次進入商店都直接抓一次試算表最新設定。
  // 不再拿舊 localStorage / GitHub JSON 判斷金幣或寶物分類。
  try{
    await refreshLiveLandCatalog(false);
  }catch(e){
    panel.innerHTML=`<h3>🛒 土地／背景</h3><div class="itemcard"><b>⚠️ 背景設定同步失敗</b><br>${esc(e.message||e)}<br><br><button class="btn" onclick="renderShop()">重新同步</button></div>`;
    return;
  }

  if(!Array.isArray(inventory))inventory=[];
  if(!inventory.length){
    try{inventory=await gs('getInventory',currentId);}catch(e){}
  }

  const ownedBg=new Set((state.backgrounds||[]).map(String));
  const activePlot=state.lands.find(x=>String(x['土地ID'])===String(state.activeLandId))||state.lands[0];
  const rows=getLandShopRows();

  const coinRows=rows.filter(bg=>backgroundAcquireInfo(bg).method==='金幣');
  const treasureRows=rows.filter(bg=>backgroundAcquireInfo(bg).method==='寶物');

  const cardHtml=(bg)=>{
    const id=String(bg['土地ID']);
    const owned=ownedBg.has(id);
    const using=String(activePlot?.backgroundId)===id;
    const ex=backgroundAcquireInfo(bg);

    let costLine='',action='';
    if(ex.method==='寶物'){
      const have=inventoryQty(ex.itemId);
      costLine=ex.validTreasure
        ? `<span class="exchange-tag">🎁 ${esc(ex.itemName)} ×${ex.qty}</span><br><span class="${have>=ex.qty?'item-count-ok':'item-count-low'}">目前持有 ${have}</span>`
        : `<span class="item-count-low">⚠️ 尚未設定兌換條件</span>`;
      if(owned){
        action=`<button class="btn ${using?'gray':'blue'}" ${using?'disabled':''} onclick="useBackgroundFromShop('${id}')">${using?'目前使用中':'套用到目前土地'}</button>`;
      }else if(ex.validTreasure){
        action=`<button class="btn purple" ${have<ex.qty?'disabled':''} onclick="redeemBackgroundUI('${id}')">兌換背景</button>`;
      }else{
        action=`<button class="btn gray" disabled>無法兌換</button>`;
      }
    }else{
      costLine=ex.validCoin
        ? `<span>🪙 ${ex.coinPrice}</span>`
        : `<span class="item-count-low">⚠️ 尚未設定金幣價格</span>`;
      if(owned){
        action=`<button class="btn ${using?'gray':'blue'}" ${using?'disabled':''} onclick="useBackgroundFromShop('${id}')">${using?'目前使用中':'套用到目前土地'}</button>`;
      }else if(ex.validCoin){
        action=`<button class="btn blue" onclick="buyBackgroundUI('${id}')">購買背景</button>`;
      }else{
        action=`<button class="btn gray" disabled>不可購買</button>`;
      }
    }
    return `<div class="itemcard"><b>${esc(bg['名稱'])}</b><div class="bg-thumb" style="background-image:url('${esc(bg['背景圖片'])}')"></div>${costLine}<br>${action}</div>`;
  };

  panel.innerHTML=`<h3>🛒 土地／背景</h3>
  <div class="row" style="justify-content:space-between;align-items:center"><span class="success">✓ 已同步試算表最新設定</span><button class="btn gray" onclick="renderShop()">↻ 重新同步</button></div>
  <div class="home-section"><h4>➕ 購買土地</h4><p>每增加 1 格土地：🪙 2000</p><button class="btn" onclick="buyPlotUI()">購買 1 格土地</button></div>
  <h4>🪙 金幣背景</h4>
  <div class="shop-grid">${coinRows.map(cardHtml).join('')||'<div class="itemcard">目前沒有金幣背景。</div>'}</div>
  <h4 style="margin-top:18px">🎁 寶物兌換背景</h4>
  <div class="shop-grid">${treasureRows.map(cardHtml).join('')||'<div class="itemcard">目前沒有寶物兌換背景。</div>'}</div>`;
}
async function buyPlotUI(){
  if(!showPurchaseBusy('購買土地中'))return;
  try{
    const r=await gs('buyPlotFast',currentId);
    state.student.coins=r.coins;coins.textContent=r.coins;
    if(r.plot&&!state.lands.some(l=>String(l['土地ID'])===String(r.plot['土地ID']))){
      state.lands.push(applyStaticConfigsToState({lands:[r.plot]}).lands[0]);
    }
    renderYard();renderShop();
  }catch(e){alert(e.message||e);}finally{hidePurchaseBusy();}
}
async function buyBackgroundUI(id){
  const bg=getLandShopRows().find(x=>String(x['土地ID'])===String(id));
  if(!bg)return;
  const ex=backgroundAcquireInfo(bg);
  if(ex.method!=='金幣'){
    alert('這張背景不是金幣購買背景，請使用寶物兌換。');
    return;
  }
  if(!ex.validCoin){
    alert('這張背景尚未設定有效的金幣價格，暫時不能購買。');
    return;
  }
  if(!confirm(`確定花費 ${ex.coinPrice} 金幣購買「${bg['名稱']}」嗎？`))return;
  beginPurchaseBusy('購買中');
  try{
    const r=await gs('buyBackgroundFast',currentId,id);
    state.backgrounds=Array.isArray(r.backgrounds)?r.backgrounds:state.backgrounds;
    if(r.coins!==undefined){state.student.coins=r.coins;coins.textContent=r.coins;}
    await renderShop();
  }catch(e){alert(e.message||e);}
  finally{endPurchaseBusy();}
}
async function useBackgroundFromShop(id){
  const plot=state.lands.find(l=>String(l['土地ID'])===String(state.activeLandId));
  if(!plot)return alert('找不到目前土地');
  const oldBg=plot.backgroundId,oldConfig=plot.config;
  const cfg=liveLandById(id);
  if(!cfg)return alert('找不到背景設定');
  // 先立即換畫面，避免學生覺得按鈕沒有作用。
  plot.backgroundId=String(id);plot['背景ID']=String(id);plot.config={...(plot.config||{}),'土地ID':cfg.landId,'名稱':cfg.name,'價格':cfg.price,'背景圖片':cfg.background,'寬度':cfg.width,'高度':cfg.height,'是否開放':cfg.enabled};
  renderYard();renderHome();
  try{
    await gs('setPlotBackgroundFast',currentId,state.activeLandId,id);
  }catch(e){
    plot.backgroundId=oldBg;plot['背景ID']=oldBg;plot.config=oldConfig;renderYard();renderHome();alert('背景套用失敗：'+(e.message||e));
  }
}
function logout(){
  currentId='';state=null;mainMode='home';inventory=[];mailbox=[];shop=null;mailboxLoaded=false;mailboxAt=0;adminPassword='';sessionStorage.removeItem('petHouseAdminPassword');
  if(wanderTimer)clearInterval(wanderTimer);
  if(backgroundMailTimer)clearInterval(backgroundMailTimer);
  studentView.classList.add('hidden');adminView.classList.add('hidden');loginView.classList.remove('hidden');
}
let adminPassword=sessionStorage.getItem('petHouseAdminPassword')||'';
async function openAdmin(){const pw=prompt('請輸入老師後台密碼：');if(!pw)return;try{await gs('adminLogin',pw);adminPassword=pw;sessionStorage.setItem('petHouseAdminPassword',pw);loginView.classList.add('hidden');adminView.classList.remove('hidden');await loadAdmin();}catch(e){alert('密碼錯誤或後台驗證失敗：'+(e.message||e));}}
async function loadAdmin(){if(!adminPassword){logout();return;}adminData=await gs('getAdminDataSecure',adminPassword);const itemOpts=adminData.items.map(x=>`<option value="${x['道具ID']}">${esc(x['名稱'])}</option>`).join('');const petOpts=adminData.pets.map(x=>`<option value="${x.petId}">${esc(x.name)}</option>`).join('');adminArea.innerHTML=`<table class="admin-table"><thead><tr><th>座號</th><th>學生</th><th>金幣</th><th>發獎勵</th></tr></thead><tbody>${adminData.students.map(s=>`<tr><td>${s.seat||''}</td><td>${esc(s.name)}<br><span class="small">${esc(s.id)}</span></td><td>${s.coins}</td><td><div class="row"><button class="btn" onclick="adminCoin('${s.id}',10)">+10🪙</button><select id="it-${s.id}">${itemOpts}</select><input id="iq-${s.id}" type="number" min="1" value="1" style="width:65px"><button class="btn purple" onclick="adminItem('${s.id}')">發道具</button><select id="pt-${s.id}">${petOpts}</select><button class="btn secondary" onclick="adminPet('${s.id}')">發寵物</button></div></td></tr>`).join('')}</tbody></table>`;}
async function adminCoin(id,n){await gs('adminAddCoins',adminPassword,id,n,'課堂獎勵');await loadAdmin();}
async function adminItem(id){const item=document.getElementById('it-'+id).value,qty=Number(document.getElementById('iq-'+id).value||1);try{await gs('adminGrantItem',adminPassword,id,item,qty,'課堂獎勵');alert('已發放');}catch(e){alert(e.message||e);}}
async function adminPet(id){const p=document.getElementById('pt-'+id).value;try{await gs('adminAssignPet',adminPassword,id,p);alert('已分配寵物');}catch(e){alert(e.message||e);}}
