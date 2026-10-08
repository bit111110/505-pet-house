const FRONTEND_BUILD='20261008-v610-battle-performance';
const STONE_SPRITE_URL_V610='assets/items/stones/attribute-stones.png';
const STONE_SPRITES_V610={LIGHT:0,EARTH:1,DARK:2,GRASS:3,WATER:4,POISON:5,FIRE:6,ELECTRIC:7,ICE:8,WIND:9,STEEL:10,CHAOS:11};
const STONE_ATTRIBUTES_V610=['光','地','暗','草','水','毒','火','電','冰','風','鋼','混沌'];
let STONE_IMAGE_STATE_V610='idle',STONE_IMAGE_PROMISE_V610=null;
function itemImageHtmlV610(itemId,config={},size=40){
  config=config||{};
  const index=String(itemId).startsWith('STONE_')?STONE_SPRITES_V610[String(itemId).slice(6)]:undefined;
  if(index!==undefined)return `<span class="stone-item-sprite" data-stone-sprite="${index}" style="--item-size:${Number(size)||40}px" role="img" aria-label="${STONE_ATTRIBUTES_V610[index]}之石" title="${STONE_ATTRIBUTES_V610[index]}之石"><span>💎</span></span>`;
  const src=config['圖片']||config.image||'';
  return src?`<span class="item-image" style="--item-size:${Number(size)||40}px"><span>🎁</span><img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()"></span>`:'<span class="item-image item-image-empty" aria-hidden="true">🎁</span>';
}
function activateStoneSpritesV610(){
  if(typeof document==='undefined')return;
  const elements=[...document.querySelectorAll('[data-stone-sprite]')];if(!elements.length)return;
  const apply=()=>document.querySelectorAll('[data-stone-sprite]').forEach(el=>{
    if(STONE_IMAGE_STATE_V610!=='ready')return;
    const index=Number(el.dataset.stoneSprite);
    el.style.backgroundImage=`url("${STONE_SPRITE_URL_V610}")`;
    el.style.backgroundPosition=`${index%4*100/3}% ${Math.floor(index/4)*50}%`;
    el.classList.add('sprite-ready');
  });
  if(STONE_IMAGE_STATE_V610==='ready'){apply();return;}
  if(STONE_IMAGE_STATE_V610==='failed')return;
  if(!STONE_IMAGE_PROMISE_V610){
    STONE_IMAGE_STATE_V610='loading';
    STONE_IMAGE_PROMISE_V610=new Promise(resolve=>{const image=new Image();image.onload=()=>{STONE_IMAGE_STATE_V610='ready';resolve();};image.onerror=()=>{STONE_IMAGE_STATE_V610='failed';resolve();};image.src=STONE_SPRITE_URL_V610;});
  }
  STONE_IMAGE_PROMISE_V610.then(apply);
}
function renderAdminItemPreviewV610(){
  const root=document.getElementById('adminItemPreviewV610'),id=document.getElementById('adminBatchItemV610')?.value;
  if(root){root.innerHTML=itemImageHtmlV610(id,adminData?.items.find(x=>String(x['道具ID'])===id)||{},48);activateStoneSpritesV610();}
}

// Public metadata only. Cache is loaded on first furniture visit, never during login.
let FURNITURE_CACHE_V610=null,FURNITURE_VIEW_EPOCH_V610=0,FURNITURE_OBSERVER_V610=null,FURNITURE_VISIBILITY_V610=null;
const FURNITURE_CACHE_KEY_V610='petHouseFurnitureV610:'+FRONTEND_BUILD;
function furnitureCacheClientV610(){
  if(!FURNITURE_CACHE_V610){
    let saved=null;try{saved=JSON.parse(localStorage.getItem(FURNITURE_CACHE_KEY_V610)||'null');}catch(e){}
    FURNITURE_CACHE_V610={series:Array.isArray(saved?.series)?saved.series:null,bySeries:Object.assign(Object.create(null),saved?.bySeries&&typeof saved.bySeries==='object'?saved.bySeries:{}),loading:{}};
  }
  return FURNITURE_CACHE_V610;
}
function saveFurnitureCacheV610(cache){if(cache!==FURNITURE_CACHE_V610)return;try{localStorage.setItem(FURNITURE_CACHE_KEY_V610,JSON.stringify({series:cache.series,bySeries:cache.bySeries}));}catch(e){}}
async function loadFurnitureMetadataV610(id,refresh=false){
  const cache=furnitureCacheClientV610(),key=id?'SERIES:'+id:'HOME';
  if(!refresh&&(id?Object.prototype.hasOwnProperty.call(cache.bySeries,id):cache.series!==null))return id?cache.bySeries[id]:cache.series;
  if(!cache.loading[key])cache.loading[key]=(async()=>{
    const r=id?await gs('getFurnitureBySeriesV610',id,refresh):await gs('getFurnitureSeriesV610',refresh);
    if(r.ok===false)throw Error(r.message||'無法讀取家具');
    const value=id?r.items:r.series;if(!Array.isArray(value))throw Error('家具資料格式錯誤');
    if(id)cache.bySeries[id]=value;else cache.series=value;saveFurnitureCacheV610(cache);return value;
  })().finally(()=>delete cache.loading[key]);
  return cache.loading[key];
}
function cleanupFurnitureViewV610(){
  FURNITURE_VIEW_EPOCH_V610++;FURNITURE_OBSERVER_V610?.disconnect();FURNITURE_OBSERVER_V610=null;
  if(FURNITURE_VISIBILITY_V610){window.removeEventListener('scroll',FURNITURE_VISIBILITY_V610,true);window.removeEventListener('resize',FURNITURE_VISIBILITY_V610);FURNITURE_VISIBILITY_V610=null;}
  const root=document.getElementById('furnitureMain');if(root)root.innerHTML='';
}
function furnitureImageHtmlV610(src,label){
  return `<div class="furniture-image"><span class="furniture-image-fallback" role="img" aria-label="${esc(label)}">🪑</span>${src?`<img data-furniture-src="${esc(src)}" alt="${esc(label)}" loading="lazy" decoding="async" onload="this.parentElement.classList.add('image-ready')" onerror="this.remove()">`:''}</div>`;
}
function activateFurnitureImagesV610(){
  const images=[...document.querySelectorAll('#furnitureMain [data-furniture-src]')];
  const load=img=>{img.src=img.dataset.furnitureSrc;delete img.dataset.furnitureSrc;};
  if(typeof IntersectionObserver!=='undefined'){
    FURNITURE_OBSERVER_V610=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){load(e.target);FURNITURE_OBSERVER_V610.unobserve(e.target);}}),{rootMargin:'0px'});
    images.forEach(img=>FURNITURE_OBSERVER_V610.observe(img));
  }else{
    FURNITURE_VISIBILITY_V610=()=>images.forEach(img=>{const r=img.getBoundingClientRect();if(img.dataset.furnitureSrc&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0)load(img);});
    window.addEventListener('scroll',FURNITURE_VISIBILITY_V610,true);window.addEventListener('resize',FURNITURE_VISIBILITY_V610);FURNITURE_VISIBILITY_V610();
  }
}
async function renderFurnitureV610(seriesId='',refresh=false){
  cleanupFurnitureViewV610();const epoch=FURNITURE_VIEW_EPOCH_V610,root=document.getElementById('furnitureMain');if(!root)return;
  if(refresh){FURNITURE_CACHE_V610={series:null,bySeries:Object.create(null),loading:{}};try{localStorage.removeItem(FURNITURE_CACHE_KEY_V610);}catch(e){}}
  panel.innerHTML='<h3>🪑 家具系列</h3><p>選擇系列瀏覽家具與預覽圖片。</p>';
  root.innerHTML='<p class="furniture-empty">載入家具資料中…</p>';
  try{
    const rows=await loadFurnitureMetadataV610(seriesId,refresh);
    if(epoch!==FURNITURE_VIEW_EPOCH_V610||currentTab!=='furniture')return;
    const series=furnitureCacheClientV610().series?.find(s=>s.seriesId===seriesId);
    root.innerHTML=`<div class="furniture-heading"><h2>${esc(seriesId?(series?.name||seriesId):'家具系列')}</h2><div class="row">${seriesId?'<button class="btn gray" onclick="renderFurnitureV610()">返回系列</button>':''}<button class="btn secondary" onclick="renderFurnitureV610('',true)">重新整理系列</button></div></div><div class="furniture-grid">${rows.map((x,i)=>seriesId?`<article class="furniture-card">${furnitureImageHtmlV610(x.thumbnail,x.name)}<h3>${esc(x.name)}</h3><p>${esc(x.type)} · ${esc(x.price)} 金幣</p><button class="btn secondary furniture-preview-button" data-index="${i}" data-series="${esc(seriesId)}">預覽原圖</button></article>`:`<button class="furniture-card furniture-series-button" data-series="${esc(x.seriesId)}">${furnitureImageHtmlV610(x.previewImage,x.name)}<h3>${esc(x.name)}</h3><p>${Number(x.itemCount)||0} 件家具</p></button>`).join('')||'<p class="furniture-empty">目前沒有已啟用的家具。請老師在家具設定中加入系列與素材。</p>'}</div><div id="furniturePreviewV610"></div>`;
    root.querySelectorAll('.furniture-series-button').forEach(btn=>btn.onclick=()=>renderFurnitureV610(btn.dataset.series));
    root.querySelectorAll('.furniture-preview-button').forEach(btn=>btn.onclick=()=>previewFurnitureV610(btn.dataset.series,Number(btn.dataset.index)));
    activateFurnitureImagesV610();
  }catch(e){if(epoch===FURNITURE_VIEW_EPOCH_V610)root.innerHTML=`<p class="furniture-empty">${esc(e.message||e)}</p><button class="btn" onclick="renderFurnitureV610('',true)">重試</button>`;}
}
function previewFurnitureV610(seriesId,index){
  const item=furnitureCacheClientV610().bySeries[seriesId]?.[index],root=document.getElementById('furniturePreviewV610');if(!item||!root)return;
  root.innerHTML=`<section class="furniture-preview"><button class="btn gray" onclick="document.getElementById('furniturePreviewV610').innerHTML=''">關閉預覽</button><h3>${esc(item.name)}</h3>${furnitureImageHtmlV610(item.image,item.name)}</section>`;
  // Full asset is assigned only after an explicit preview click, never as thumbnail fallback.
  const image=root.querySelector('[data-furniture-src]');if(image){image.src=image.dataset.furnitureSrc;delete image.dataset.furnitureSrc;}
  root.scrollIntoView({behavior:'smooth',block:'nearest'});
}
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
let BATTLE_BG_LIST = [];
let PET_BATTLE_CONFIGS = {};
let ITEM_CONFIGS = {};
let STATIC_CATALOGS_READY=false;
let STATIC_CATALOGS_AT=0;

const STATIC_CATALOG_CACHE_KEY='petHouseStaticCatalogsV598';
const STATIC_CATALOG_CACHE_MS=6*60*60*1000;

function readStaticCatalogCache(){
  try{
    const x=JSON.parse(localStorage.getItem(STATIC_CATALOG_CACHE_KEY)||'null');
    if(!x||!x.data)return null;
    return x;
  }catch(e){return null;}
}
function saveStaticCatalogCache(data){
  try{localStorage.setItem(STATIC_CATALOG_CACHE_KEY,JSON.stringify({at:Date.now(),data}));}catch(e){}
}
function applyStaticCatalogBundle(data){
  if(!data||typeof data!=='object')return;
  if(Array.isArray(data.pets)&&data.pets.length){
    STATIC_PETS=data.pets;
    PET_CONFIGS=Object.fromEntries(STATIC_PETS.map(p=>[String(p.petId),p]));
  }
  if(Array.isArray(data.lands)&&data.lands.length){
    STATIC_LANDS=data.lands;
    LAND_CONFIGS=Object.fromEntries(STATIC_LANDS.map(l=>[String(l.landId),l]));
  }
  if(Array.isArray(data.monsters)&&data.monsters.length){
    MONSTER_LIST=data.monsters;
    MONSTER_CONFIGS=Object.fromEntries(MONSTER_LIST.map(m=>[String(m.monsterId),m]));
  }
  if(Array.isArray(data.battleBackgrounds)&&data.battleBackgrounds.length){
    BATTLE_BG_LIST=data.battleBackgrounds;
  }
  if(Array.isArray(data.petBattleConfigs)&&data.petBattleConfigs.length){
    PET_BATTLE_CONFIGS=Object.fromEntries(data.petBattleConfigs.map(x=>[String(x.petId),x]));
  }
  if(Array.isArray(data.items)&&data.items.length){
    ITEM_CONFIGS=Object.fromEntries(data.items.map(x=>[String(x.itemId||x['道具ID']),x]));
  }
  if(Array.isArray(data.backgrounds)&&data.backgrounds.length){
    LIVE_LAND_CONFIGS=Object.fromEntries(data.backgrounds.map(x=>[String(x.landId),x]));
    liveLandCatalogAt=Date.now();
  }
  STATIC_CATALOGS_READY=true;
  STATIC_CATALOGS_AT=Date.now();
}
async function fetchOptionalJson(path){
  try{
    const r=await fetch(path+'?v='+FRONTEND_BUILD,{cache:'force-cache'});
    if(!r.ok)return null;
    const j=await r.json();
    return Array.isArray(j)?j:null;
  }catch(e){return null;}
}
async function loadStaticGameData(){
  // V5.9.8：Google 試算表是唯一設定來源。
  // 開頁面先用上次儲存在瀏覽器的快取，完全不阻塞登入。
  const cached=readStaticCatalogCache();
  if(cached?.data){
    applyStaticCatalogBundle(cached.data);
    return true;
  }
  return false;
}

async function refreshStaticCatalogsV598(force=false){
  const cached=readStaticCatalogCache();
  const fresh=cached && (Date.now()-Number(cached.at||0)<STATIC_CATALOG_CACHE_MS);
  if(!force && fresh){
    applyStaticCatalogBundle(cached.data);
    return cached.data;
  }
  try{
    const data=await gsRaw('getStaticCatalogBundleV598');
    if(data){
      applyStaticCatalogBundle(data);
      saveStaticCatalogCache(data);
    }
    return data;
  }catch(e){
    console.warn('共用設定背景更新失敗',e);
    return cached?.data||null;
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
        attribute:p.attribute||cfg.attribute||'光',
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


function loadLandCatalogLocalV5106(){
  try{
    const x=JSON.parse(localStorage.getItem('petHouseLandCatalogV5106')||'null');
    return x&&Array.isArray(x.rows)?x:null;
  }catch(e){return null;}
}
function saveLandCatalogLocalV5106(rows){
  try{localStorage.setItem('petHouseLandCatalogV5106',JSON.stringify({at:Date.now(),rows:rows||[]}));}catch(e){}
}
function applyLandCatalogV5106(rows){
  if(!Array.isArray(rows))return;
  LIVE_LAND_CONFIGS=Object.fromEntries(rows.map(r=>[String(r.landId),r]));
  liveLandCatalogAt=Date.now();
  saveLandCatalogLocalV5106(rows);
}
async function ensureLandCatalogV5106(force=false){
  const local=loadLandCatalogLocalV5106();
  if(!force && local?.rows?.length){applyLandCatalogV5106(local.rows);return local.rows;}
  const rows=await gsRaw('getBackgroundCatalogFast');
  if(!Array.isArray(rows))throw new Error('後端沒有回傳背景資料');
  applyLandCatalogV5106(rows);
  return rows;
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
  const rows=await ensureLandCatalogV5106(true);
  if(state && Array.isArray(state.lands)){
    state.lands=state.lands.map(l=>{
      const id=String(l.backgroundId||l['背景ID']||'LAND001');
      const cfg=liveLandById(id);
      if(!cfg)return l;
      return {...l,config:{...(l.config||{}),'土地ID':cfg.landId,'名稱':cfg.name,'價格':cfg.price,'背景圖片':cfg.background,'寬度':cfg.width,'高度':cfg.height,'是否開放':cfg.enabled}};
    });
  }
  if(forceRender){if(currentTab==='home')renderHome();renderYard();}
  return rows;
}

let currentId='',state=null,currentTab='home',mainMode='home',wanderTimer=null,inventory=[],mailbox=[],shop=null,adminData=null,challenge={subject:'',petId:'',question:null,savedProgress:null,saving:false};
let mailboxLoaded=false,mailboxAt=0,mailRefreshPromise=null,backgroundMailTimer=null;
const CLIENT_CACHE={shop:null,shopAt:0,inventory:null,inventoryAt:0};
const QUESTION_BANK_CACHE={};
const QUESTION_BANK_LOADED={};
const API_DIAG_LOG=[];
const API_DIAG_MAX=80;
function recordApiDiag(fn,ms,ok,message=''){
  API_DIAG_LOG.unshift({at:Date.now(),fn:String(fn),ms:Number(ms||0),ok:!!ok,message:String(message||'')});
  if(API_DIAG_LOG.length>API_DIAG_MAX)API_DIAG_LOG.length=API_DIAG_MAX;
}
function diagLevel(ms){
  if(ms<2000)return {label:'🟢 良好',cls:'success'};
  if(ms<5000)return {label:'🟡 尚可',cls:''};
  if(ms<10000)return {label:'🟠 偏慢',cls:'wrong'};
  return {label:'🔴 很慢',cls:'wrong'};
}

let CHALLENGE_HOME_META=null;
let CHALLENGE_HOME_LOADING=null;
const QUESTION_BROWSER_CACHE_MS=6*60*60*1000;
let POST_LOGIN_LOADING=null;
let QUESTION_BANK_READY=false;
let adminBusyItem=new Set();
let EXP_USE_BUSY=false;
let STUDENT_TOKEN_V600='',UPGRADE_MODE_V600='exp',UPGRADE_PET_V600='',UPGRADE_AT_V600=0,UPGRADE_LOADING_V600=null,STONE_BUSY_V600=false;
let STONE_CATALOG_V600=[],UPGRADE_READY_V600=false;
let UPGRADE_NOTICE_V600='';

let DRAGGING_PET_ID='';

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
  const cachedInv=loadLocal('inventory');
  const inv=Array.isArray(cachedInv)?cachedInv:cachedInv?.inventory;
  if(Array.isArray(inv)){inventory=inv;CLIENT_CACHE.inventory=inv;CLIENT_CACHE.inventoryAt=Date.now();}
  const sh=loadLocal('shop');
  if(sh){shop=sh;CLIENT_CACHE.shop=sh;CLIENT_CACHE.shopAt=Date.now();}
  const lc=loadLocal('landCatalog');
  if(Array.isArray(lc)){
    LIVE_LAND_CONFIGS=Object.fromEntries(lc.map(r=>[String(r.landId),r]));
    liveLandCatalogAt=Date.now();
  }
}

function shuffleCopy(arr){
  const a=[...(arr||[])];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function installQuestionBank(bundle){
  if(!bundle || typeof bundle!=='object')return;
  ['國語','數學','英文','自然','社會'].forEach(s=>{
    if(Array.isArray(bundle[s])){
      QUESTION_BANK_CACHE[s]=bundle[s];
      QUESTION_BANK_LOADED[s]=true;
    }
  });
  QUESTION_BANK_READY=Object.keys(QUESTION_BANK_CACHE).some(k=>Array.isArray(QUESTION_BANK_CACHE[k])&&QUESTION_BANK_CACHE[k].length);
  if(currentTab==='challenge'&&mainMode==='battle'&&challenge.active)renderBattle();
}

function localQuestionBatch(subject,excludeIds=[],limit=30){
  const src=QUESTION_BANK_CACHE[String(subject)]||[];
  if(!src.length)return [];
  const ex=new Set((excludeIds||[]).map(String));
  let pool=src.filter(q=>!ex.has(String(q.id)));
  if(!pool.length)pool=[...src];
  return shuffleCopy(pool).slice(0,Math.max(1,limit));
}
function questionCacheKey(subject){return 'petHouseQuestionV5106Display:'+String(subject||'');}
function readQuestionBrowserCache(subject){
  try{
    const x=JSON.parse(localStorage.getItem(questionCacheKey(subject))||'null');
    if(!x||!Array.isArray(x.rows)||Date.now()-Number(x.at||0)>QUESTION_BROWSER_CACHE_MS)return null;
    return x.rows;
  }catch(e){return null;}
}
function saveQuestionBrowserCache(subject,rows){
  try{localStorage.setItem(questionCacheKey(subject),JSON.stringify({at:Date.now(),rows:rows||[]}));}catch(e){}
}
async function ensureQuestionBank(subject){
  subject=String(subject||'');
  if(QUESTION_BANK_LOADED[subject])return QUESTION_BANK_CACHE[subject]||[];

  const local=readQuestionBrowserCache(subject);
  if(Array.isArray(local)){
    QUESTION_BANK_CACHE[subject]=local;
    QUESTION_BANK_LOADED[subject]=true;
    QUESTION_BANK_READY=QUESTION_BANK_READY||local.length>0;
    if(currentTab==='challenge'&&mainMode==='battle'&&challenge.active)renderBattle();
    return local;
  }

  const rows=await gsRaw('getQuestionBankSubjectFast',subject);
  QUESTION_BANK_CACHE[subject]=Array.isArray(rows)?rows:[];
  QUESTION_BANK_LOADED[subject]=true;
  saveQuestionBrowserCache(subject,QUESTION_BANK_CACHE[subject]);
  QUESTION_BANK_READY=Object.keys(QUESTION_BANK_CACHE).some(k=>Array.isArray(QUESTION_BANK_CACHE[k])&&QUESTION_BANK_CACHE[k].length);
  if(currentTab==='challenge'&&mainMode==='battle'&&challenge.active)renderBattle();
  return QUESTION_BANK_CACHE[subject];
}

async function hydrateAfterLoginV596(){
  if(POST_LOGIN_LOADING)return POST_LOGIN_LOADING;
  POST_LOGIN_LOADING=(async()=>{
    try{
      const [_,bundle]=await Promise.all([
        STATIC_DATA_READY.catch(()=>false),
        gsRaw('getPostLoginBundleV5101',currentId)
      ]);
      if(bundle?.core)applyStudentState(bundle.core);
      if(bundle?.challengeStatus && state)state.challengeStatus=bundle.challengeStatus;
      if(bundle?.runtime){
        const r=bundle.runtime;
        if(Array.isArray(r.inventory)){
          inventory=r.inventory;
          CLIENT_CACHE.inventory=inventory;
          CLIENT_CACHE.inventoryAt=Date.now();
          saveLocal('inventory',inventory);
        }
      }

      // V5.10.6：登入後不再自動抓整包共用設定，避免全班同時登入造成尖峰。
      // V5.10.1：登入後不再預抓五科題庫、不再自動讀完整信箱。
      // 挑戰資料只在學生真的點「對戰」時讀；信箱只在學生點「信箱」時讀。
      if(currentTab==='home')renderHome();
      renderYard();
      await waitForLoginImagesV5104();
      return bundle;
    }catch(e){
      console.warn('登入後背景資料載入失敗',e);
      return null;
    }finally{
      POST_LOGIN_LOADING=null;
    }
  })();
  return POST_LOGIN_LOADING;
}


let WAITING_COUNT=0;
function showWaiting(text='等待中...'){
  WAITING_COUNT++;
  const ov=document.getElementById('globalWaitingOverlay');
  const tx=document.getElementById('globalWaitingText');
  if(tx)tx.textContent=text||'等待中...';
  if(ov)ov.classList.add('show');
}
function hideWaiting(){
  WAITING_COUNT=Math.max(0,WAITING_COUNT-1);
  if(WAITING_COUNT===0){
    const ov=document.getElementById('globalWaitingOverlay');
    if(ov)ov.classList.remove('show');
  }
}
function waitingLabelFor(fn){
  const map={
    loginFastV596:'登入中...',
    getPostLoginBundleV5101:'載入小屋與圖片中...',
    loginCore:'登入中...',
    getPostLoginBundleV596:'載入小屋資料中...',
    getQuestionBankSubjectFast:'載入題庫中...',
    getQuestionBankBundleFast:'載入題庫中...',
    startChallengeBatch:'準備戰鬥中...',
    submitChallengeBatch:'同步答題紀錄中...',
    getRuntimeBundleFast:'載入遊戲資料中...',
    adminGrantItemFast:'發放道具中...',
    adminGrantItem:'發放道具中...',
    getMailbox:'載入信箱中...',
    collectAllMailbox:'領取信件中...',
    getInventory:'載入背包中...',
    feedExpFastV55:'升級寵物中...',
    getMonsterCatalogFast:'載入怪物資料中...',
    getBattleBackgroundCatalogFast:'載入戰鬥背景中...',
    adminRefreshGameConfigV598:'更新遊戲設定中...'
  };
  return map[fn]||'等待中...';
}

async function gsRaw(fn,...args){
  if(!window.API_URL || /PASTE|YOUR|貼上/i.test(window.API_URL)){
    throw new Error('尚未設定 Apps Script API 網址。請打開 config.js 貼上部署後的 /exec 網址。');
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),25000);
  const t0=performance.now();
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
    try{payload=JSON.parse(text);}catch(e){
      recordApiDiag(fn,performance.now()-t0,false,'API 回傳非 JSON');
      throw new Error('API 回傳格式錯誤：'+text.slice(0,120));
    }
    if(!payload || payload.apiOk!==true){
      recordApiDiag(fn,performance.now()-t0,false,payload?.message||'API 呼叫失敗');
      throw new Error(payload?.message||'API 呼叫失敗');
    }
    recordApiDiag(fn,performance.now()-t0,true,'');
    return payload.result;
  }catch(e){
    if(e.name==='AbortError'){
      recordApiDiag(fn,performance.now()-t0,false,'連線逾時');
      throw new Error('連線逾時，請再試一次。');
    }
    throw e;
  }finally{clearTimeout(timer);}
}

async function gs(fn,...args){
  const shouldShow = ![
    'getUnreadMailCountFast',
    'heartbeat',
    'logLogin',
    'getMailboxFast_'
  ].includes(fn);
  if(shouldShow)showWaiting(waitingLabelFor(fn));
  try{
    return await gsRaw(fn,...args);
  }finally{
    if(shouldShow)hideWaiting();
  }
}

function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function formatMathText(v){
  let s=esc(v);
  // 只轉換獨立的 a/b，不處理網址、日期、檔案路徑。
  return s.replace(/(^|[^\w.\/-])(\d{1,3})\/(\d{1,3})(?=$|[^\w.\/-])/g,
    (m,prefix,n,d)=>`${prefix}<span class="math-frac"><span class="num">${n}</span><span class="den">${d}</span></span>`);
}



function waitImageLoadedV5104(img,timeoutMs=7000){
  return new Promise(resolve=>{
    if(!img || (img.complete && img.naturalWidth>0)){resolve(true);return;}
    let done=false;
    const finish=(ok)=>{if(done)return;done=true;clearTimeout(timer);img.removeEventListener('load',onLoad);img.removeEventListener('error',onErr);resolve(ok);};
    const onLoad=()=>finish(true),onErr=()=>finish(false);
    img.addEventListener('load',onLoad,{once:true});
    img.addEventListener('error',onErr,{once:true});
    const timer=setTimeout(()=>finish(false),timeoutMs);
  });
}
async function waitForLoginImagesV5104(){
  const yard=document.getElementById('yard');
  if(!yard)return;
  showWaiting('圖片載入中...');
  try{
    const imgs=[...yard.querySelectorAll('img')];
    const bg=(yard.style.backgroundImage||'').match(/url\(["']?(.*?)["']?\)/i)?.[1]||'';
    const tasks=imgs.map(img=>waitImageLoadedV5104(img,7000));
    if(bg){
      tasks.push(new Promise(resolve=>{
        const im=new Image();let done=false;
        const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve(true);};
        im.onload=finish;im.onerror=finish;
        const timer=setTimeout(finish,7000);
        im.src=bg;
      }));
    }
    if(tasks.length)await Promise.allSettled(tasks);
  }finally{
    hideWaiting();
  }
}

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
  if(mainMode==='home')renderYard();
}

async function prefetchStudentData(){
  if(!currentId)return;
  try{
    // V5.8：原本登入後同時打 4 次 Apps Script，改成 1 次 bundle。
    const r=await gs('getRuntimeBundleFast',currentId);

    if(Array.isArray(r?.mailbox)){
      mailbox=r.mailbox;mailboxLoaded=true;mailboxAt=Date.now();saveLocal('mailbox',mailbox);
    }
    if(Array.isArray(r?.inventory)){
      inventory=r.inventory;CLIENT_CACHE.inventory=inventory;CLIENT_CACHE.inventoryAt=Date.now();saveLocal('inventory',inventory);
    }
    if(Array.isArray(r?.backgrounds)){
      LIVE_LAND_CONFIGS=Object.fromEntries(r.backgrounds.map(x=>[String(x.landId),x]));
      liveLandCatalogAt=Date.now();saveLocal('landCatalog',r.backgrounds);
    }
    if(Array.isArray(r?.monsters)){
      MONSTER_LIST=r.monsters;
      MONSTER_CONFIGS=Object.fromEntries(MONSTER_LIST.map(m=>[String(m.monsterId),m]));
    }
    if(Array.isArray(r?.battleBackgrounds))BATTLE_BG_LIST=r.battleBackgrounds;
    if(Array.isArray(r?.petBattleConfigs)){
      PET_BATTLE_CONFIGS=Object.fromEntries(r.petBattleConfigs.map(x=>[String(x.petId),x]));
    }
    if(state){
      state.unreadMail=Number(r?.unreadMail||0);
      mailBadge.textContent=state.unreadMail;
      mailBadge.classList.toggle('hidden',!state.unreadMail);
    }
    if(currentTab==='mail')renderMailFromCache();
    if(currentTab==='shop')renderShop();
    if(mainMode==='battle')renderBattleMain();
  }catch(e){
    console.warn('背景預載失敗',e);
  }
}

function startBackgroundMailboxRefresh(){
  // V5.10.1 教室多人模式：不再定時輪詢信箱。
  // 學生真正進入信箱時才向後端讀一次，避免全班每 5 分鐘同時打 Apps Script。
  if(backgroundMailTimer){clearInterval(backgroundMailTimer);backgroundMailTimer=null;}
}
async function refreshMailboxInBackground(forceRender=false){
  if(!currentId)return;
  if(mailRefreshPromise)return mailRefreshPromise;
  // 主動讀信箱時才呼叫後端；這個呼叫不要蓋住整個遊戲畫面。
  mailRefreshPromise=gsRaw('getMailboxFresh',currentId)
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
    .catch(e=>{console.warn('信箱載入失敗',e);return null;})
    .finally(()=>mailRefreshPromise=null);
  return mailRefreshPromise;
}

function normalizeBirthdayInput(v){const d=String(v||'').replace(/[^0-9]/g,'');if(d.length===3)return '0'+d[0]+'/'+d.slice(1);if(d.length>=4)return d.slice(-4,-2)+'/'+d.slice(-2);const m=String(v||'').match(/(\d{1,2})\D+(\d{1,2})/);return m?String(Number(m[1])).padStart(2,'0')+'/'+String(Number(m[2])).padStart(2,'0'):String(v||'').trim();}
async function login(){
  const id=sid.value.trim(),bd=normalizeBirthdayInput(bday.value);
  loginMsg.textContent='登入中…';
  try{
    // V5.9.6：登入只做身分驗證＋最小資料，首頁立即出現。
    const r=await gs('loginFastV596',id,bd);
    if(!r){loginMsg.textContent='登入失敗：後端沒有回傳資料。';return;}
    if(!r.ok){loginMsg.textContent=r.message||'登入失敗';return;}

    currentId=id;challenge.pending=[];challenge.syncing=null;
    STUDENT_TOKEN_V600=String(r.authToken||'');
    hydrateLocalStudentCache();

    // 先用極小 state 進首頁，不再等待寵物/土地/信箱/題庫全部讀完。
    applyStudentState(r.state||{
      ok:true,version:r.version||'V5.9.6',
      student:{id,name:r.name||id,coins:Number(r.coins||0)},
      pets:[],lands:[],backgrounds:[],activeLandId:'',furniture:[],
      unreadMail:0,challengeStatus:{}
    });

    loginView.classList.add('hidden');
    studentView.classList.remove('hidden');
    currentTab='home';
    document.querySelectorAll('.tabbtn').forEach(x=>x.classList.remove('active'));
    document.querySelector('[data-tab="home"]')?.classList.add('active');

    panel.innerHTML='<div class="petcard"><b>🏠 已登入</b><br><span class="small">正在背景載入寵物與小屋資料…</span></div>';
    switchMainMode('home');

    // 真正的遊戲資料改成背景一次載入，不阻塞登入。
    hydrateAfterLoginV596();
    // 教室多人模式：不啟動定時信箱輪詢。
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
  if(MONSTER_LIST.length)return MONSTER_LIST;
  const cached=readStaticCatalogCache();
  if(cached?.data?.monsters?.length){
    applyStaticCatalogBundle(cached.data);
    if(MONSTER_LIST.length)return MONSTER_LIST;
  }
  try{
    const rows=await gsRaw('getMonsterCatalogFresh');
    if(Array.isArray(rows)){
      MONSTER_LIST=rows;
      BATTLE_CONFIG_READY_V610.monsters=true;
      MONSTER_CONFIGS=Object.fromEntries(rows.map(m=>[String(m.monsterId),m]));
    }
  }catch(e){console.warn('怪物設定載入失敗',e);}
  return MONSTER_LIST;
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



const ATTRIBUTE_SHEET='assets/attributes/attributes.png';
const ATTRIBUTE_ORDER=['光','地','暗','草','水','毒','火','電','冰','風','鋼','混沌'];
const ATTRIBUTE_GRID={cols:4,rows:3};

function attributeIndex(attr){
  return ATTRIBUTE_ORDER.indexOf(String(attr||'光'));
}
function attributeIconHtml(attr,size=24){
  const i=attributeIndex(attr);
  if(i<0)return '';
  const col=i%ATTRIBUTE_GRID.cols,row=Math.floor(i/ATTRIBUTE_GRID.cols);
  return `<span class="attribute-sprite" style="
    width:${size}px;height:${size}px;
    background-image:url('${ATTRIBUTE_SHEET}');
    background-size:${ATTRIBUTE_GRID.cols*size}px ${ATTRIBUTE_GRID.rows*size}px;
    background-position:-${col*size}px -${row*size}px;
  "></span>`;
}


let BATTLE_CONFIG_LOADING_V5106=null;
const BATTLE_CONFIG_READY_V610={monsters:false,backgrounds:false,pets:false};
async function ensureBattleConfigsV5106(){
  if(BATTLE_CONFIG_LOADING_V5106)return BATTLE_CONFIG_LOADING_V5106;
  if(MONSTER_LIST.length && BATTLE_BG_LIST.length && Object.keys(PET_BATTLE_CONFIGS).length)return true;
  BATTLE_CONFIG_LOADING_V5106=(async()=>{
    const jobs=[];
    if(!MONSTER_LIST.length&&!BATTLE_CONFIG_READY_V610.monsters)jobs.push(loadMonsterCatalog());
    if(!BATTLE_BG_LIST.length&&!BATTLE_CONFIG_READY_V610.backgrounds)jobs.push(gsRaw('getBattleBackgroundCatalogFast').then(r=>{if(Array.isArray(r)){BATTLE_BG_LIST=r;BATTLE_CONFIG_READY_V610.backgrounds=true;}}));
    if(!Object.keys(PET_BATTLE_CONFIGS).length&&!BATTLE_CONFIG_READY_V610.pets)jobs.push(gsRaw('getPetBattleConfigFast').then(r=>{if(Array.isArray(r)){PET_BATTLE_CONFIGS=Object.fromEntries(r.map(x=>[String(x.petId),x]));BATTLE_CONFIG_READY_V610.pets=true;}}));
    await Promise.allSettled(jobs);
    return true;
  })().finally(()=>{BATTLE_CONFIG_LOADING_V5106=null;});
  return BATTLE_CONFIG_LOADING_V5106;
}

function getBattleBackground(subject){
  const list=(BATTLE_BG_LIST||[]).filter(x=>x.enabled!==false && (String(x.subject||'全部')==='全部'||String(x.subject)===String(subject||'')));
  return list[0]||null;
}
function getPetBattleConfig(pet){
  return PET_BATTLE_CONFIGS[String(pet?.petId)]||{};
}
function getPetAttribute(pet){
  const b=getPetBattleConfig(pet);
  return String(b.attribute||pet?.attribute||'光');
}

const ATTRIBUTE_SKILLS={
  '光':[[1,'微光彈',20],[5,'聖光閃耀',30],[10,'光之衝擊',45],[15,'耀光之矛',60],[20,'神聖爆發',80],[25,'天穹聖輝',105]],
  '地':[[1,'岩石撞擊',20],[5,'地裂震波',30],[10,'岩壁重擊',45],[15,'大地震擊',60],[20,'巨岩崩落',80],[25,'大地怒吼',105]],
  '暗':[[1,'暗影彈',20],[5,'黑夜侵襲',30],[10,'闇之利刃',45],[15,'深淵衝擊',60],[20,'暗月爆裂',80],[25,'永夜吞噬',105]],
  '草':[[1,'葉片飛刃',20],[5,'藤蔓纏繞',30],[10,'森林之息',45],[15,'荊棘突襲',60],[20,'翠綠風暴',80],[25,'萬木甦醒',105]],
  '水':[[1,'水滴衝擊',20],[5,'水流彈',30],[10,'激流衝鋒',45],[15,'海浪爆破',60],[20,'巨浪奔襲',80],[25,'深海怒濤',105]],
  '毒':[[1,'毒液噴射',20],[5,'毒霧侵蝕',30],[10,'猛毒爆彈',45],[15,'劇毒之牙',60],[20,'毒沼擴散',80],[25,'萬毒侵襲',105]],
  '火':[[1,'火苗彈',20],[5,'烈焰衝擊',30],[10,'火焰爆裂',45],[15,'炎龍吐息',60],[20,'火海爆發',80],[25,'煉獄烈焰',105]],
  '電':[[1,'電光衝擊',20],[5,'雷擊',30],[10,'閃電連鎖',45],[15,'雷霆爆破',60],[20,'落雷風暴',80],[25,'天雷裁決',105]],
  '冰':[[1,'冰晶彈',20],[5,'冰錐突刺',30],[10,'寒冰衝擊',45],[15,'冰封爆裂',60],[20,'冰川崩落',80],[25,'極寒暴風',105]],
  '風':[[1,'風刃',20],[5,'疾風突襲',30],[10,'旋風斬',45],[15,'暴風衝擊',60],[20,'龍捲風暴',80],[25,'蒼穹颶風',105]],
  '鋼':[[1,'鋼鐵衝撞',20],[5,'金屬利刃',30],[10,'鐵壁重擊',45],[15,'鋼鐵爆裂',60],[20,'金屬風暴',80],[25,'鋼之審判',105]],
  '混沌':[[1,'混沌彈',20],[5,'扭曲之力',30],[10,'虛空爆裂',45],[15,'混亂衝擊',60],[20,'次元崩壞',80],[25,'混沌吞噬',105]]
};
const GENERAL_SKILLS=[[3,'奮力一擊',25],[7,'連續攻擊',35],[13,'集中攻擊',50],[17,'強力突擊',65],[23,'極限爆發',85],[27,'全力一擊',110]];

function getConfiguredPetSkills(pet){
  const lv=Math.min(30,Math.max(1,Number(pet?.level||1)));
  const attr=getPetAttribute(pet);
  const result=[];
  (ATTRIBUTE_SKILLS[attr]||ATTRIBUTE_SKILLS['光']).forEach(([unlock,name,damage])=>{
    if(lv>=unlock)result.push({id:`ATTR-${attr}-${unlock}`,name,damage,attribute:attr,kind:'attribute',unlockLevel:unlock});
  });
  GENERAL_SKILLS.forEach(([unlock,name,damage])=>{
    if(lv>=unlock)result.push({id:`GEN-${unlock}`,name,damage,attribute:'一般',kind:'general',unlockLevel:unlock});
  });
  const cfg=getPetBattleConfig(pet);
  if(lv>=30 && cfg.specialName){
    result.push({id:`SPECIAL-${pet.petId}`,name:String(cfg.specialName),damage:Math.max(1,Number(cfg.specialDamage||150)),attribute:attr,kind:'special',unlockLevel:30});
  }
  return result.sort((a,b)=>a.unlockLevel-b.unlockLevel).map(skill=>{
    const baseDamage=skill.damage;
    const bonusDamage=String(state?.skillEnhancements?.[String(pet.petId)]?.[skill.id]||'0');
    const finalDamage=(BigInt(baseDamage)+BigInt(bonusDamage)).toString();
    return {...skill,baseDamage,bonusDamage,finalDamage,damage:finalDamage};
  });
}

// 對戰畫面資源只屬於目前視圖；切頁取消動畫，不丟棄 challenge 答題與存檔狀態。
let BATTLE_VIEW_EPOCH_V600=0;
let BATTLE_SKILLS_SESSION_V610=null;
function battleSkillsV610_(pet){
  const key=[currentId,challenge.subject,pet.petId,pet.level,pet.stage].join(':');
  if(BATTLE_SKILLS_SESSION_V610?.key!==key)BATTLE_SKILLS_SESSION_V610={key,skills:getConfiguredPetSkills(pet)};
  return BATTLE_SKILLS_SESSION_V610.skills;
}
const BATTLE_TIMERS_V600=new Set(),BATTLE_ANIMATIONS_V600=new Set();
function battleTimeoutV600_(callback,ms){
  const timer=setTimeout(()=>{BATTLE_TIMERS_V600.delete(timer);callback();},ms);
  BATTLE_TIMERS_V600.add(timer);return timer;
}
function cleanupBattleViewV600_(){
  BATTLE_SKILLS_SESSION_V610=null;
  BATTLE_VIEW_EPOCH_V600++;
  BATTLE_TIMERS_V600.forEach(clearTimeout);BATTLE_TIMERS_V600.clear();
  BATTLE_ANIMATIONS_V600.forEach(finish=>finish(false));BATTLE_ANIMATIONS_V600.clear();
  challenge.answering=false;
  const root=document.getElementById('battleMain');if(root)root.innerHTML='';
}
function battleControlsV600_(){return document.getElementById('battleControls')||panel;}
function switchMainMode(mode){
  const next=['home','battle','upgrade','furniture'].includes(mode)?mode:'home';
  if(mainMode==='battle' && next!=='battle'){flushChallengeAnswers(false);cleanupBattleViewV600_();}
  if(mainMode==='furniture' && next!=='furniture')cleanupFurnitureViewV610();
  mainMode=next;
  document.getElementById('studentLayout')?.classList.toggle('battle-mode',mainMode==='battle');
  document.getElementById('studentLayout')?.classList.toggle('furniture-mode',mainMode==='furniture');
  document.getElementById('furnitureMain')?.classList.toggle('hidden',mainMode!=='furniture');
  if(mainMode==='furniture'){clearInterval(wanderTimer);wanderTimer=null;}
  const y=document.getElementById('yard'),b=document.getElementById('battleMain');
  if(y)y.classList.toggle('hidden',mainMode!=='home');
  if(b)b.classList.toggle('hidden',mainMode!=='battle');
  document.getElementById('upgradeMain')?.classList.toggle('hidden',mainMode!=='upgrade');
  document.getElementById('upgradeModeBtn')?.classList.toggle('active',mainMode==='upgrade');
  document.getElementById('homeModeBtn')?.classList.toggle('active',mainMode==='home');
  document.getElementById('battleModeBtn')?.classList.toggle('active',mainMode==='battle');
  if(mainMode==='home')renderYard();
  else if(mainMode==='battle'){
    clearInterval(wanderTimer);wanderTimer=null;
    renderBattleMain();
    if(challenge.active){renderBattle();}else if(currentTab==='challenge'){renderChallengeHome();}
  }
}
function showBattleModeV600_(){
  currentTab='challenge';
  document.querySelectorAll('.tabbtn').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab==='challenge'));
  if(challenge.active)switchMainMode('battle');else renderChallengeHome();
}
function renderBattleMain(){
  if(mainMode!=='battle' || challenge.answering)return;
  const root=document.getElementById('battleMain');if(!root)return;
  if(!document.getElementById('battleControls'))root.innerHTML='<section id="battleScene" class="battle-stage-main" aria-label="戰鬥舞台"></section><section id="battleControls" class="battle-controls" aria-label="對戰操作與答題區"></section>';
  const scene=document.getElementById('battleScene');if(!scene)return;
  const pet=state?.pets?.find(p=>String(p.petId)===String(challenge.petId));
  if(!challenge.active || !pet || !challenge.subject){
    scene.classList.add('battle-intro');
    scene.innerHTML='<div><div class="battle-intro-icon">⚔️</div><h2>寵物對戰</h2><p>選擇科目與夥伴，一起出發！</p></div>';
    return;
  }
  scene.classList.remove('battle-intro');
  if(scene.querySelector('.battle-main-scene')){updateBattleStageV610_(pet);return;}
  const mhp=Math.max(0,Number(challenge.monsterHp??challenge.monsterMaxHp??100));
  const mmax=Math.max(1,Number(challenge.monsterMaxHp||100));
  const battleBg=getBattleBackground(challenge.subject);
  scene.innerHTML=`<div class="battle-main-scene" ${battleBg?.image?`style="background-image:url('${esc(battleBg.image)}');background-size:cover;background-position:center"`:''}>
    ${battleBg?.image?'':'<div class="battle-sky"></div><div class="battle-ground"></div>'}
    <div class="battle-status"><div><b>${esc(challenge.subject)}對戰</b>　怪物 ${challenge.monsterNo||1}</div><div>答對 ${challenge.status?.correct||0}　<span class="lives">${'❤️'.repeat(Math.max(0,3-(challenge.status?.wrong||0)))}${'🖤'.repeat(challenge.status?.wrong||0)}</span></div></div>
    <div class="battle-pet-side"><div class="battle-pet-name">${attributeIconHtml(getPetAttribute(pet),26)} ${esc(pet.name)} <span class="small">【${esc(getPetAttribute(pet))}】</span></div><div id="battlePetSprite" class="battle-pet-sprite">${getPetImage(pet.petId,pet.stage)?`<img src="${getPetImage(pet.petId,pet.stage)}">`:'🐾'}</div></div>
    <div class="battle-monster-side"><div class="battle-monster-name">${esc((challenge.monsterCfg||{}).name||('怪物 '+(challenge.monsterNo||1)))}</div><div id="battleMonsterSprite" class="battle-monster-sprite">${(challenge.monsterCfg||{}).image?`<img src="${esc((challenge.monsterCfg||{}).image)}" alt="${esc((challenge.monsterCfg||{}).name||'怪物')}">`:'👾'}</div><div class="hpbar"><div style="width:${Math.max(0,mhp/mmax*100)}%"></div></div><small>HP ${Math.ceil(mhp)} / ${mmax}</small></div>
  </div>`;
  updateBattleStageV610_(pet);
}
function updateBattleSpriteV610_(root,src,fallback){
  if(!root)return;
  const previous=root.querySelector('img');
  if(src){if(previous){if(previous.getAttribute('src')!==src)previous.setAttribute('src',src);}else{root.innerHTML='';const image=document.createElement('img');image.src=src;root.appendChild(image);}}
  else if(previous||root.textContent!==fallback)root.textContent=fallback;
}
function updateBattleStageV610_(pet){
  const scene=document.getElementById('battleScene'),stage=scene?.querySelector('.battle-main-scene');if(!stage)return;
  const hp=Math.max(0,Number(challenge.monsterHp??challenge.monsterMaxHp??100)),max=Math.max(1,Number(challenge.monsterMaxHp||100));
  const bg=getBattleBackground(challenge.subject)?.image||'';
  if(stage.dataset.background!==undefined&&stage.dataset.background!==bg)stage.style.backgroundImage=bg?`url(${JSON.stringify(bg)})`:'';
  stage.dataset.background=bg;
  const status=scene.querySelector('.battle-status'),statusKey=[challenge.subject,challenge.monsterNo,challenge.status?.correct,challenge.status?.wrong].join(':');
  if(status.dataset.key!==statusKey){status.innerHTML=`<div><b>${esc(challenge.subject)}對戰</b>　怪物 ${challenge.monsterNo||1}</div><div>答對 ${challenge.status?.correct||0}　<span class="lives">${'❤️'.repeat(Math.max(0,3-(challenge.status?.wrong||0)))}${'🖤'.repeat(challenge.status?.wrong||0)}</span></div>`;status.dataset.key=statusKey;}
  const name=scene.querySelector('.battle-pet-name'),petKey=[pet.petId,pet.name,getPetAttribute(pet)].join(':');
  if(name.dataset.key!==petKey){name.innerHTML=`${attributeIconHtml(getPetAttribute(pet),26)} ${esc(pet.name)} <span class="small">【${esc(getPetAttribute(pet))}】</span>`;name.dataset.key=petKey;}
  updateBattleSpriteV610_(document.getElementById('battlePetSprite'),getPetImage(pet.petId,pet.stage),'🐾');
  updateBattleSpriteV610_(document.getElementById('battleMonsterSprite'),challenge.monsterCfg?.image||'','👾');
  scene.querySelector('.battle-monster-name').textContent=challenge.monsterCfg?.name||('怪物 '+(challenge.monsterNo||1));
  scene.querySelector('.hpbar>div').style.width=Math.max(0,hp/max*100)+'%';
  scene.querySelector('.battle-monster-side small').textContent=`HP ${Math.ceil(hp)} / ${max}`;
}
function playPetAttackAnimation(damage){
  return new Promise(resolve=>{
    const epoch=BATTLE_VIEW_EPOCH_V600;
    const pet=document.getElementById('battlePetSprite'),mon=document.getElementById('battleMonsterSprite'),root=document.getElementById('battleScene');
    if(mainMode!=='battle'||!pet||!mon||!root){resolve(false);return;}
    const finish=result=>{BATTLE_ANIMATIONS_V600.delete(finish);resolve(result);};
    BATTLE_ANIMATIONS_V600.add(finish);
    pet.classList.remove('attack-lunge');void getComputedStyle(pet).animationName;pet.classList.add('attack-lunge');
    battleTimeoutV600_(()=>{
      if(epoch!==BATTLE_VIEW_EPOCH_V600)return;
      mon.classList.remove('hit-shake');void mon.offsetWidth;mon.classList.add('hit-shake');
      const d=document.createElement('div');d.className='battle-damage-float';d.textContent='-'+damage;root.appendChild(d);
      battleTimeoutV600_(()=>d.remove(),850);
    },260);
    battleTimeoutV600_(()=>{pet.classList.remove('attack-lunge');mon.classList.remove('hit-shake');finish(true);},620);
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
function createPet(p,i){
  const y=document.getElementById('yard'),wrap=document.createElement('div');
  wrap.className='pet-pos';wrap.dataset.pet=p.petId;
  let px=Math.max(2,Math.min(88,Number(p.x)||45));
  let py=Number(p.y)||70;
  if(p.movementType==='地面型')py=Math.max(55,Math.min(82,py));else py=Math.max(8,Math.min(82,py));
  wrap.style.left=px+'%';wrap.style.top=py+'%';

  const alive=document.createElement('div');alive.className='pet-alive';
  alive.style.animationDuration=(1.9+(i%5)*.17)+'s';
  const petImg=getPetImage(p.petId,p.stage)||p.image||'';
  if(petImg){
    const img=document.createElement('img');img.src=petImg;img.loading='eager';img.decoding='async';
    img.draggable=false;
    img.onerror=()=>alive.innerHTML=`<div class="fallback">🐾<br>${esc(p.petId)}</div>`;
    alive.appendChild(img);
  }else alive.innerHTML=`<div class="fallback">🐾<br>${esc(p.petId)}</div>`;
  wrap.appendChild(alive);

  let dragging=false,moved=false;
  const moveToPointer=(ev)=>{
    const rect=y.getBoundingClientRect();
    let x=(ev.clientX-rect.left)/rect.width*100;
    let yy=(ev.clientY-rect.top)/rect.height*100;
    x=Math.max(2,Math.min(92,x));yy=Math.max(4,Math.min(88,yy));
    wrap.style.left=x+'%';wrap.style.top=yy+'%';
    return {x,y:yy};
  };
  wrap.addEventListener('pointerdown',ev=>{
    if(ev.button!==undefined && ev.button!==0)return;
    dragging=true;moved=false;DRAGGING_PET_ID=p.petId;
    wrap.classList.add('dragging');
    try{wrap.setPointerCapture(ev.pointerId);}catch(e){}
    ev.preventDefault();
  });
  wrap.addEventListener('pointermove',ev=>{
    if(!dragging)return;
    moved=true;moveToPointer(ev);ev.preventDefault();
  });
  wrap.addEventListener('pointerup',ev=>{
    if(!dragging)return;
    dragging=false;DRAGGING_PET_ID='';
    wrap.classList.remove('dragging');
    const pt=moveToPointer(ev);
    let finalY=pt.y;
    if(p.movementType==='地面型' && finalY<55){
      finalY=58;
      wrap.classList.add('drag-fall');
      requestAnimationFrame(()=>{wrap.style.top=finalY+'%';});
      setTimeout(()=>wrap.classList.remove('drag-fall'),520);
    }else if(p.movementType==='地面型'){
      finalY=Math.max(55,Math.min(82,finalY));wrap.style.top=finalY+'%';
    }
    p.x=pt.x;p.y=finalY;
    gsRaw('savePetPositionsBatch',currentId,[{petId:p.petId,landId:p.landId,x:p.x,y:p.y}]).catch(()=>{});
    if(!moved)petTalk(p,wrap);
    ev.preventDefault();
  });
  wrap.addEventListener('pointercancel',()=>{dragging=false;DRAGGING_PET_ID='';wrap.classList.remove('dragging');});
  y.appendChild(wrap);
}
function wanderPets(){
  if(!state)return;
  state.pets.filter(p=>String(p.landId)===String(state.activeLandId)).forEach(p=>{
    if(String(DRAGGING_PET_ID)===String(p.petId))return;
    const el=document.querySelector(`.pet-pos[data-pet="${CSS.escape(p.petId)}"]`);if(!el)return;
    const x=4+Math.random()*82;
    const yy=p.movementType==='地面型'?(58+Math.random()*22):(10+Math.random()*70);
    el.style.left=x+'%';
    el.style.top=yy+'%';

    // 只改畫面，不改 p.x / p.y，也不存 Google Sheet。
    // 真正拖曳寵物放手時 createPet() 才會儲存位置。
  });
}

function petTalk(p,el){document.querySelectorAll('.bubble').forEach(x=>x.remove());const b=document.createElement('div');b.className='bubble';b.textContent=p.dialogs[Math.floor(Math.random()*p.dialogs.length)];b.style.left=(el.offsetLeft+el.offsetWidth/2)+'px';b.style.top=el.offsetTop+'px';yard.appendChild(b);setTimeout(()=>b.remove(),2400);}
function switchTab(tab,btn){currentTab=tab;if(tab==='challenge')challenge.active=false;if(tab==='upgrade'||tab==='furniture')switchMainMode(tab);else if(tab!=='challenge')switchMainMode('home');document.querySelectorAll('.tabbtn').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');renderCurrentTab();}
async function renderCurrentTab(){if(currentTab==='home')renderHome();if(currentTab==='upgrade')await renderUpgrade();if(currentTab==='furniture')await renderFurnitureV610();if(currentTab==='bag')await renderBag();if(currentTab==='challenge'){if(challenge.active){switchMainMode('battle');renderBattle();}else renderChallengeHome();}if(currentTab==='mail')await renderMail();if(currentTab==='shop')await renderShop();}
function renderHome(){
  const petsHere=state.pets.filter(p=>String(p.landId)===String(state.activeLandId));
  const ownedBgs=(state.backgrounds||[]).map(id=>liveLandById(id)).filter(Boolean);
  const activePlot=state.lands.find(l=>String(l['土地ID'])===String(state.activeLandId))||state.lands[0];
  panel.innerHTML=`<h3>🏠 小屋管理</h3>
    <div class="home-section"><h4>土地切換</h4><div class="row">${state.lands.map((l,i)=>`<button class="btn ${String(l['土地ID'])===String(state.activeLandId)?'gray':'secondary'}" onclick="changeLand('${l['土地ID']}')">土地 ${l.plotIndex||i+1}</button>`).join('')}</div><p class="small">目前背景：${esc(activePlot?.config?.['名稱']||'')}</p></div>
    <div class="home-section"><h4>🖼️ 這塊土地的背景</h4><select id="homeBg" class="full">${ownedBgs.map(bg=>`<option value="${bg.landId}" ${String(bg.landId)===String(activePlot?.backgroundId)?'selected':''}>${esc(bg.name)}</option>`).join('')}</select><button class="btn blue" style="margin-top:7px" onclick="applyHomeBackground()">套用背景</button></div>
    <div class="home-section"><h4>🐾 分配寵物到土地</h4>${state.pets.map(p=>`<div class="petcard"><b>${esc(p.nickname||p.name)}</b><div class="row" style="margin-top:6px"><select id="plot-${p.petId}">${state.lands.map((l,i)=>`<option value="${l['土地ID']}" ${String(p.landId)===String(l['土地ID'])?'selected':''}>土地 ${l.plotIndex||i+1}</option>`).join('')}</select><button class="btn" onclick="movePetUI('${p.petId}')">分配</button></div></div>`).join('')}</div>
    <h4>目前土地上的寵物</h4>${petsHere.map(p=>petCardHtml(p)).join('')||'<div class="petcard">目前這塊土地沒有寵物。</div>'}
`;
}
function petCardHtml(p){const maxed=Number(p.expNeed)===0;const pct=maxed?100:Math.min(100,p.exp/p.expNeed*100);return `<div class="petcard"><b>${esc(p.nickname||p.name)}</b> <span class="small">${esc(p.movementType)}</span><br>Lv.${p.level}・第${p.stage}階<div class="xp"><div style="width:${pct}%"></div></div><small>${maxed?'EXP MAX':`EXP ${p.exp}/${p.expNeed}`}</small></div>`;}
async function changeLand(id){try{const r=await gs('setActiveLandFast',currentId,id);state.activeLandId=r.activeLandId;state.furniture=Array.isArray(r.furniture)?r.furniture:[];renderYard();renderHome();}catch(e){alert(e.message||e);}}
async function movePetUI(petId){const sel=document.getElementById('plot-'+petId);if(!sel)return;try{await gs('movePetToLand',currentId,petId,sel.value);const p=state.pets.find(x=>x.petId===petId);if(p)p.landId=sel.value;renderYard();renderHome();}catch(e){alert(e.message||e);}}
async function applyHomeBackground(){const bg=document.getElementById('homeBg')?.value;if(!bg)return;await useBackgroundFromShop(bg);}
async function renderUpgrade(){
  const id=currentId,root=document.getElementById('upgradeMain');
  if(!root || !state)return;
  if(!cacheFresh(UPGRADE_AT_V600,300000)){
    root.innerHTML='<div class="upgrade-empty">載入升級資料中…</div>';
    try{
      if(!UPGRADE_LOADING_V600)UPGRADE_LOADING_V600=gs('getUpgradeBundleV600',id,STUDENT_TOKEN_V600).finally(()=>UPGRADE_LOADING_V600=null);
      const r=await UPGRADE_LOADING_V600;
      if(currentId!==id)return;
      applyUpgradeBundleV600(r);
    }catch(e){if(currentId===id)root.innerHTML=`<div class="upgrade-empty">${esc(e.message||e)}<br><button class="btn" onclick="renderUpgrade()">重新載入</button></div>`;return;}
  }
  if(currentId!==id || currentTab!=='upgrade')return;
  if(!state.pets.length){root.innerHTML='<div class="upgrade-empty">目前沒有可以升級的寵物。</div>';return;}
  if(!state.pets.some(p=>p.petId===UPGRADE_PET_V600))UPGRADE_PET_V600=state.pets[0].petId;
  const expItems=inventory.filter(x=>x.config?.['類型']==='經驗型');
  panel.innerHTML='<h3>⬆️ 升級系統</h3><p>在左側大型主畫面選擇寵物與升級模式。</p><p class="small">經驗糖果提升等級；同屬性之石永久強化一個已解鎖技能。</p><button class="btn gray" onclick="UPGRADE_AT_V600=0;renderUpgrade()">更新升級資料</button>';
  root.innerHTML=`<div class="upgrade-heading"><div><span class="small">V6.0 · 升級工坊</span><h2>讓夥伴變得更強</h2></div><div class="upgrade-modes"><button class="btn upgrade-mode-btn ${UPGRADE_MODE_V600==='exp'?'blue':'gray'}" onclick="setUpgradeModeV600('exp')">🍬 經驗糖果</button><button class="btn upgrade-mode-btn ${UPGRADE_MODE_V600==='stone'?'purple':'gray'}" onclick="setUpgradeModeV600('stone')">💎 屬性之石</button></div></div>
    <div class="upgrade-layout"><div class="upgrade-pet">
    <label>選擇寵物</label>
    <select id="upPet" class="full" ${EXP_USE_BUSY||STONE_BUSY_V600?'disabled':''}>${state.pets.map(p=>`<option value="${esc(p.petId)}" ${p.petId===UPGRADE_PET_V600?'selected':''}>${esc(p.name)} Lv.${p.level}</option>`).join('')}</select>
    <div id="upPetInfo" style="margin-top:8px"></div>
    </div><div class="upgrade-content"><div id="upgradeNotice">${esc(UPGRADE_NOTICE_V600)}</div>${UPGRADE_MODE_V600==='exp'?`<h3>🍬 經驗糖果</h3>
    ${expItems.length?`
      <div class="batch-exp-toolbar">
        <div class="row">
          <button class="btn secondary" onclick="toggleAllExpItems(true)">全選</button>
          <button class="btn gray" onclick="toggleAllExpItems(false)">取消全選</button>
          <button class="btn purple exp-action" onclick="useExpBatch(this)">批量使用勾選道具</button>
        </div>
        <div class="small">每個道具可輸入不同數量，也可以按「全部」快速填滿。</div>
      </div>
      ${expItems.map(x=>`<div class="itemcard">
        <input class="exp-batch-check" type="checkbox" data-item="${esc(x.itemId)}" style="float:right">
        ${x.config?.['圖片']?`<img src="${esc(x.config['圖片'])}" style="width:72px;height:72px;object-fit:contain;float:left;margin-right:10px">`:''}
        <b>${esc(x.config['名稱'])}</b> ×${x.quantity}<br>
        <span class="small">+${x.config['效果值']} EXP/個</span>
        <div class="row" style="margin-top:6px">
          <input id="qty-${x.itemId}" type="number" min="1" max="${x.quantity}" value="1" style="width:80px">
          <button class="btn secondary exp-action" onclick="document.getElementById('qty-${x.itemId}').value='${x.quantity}'">全部</button>
          <button class="btn exp-action" onclick="useExp('${x.itemId}',this)">使用</button>
        </div>
        <div style="clear:both"></div>
      </div>`).join('')}
    `:'<div class="itemcard">目前沒有經驗型道具。</div>'}`:'<div id="stoneModeContent"></div>'}</div></div>`;
  upPet.onchange=()=>{UPGRADE_PET_V600=upPet.value;renderUpPetInfo();if(UPGRADE_MODE_V600==='stone')renderStoneModeV600();};
  renderUpPetInfo();
  if(UPGRADE_MODE_V600==='stone')renderStoneModeV600();
  if(EXP_USE_BUSY)setExpBusyV5104(true);
}

function applyUpgradeBundleV600(r){
  if(Array.isArray(r.inventory)){inventory=r.inventory;CLIENT_CACHE.inventory=inventory;CLIENT_CACHE.inventoryAt=Date.now();saveLocal('inventory',inventory);}
  if(Array.isArray(r.pets))state.pets=r.pets;
  if(r.skillEnhancements)state.skillEnhancements=r.skillEnhancements;
  if(Array.isArray(r.petBattleConfigs))PET_BATTLE_CONFIGS=Object.fromEntries(r.petBattleConfigs.map(x=>[String(x.petId),x]));
  if(Array.isArray(r.stones))STONE_CATALOG_V600=r.stones;
  if(r.pendingOperation){try{localStorage.setItem(stonePendingKeyV600(),JSON.stringify(r.pendingOperation));}catch(e){UPGRADE_NOTICE_V600='請求尚未完成，瀏覽器無法保存重試資料。';}}
  UPGRADE_READY_V600=!!r.ready;UPGRADE_AT_V600=Date.now();
}
function setUpgradeModeV600(mode){if(EXP_USE_BUSY||STONE_BUSY_V600)return;UPGRADE_MODE_V600=mode==='stone'?'stone':'exp';UPGRADE_NOTICE_V600='';renderUpgrade();}
function stonePendingKeyV600(){return 'petHouseStonePendingV600:'+currentId;}
function readStonePendingV600(){try{return JSON.parse(localStorage.getItem(stonePendingKeyV600())||'null');}catch(e){return null;}}
function renderStoneModeV600(){
  const root=document.getElementById('stoneModeContent'),pet=state.pets.find(p=>p.petId===upPet.value);if(!root||!pet)return;
  const attribute=getPetAttribute(pet),skills=getConfiguredPetSkills(pet),pending=readStonePendingV600();
  const stone=STONE_CATALOG_V600.find(x=>x.attribute===attribute),quantity=stone?inventoryQty(stone.itemId):0;
  root.innerHTML=`<h3>${itemImageHtmlV610(stone?.itemId,{},48)} ${esc(attribute)}之石</h3><p>每顆永久增加 <b>${esc(stone?.increment||'5')}</b> 傷害，每次只強化一個技能。</p><p class="stone-balance">持有 ${quantity} 顆 · 強化可以持續累積</p>
  ${!UPGRADE_READY_V600?'<div class="itemcard">請老師先執行 setupOrUpgradeV600()。</div>':''}
  <div id="stoneRetryV610" class="itemcard" ${pending?'':'hidden'}><b>有一筆強化尚未確認完成</b><p>請重試原請求，確認前不會建立新強化。</p><button class="btn purple stone-retry" onclick="useStoneV600()">重試上次強化</button></div>
  <div class="upgrade-skills">${skills.map(s=>`<div class="upgrade-skill"><b>${esc(s.name)}</b><span class="skill-kind">${s.kind==='general'?'一般技能':s.kind==='special'?'30 級專屬技能':'屬性技能'}</span><p>基礎 ${s.baseDamage} + 強化 <span data-stone-bonus="${esc(s.id)}">${esc(s.bonusDamage)}</span> = <strong data-stone-final="${esc(s.id)}">${esc(s.finalDamage)}</strong></p><div class="row">${[1,5,10,'ALL'].map(q=>`<button class="btn purple stone-action" data-stone-quantity="${q}" ${!UPGRADE_READY_V600||!stone||quantity<(q==='ALL'?1:q)||pending||STONE_BUSY_V600?'disabled':''} onclick="useStoneV600('${esc(s.id)}','${q}')">${q==='ALL'?'全部使用':'使用 '+q+' 顆'}</button>`).join('')}</div></div>`).join('')}</div>
  <details class="stone-catalog"><summary>查看 12 種屬性石</summary><div class="stone-catalog-grid">${STONE_CATALOG_V600.map(s=>`<div>${itemImageHtmlV610(s.itemId,{},32)} ${esc(s.name)} ×<span data-stone-stock="${esc(s.itemId)}">${inventoryQty(s.itemId)}</span></div>`).join('')}</div></details>`;
  activateStoneSpritesV610();
}
function updateStoneViewV610(changedPet,changedSkill,changedItem){
  if(currentTab!=='upgrade'||UPGRADE_MODE_V600!=='stone')return;
  const pet=state.pets.find(p=>p.petId===upPet.value),stone=STONE_CATALOG_V600.find(s=>s.attribute===getPetAttribute(pet));
  const have=stone?inventoryQty(stone.itemId):0,pending=readStonePendingV600();
  const balance=document.querySelector('.stone-balance');if(balance)balance.textContent=`持有 ${have} 顆 · 強化可以持續累積`;
  document.querySelectorAll('[data-stone-stock]').forEach(el=>{if(el.dataset.stoneStock===changedItem)el.textContent=inventoryQty(changedItem);});
  getConfiguredPetSkills(pet).filter(s=>pet.petId===changedPet&&s.id===changedSkill).forEach(s=>{
    document.querySelectorAll('[data-stone-bonus]').forEach(el=>{if(el.dataset.stoneBonus===s.id)el.textContent=s.bonusDamage;});
    document.querySelectorAll('[data-stone-final]').forEach(el=>{if(el.dataset.stoneFinal===s.id)el.textContent=s.finalDamage;});
  });
  document.querySelectorAll('.stone-action').forEach(el=>el.disabled=STONE_BUSY_V600||!!pending||!UPGRADE_READY_V600||!stone||have<(el.dataset.stoneQuantity==='ALL'?1:Number(el.dataset.stoneQuantity)));
  document.querySelectorAll('.stone-retry,.upgrade-mode-btn,#upPet').forEach(el=>el.disabled=STONE_BUSY_V600||EXP_USE_BUSY);
  const retry=document.getElementById('stoneRetryV610');if(retry)retry.hidden=!pending;
  const notice=document.getElementById('upgradeNotice');if(notice)notice.textContent=UPGRADE_NOTICE_V600;
}
function applyStoneResultV610(r){
  const item=inventory.find(x=>x.itemId===r.itemId);if(item)item.quantity=r.remainingStone;
  state.skillEnhancements=state.skillEnhancements||{};
  state.skillEnhancements[r.petId]=state.skillEnhancements[r.petId]||{};
  state.skillEnhancements[r.petId][r.skillId]=String(r.totalBonus);
  CLIENT_CACHE.inventory=inventory;CLIENT_CACHE.inventoryAt=Date.now();saveLocal('inventory',inventory);
  UPGRADE_AT_V600=Date.now();
}
function clearStonePendingV610(key,requestId){
  const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(saved?.requestId===requestId)localStorage.removeItem(key);
}
async function useStoneV600(skillId,quantity=1){
  if(STONE_BUSY_V600||EXP_USE_BUSY)return;
  const id=currentId,pet=state.pets.find(p=>p.petId===upPet.value);
  let pending=readStonePendingV600();
  if(!pending){
    const stone=STONE_CATALOG_V600.find(s=>s.attribute===getPetAttribute(pet));
    const skill=getConfiguredPetSkills(pet).find(s=>s.id===skillId),mode=quantity==='ALL'?'ALL':Number(quantity),used=mode==='ALL'?inventoryQty(stone?.itemId):mode;
    if(!stone||!skill||!Number.isSafeInteger(used)||used<1||inventoryQty(stone.itemId)<used)return;
    const added=BigInt(used)*5n;
    if(!confirm(`${stone.name} ×${used}\n\n${skill.name}\n強化 +${skill.bonusDamage} → +${BigInt(skill.bonusDamage)+added}\n最終傷害 ${skill.finalDamage} → ${BigInt(skill.finalDamage)+added}\n\n確定強化？`))return;
    pending={petId:pet.petId,skillId,itemId:stone.itemId,quantity:mode,batch:true,requestId:crypto.randomUUID()};
    try{localStorage.setItem(stonePendingKeyV600(),JSON.stringify(pending));}catch(e){alert('無法保存強化請求，請檢查瀏覽器儲存空間後再試。');return;}
  }
  STONE_BUSY_V600=true;
  const pendingKey=stonePendingKeyV600();
  document.querySelectorAll('.stone-action,.stone-retry,.upgrade-mode-btn,#upPet').forEach(el=>el.disabled=true);
  try{
    const r=pending.batch?await gs('useAttributeStonesBatchV610',id,pending.petId,pending.skillId,pending.itemId,pending.quantity,pending.requestId,STUDENT_TOKEN_V600):await gs('useAttributeStoneV600',id,pending.petId,pending.skillId,pending.itemId,pending.requestId,STUDENT_TOKEN_V600);
    if(currentId!==id)return;
    if(r.ok===false){if(!r.retryable)clearStonePendingV610(pendingKey,pending.requestId);throw new Error(r.message||'強化失敗');}
    if(pending.batch)applyStoneResultV610(r);else applyUpgradeBundleV600(r);
    clearStonePendingV610(pendingKey,pending.requestId);
    UPGRADE_NOTICE_V600=`✅ 技能已永久強化 +${r.addedDamage||'5'} 傷害${r.replayed?'（原交易已確認）':''}`;
  }catch(e){if(currentId===id){UPGRADE_NOTICE_V600=String(e.message||e);alert(e.message||e);}}
  finally{STONE_BUSY_V600=false;if(currentId===id)updateStoneViewV610(pending.petId,pending.skillId,pending.itemId);}
}

function setExpBusyV5104(on,label='處理中...'){
  EXP_USE_BUSY=!!on;
  document.querySelectorAll('.exp-action,.exp-batch-check,[id^="qty-"],.upgrade-mode-btn,#upPet').forEach(el=>{
    el.disabled=!!on;
  });
  let note=document.getElementById('expBusyNote');
  if(on){
    if(!note){
      note=document.createElement('div');
      note.id='expBusyNote';
      note.className='itemcard';
      note.style.margin='8px 0';
      const toolbar=document.querySelector('.batch-exp-toolbar');
      (toolbar||panel)?.prepend(note);
    }
    note.innerHTML=`⏳ ${esc(label)}<div class="small">請勿連續點擊，完成後按鈕會自動恢復。</div>`;
  }else if(note){
    note.remove();
  }
}
function toggleAllExpItems(on){document.querySelectorAll('.exp-batch-check').forEach(x=>x.checked=!!on);}
async function useExpBatch(btn){
  if(EXP_USE_BUSY)return;
  const petId=upPet.value;
  const uses=[...document.querySelectorAll('.exp-batch-check:checked')].map(x=>{
    const itemId=x.dataset.item;
    return {itemId,quantity:Math.max(1,Number(document.getElementById('qty-'+itemId)?.value||1))};
  });
  if(!uses.length){alert('請先勾選要使用的經驗道具');return;}
  setExpBusyV5104(true,'經驗糖果使用中...');
  try{
    const r=await gsRaw('useExpItemsBatchV599',currentId,petId,uses);
    inventory=Array.isArray(r.inventory)?r.inventory:inventory;
    const p=state.pets.find(x=>x.petId===petId);
    if(p){p.level=Number(r.level||p.level);p.exp=Number(r.exp??p.exp);p.stage=Number(r.stage||p.stage);p.expNeed=Number(r.expNeed??p.expNeed);p.image=getPetImage(p.petId,p.stage)||r.image||p.image;}
    await renderUpgrade();renderYard();
    const note=document.createElement('div');note.className='success';note.textContent=`✅ 批量使用完成，共 +${r.gained} EXP`;(document.getElementById('upgradeNotice')||panel).prepend(note);setTimeout(()=>note.remove(),1800);
  }catch(e){
    alert(e.message||e);
  }finally{
    setExpBusyV5104(false);
  }
}
function renderUpPetInfo(){const p=state.pets.find(x=>x.petId===upPet.value);if(p){const src=getPetImage(p.petId,p.stage)||p.image||'';upPetInfo.innerHTML=`<div class="upgrade-pet-portrait">${src?`<img src="${esc(src)}" alt="${esc(p.name)}">`:'🐾'}</div>${petCardHtml(p)}<p>${attributeIconHtml(getPetAttribute(p),24)} ${esc(getPetAttribute(p))}屬性</p>`;}}
async function useExp(itemId,btn){
  if(EXP_USE_BUSY)return;
  const petId=upPet.value;
  const qty=Math.max(1,Number(document.getElementById('qty-'+itemId)?.value||1));
  setExpBusyV5104(true,'經驗糖果使用中...');
  try{
    const r=await gsRaw('useExpItem',currentId,itemId,petId,qty);
    inventory=Array.isArray(r.inventory)?r.inventory:inventory;
    const p=state.pets.find(x=>x.petId===petId);
    if(p){p.level=Number(r.level||p.level);p.exp=Number(r.exp??p.exp);p.stage=Number(r.stage||p.stage);p.expNeed=Number(r.expNeed??p.expNeed);p.image=getPetImage(p.petId,p.stage)||r.image||p.image;}
    await renderUpgrade();renderYard();
    const note=document.createElement('div');note.className='success';note.textContent=`✅ +${r.gained} EXP`;(document.getElementById('upgradeNotice')||panel).prepend(note);setTimeout(()=>note.remove(),1400);
  }catch(e){
    alert(e.message||e);
  }finally{
    setExpBusyV5104(false);
  }
}
async function renderBag(){if(!Array.isArray(inventory)||!inventory.length)inventory=await gs('getInventory',currentId);panel.innerHTML=`<h3>🎒 我的道具</h3>${inventory.map(x=>`<div class="itemcard" style="min-height:86px">${itemImageHtmlV610(x.itemId,x.config,76)} <b>${esc(x.config?.['名稱']||x.itemId)}</b> ×${x.quantity}<br><span class="small">${esc(x.config?.['類型']||'')}｜${esc(x.config?.['說明']||'')}</span><div style="clear:both"></div></div>`).join('')||'<div class="itemcard">背包目前是空的。</div>'}`;activateStoneSpritesV610();}
async function ensureChallengeHomeMeta(){
  // V5.10.4：挑戰首頁不再掃描題庫。
  // 狀態已在登入後背景資料載入；題庫只在點進單一科目時載入。
  CHALLENGE_HOME_META={status:state?.challengeStatus||{}};
  return CHALLENGE_HOME_META;
}

function renderChallengeHome(){
  currentTab='challenge';challenge.active=false;
  cleanupBattleViewV600_();
  if(mainMode!=='battle'){switchMainMode('battle');return;}
  renderBattleMain();
  const subjects=['國語','數學','英文','自然','社會'];
  const status=state?.challengeStatus||{};
  battleControlsV600_().innerHTML=`<h3>⚔️ 寵物對戰挑戰</h3>
    <p class="small">直接選科目即可。題庫只會在進入該科目時載入，不再先檢查五科題庫。</p>
    ${subjects.map(s=>{
      const st=status[s]||{correct:0,wrong:0,locked:false};
      const cached=QUESTION_BANK_LOADED[s] ? (QUESTION_BANK_CACHE[s]||[]).length : null;
      const disabled=!!st.locked;
      const label=disabled?'今日已結束':'進入對戰';
      return `<div class="subjectcard ${disabled?'subject-disabled':''}">
        <b>${s}</b>　答對 ${Number(st.correct||0)}
        <span class="lives">${'❤️'.repeat(Math.max(0,3-Number(st.wrong||0)))}${'🖤'.repeat(Math.min(3,Number(st.wrong||0)))}</span>
        ${cached===null?'':`<span class="small">｜本機題庫 ${cached} 題</span>`}
        <br>
        <button class="btn ${disabled?'gray':'blue'}" ${disabled?'disabled':''}
          onclick="chooseChallenge('${s}')">${label}</button>
      </div>`;
    }).join('')}`;
}
async function chooseChallenge(subject){
  const account=currentId;
  cleanupBattleViewV600_();const epoch=BATTLE_VIEW_EPOCH_V600;
  try{await flushChallengeAnswers(true);}catch(e){alert(e.message||e);return;}
  if(account!==currentId||epoch!==BATTLE_VIEW_EPOCH_V600)return;
  challenge.active=false;challenge.subject=subject;challenge.petId='';
  challenge.savedProgress=null;
  switchMainMode('battle');
  renderBattleMain();
  const viewEpoch=BATTLE_VIEW_EPOCH_V600;
  const isCurrent=()=>account===currentId&&viewEpoch===BATTLE_VIEW_EPOCH_V600&&mainMode==='battle'&&challenge.subject===subject;
  // Independent reads overlap; neither can change the selected view after navigation.
  const configLoading=ensureBattleConfigsV5106();
  const savedLoading=gsRaw('getBattleProgressV5105',account,subject).catch(()=>null);

  if(!QUESTION_BANK_LOADED[subject]){
    battleControlsV600_().innerHTML=`<h3>⚔️ ${esc(subject)}對戰</h3><div class="petcard">載入${esc(subject)}題庫中…</div>`;
    showWaiting('載入題庫中...');
    try{await ensureQuestionBank(subject);}finally{hideWaiting();}
  }
  if(!isCurrent())return;
  if(!(QUESTION_BANK_CACHE[subject]||[]).length){
    battleControlsV600_().innerHTML=`<h3>⚔️ ${esc(subject)}對戰</h3>
      <div class="petcard">這個科目目前沒有啟用中的題目。</div>
      <button class="btn gray" onclick="renderChallengeHome()">返回</button>`;
    return;
  }

  await configLoading;

  if(!isCurrent())return;
  let saved=null;
  saved=await savedLoading;
  if(!isCurrent())return;
  challenge.savedProgress=saved&&saved.exists?saved:null;

  const savedPet=challenge.savedProgress
    ? state.pets.find(p=>String(p.petId)===String(challenge.savedProgress.petId))
    : null;

  battleControlsV600_().innerHTML=`<h3>⚔️ ${esc(subject)}對戰</h3>
    ${challenge.savedProgress?`<div class="petcard">
      <b>💾 發現對戰存檔</b><br>
      ${savedPet?`${esc(savedPet.name)} Lv.${savedPet.level}`:`${esc(challenge.savedProgress.petId)}`}<br>
      <span class="small">目前：怪物 ${challenge.savedProgress.monsterNo}｜HP ${Math.ceil(challenge.savedProgress.monsterHp)} / ${challenge.savedProgress.monsterMaxHp}</span>
      <div class="nav">
        <button class="btn blue" onclick="resumeSavedChallengeV5105()">▶️ 繼續對戰</button>
        <button class="btn red" onclick="startNewChallengeV5105()">🔄 重新開始</button>
      </div>
    </div>`:''}
    <div class="petcard">
      <label>${challenge.savedProgress?'或選擇新的寵物重新開始':'選擇出戰寵物'}</label>
      <select id="chPet" class="full">${state.pets.map(p=>`<option value="${p.petId}">${esc(p.name)} Lv.${p.level}・第${p.stage}階</option>`).join('')}</select>
      <div class="nav"><button class="btn ${challenge.savedProgress?'secondary':'blue'}" onclick="${challenge.savedProgress?'startNewChallengeV5105()':'startChallengeUI()'}">${challenge.savedProgress?'以選擇的寵物重新開始':'開始戰鬥'}</button><button class="btn gray" onclick="renderChallengeHome()">返回</button></div>
    </div>`;
}

async function startNewChallengeV5105(){
  if(mainMode!=='battle'||challenge.answering||challenge.saving)return;
  const epoch=BATTLE_VIEW_EPOCH_V600,account=currentId;
  if(challenge.savedProgress){
    if(!confirm('重新開始會刪除這一科目前的怪物進度，答題紀錄不會被刪除。確定重新開始嗎？'))return;
    try{await gsRaw('clearBattleProgressV5105',currentId,challenge.subject);}catch(e){alert(e.message||e);return;}
    if(epoch!==BATTLE_VIEW_EPOCH_V600||account!==currentId)return;
    challenge.savedProgress=null;
  }
  startChallengeUI();
}

async function resumeSavedChallengeV5105(){
  if(mainMode!=='battle'||challenge.answering||challenge.saving)return;
  const epoch=BATTLE_VIEW_EPOCH_V600,account=currentId;
  const save=challenge.savedProgress;
  if(!save)return startChallengeUI();
  try{
    challenge.subject=String(save.subject||challenge.subject);
    const localStatus=state?.challengeStatus?.[challenge.subject]||{correct:0,wrong:0,exp:0,locked:false};
    if(localStatus.locked || Number(localStatus.wrong||0)>=3){
      showLocked({locked:true,status:localStatus,resetAt:'明早 7:00'});
      return;
    }
    const pet=state.pets.find(p=>String(p.petId)===String(save.petId));
    if(!pet)throw new Error('存檔使用的寵物目前不在你的寵物清單中');

    let pool=localQuestionBatch(challenge.subject,Array.isArray(save.seen)?save.seen:[],30);
    if(!pool.length){
      await ensureQuestionBank(challenge.subject);
      pool=localQuestionBatch(challenge.subject,Array.isArray(save.seen)?save.seen:[],30);
    }
    if(!pool.length)pool=localQuestionBatch(challenge.subject,[],30);
    if(!pool.length)throw new Error('這個科目目前沒有可用題目');

    if(epoch!==BATTLE_VIEW_EPOCH_V600||account!==currentId||mainMode!=='battle')return;
    challenge.petId=String(save.petId);
    challenge.questions=pool;
    challenge.qIndex=0;
    challenge.status={...localStatus};
    challenge.pending=[];
    challenge.seen=Array.isArray(save.seen)?save.seen.slice(-80):[];
    challenge.monsterNo=Math.max(1,Number(save.monsterNo||1));
    challenge.monsterCfg=getMonsterForBattle(challenge.subject,challenge.monsterNo);
    challenge.monsterMaxHp=Math.max(1,Number(save.monsterMaxHp)||getMonsterHp(challenge.monsterCfg,challenge.monsterNo));
    const savedHp=Math.max(1,Number(save.monsterHp||challenge.monsterMaxHp));
    challenge.monsterHp=Math.min(challenge.monsterMaxHp,savedHp);
    challenge.selectedSkill=null;
    challenge.question=null;
    challenge.lastMsg=`<span class="success">💾 已讀取存檔，從怪物 ${challenge.monsterNo} 繼續。</span>`;
    BATTLE_SKILLS_SESSION_V610=null;challenge.active=true;switchMainMode('battle');renderBattle();
  }catch(e){alert(e.message||e);}
}

function getPetSkills(pet){const cfg=PET_CONFIGS[String(pet.petId)]||{};const arr=Array.isArray(cfg.skills)?cfg.skills:[];return arr.filter(s=>Number(s.minStage||1)<=Number(pet.stage||1));}
async function startChallengeUI(){
  if(mainMode!=='battle'||challenge.answering||challenge.saving)return;
  const epoch=BATTLE_VIEW_EPOCH_V600,account=currentId;
  challenge.petId=document.getElementById('chPet')?.value||challenge.petId;
  try{
    const localStatus=state?.challengeStatus?.[challenge.subject]||{correct:0,wrong:0,exp:0,locked:false};
    if(localStatus.locked || Number(localStatus.wrong||0)>=3){
      showLocked({locked:true,status:localStatus,resetAt:'明早 7:00'});
      return;
    }

    // 題庫已在登入後背景預載；正常情況不再等 Apps Script。
    let pool=localQuestionBatch(challenge.subject,[],30);
    if(!pool.length){
      battleControlsV600_().innerHTML='<div class="petcard">題庫第一次載入中…</div>';
      showWaiting('載入題庫中...');
      try{await ensureQuestionBank(challenge.subject);}finally{hideWaiting();}
      pool=localQuestionBatch(challenge.subject,[],30);
    }
    if(!pool.length)throw new Error('這個科目目前沒有可用題目；若剛登入，請等 1 秒後再按一次開始戰鬥。');

    if(epoch!==BATTLE_VIEW_EPOCH_V600||account!==currentId||mainMode!=='battle')return;
    challenge.questions=pool;
    challenge.qIndex=0;
    challenge.status={...localStatus};
    challenge.pending=[];
    challenge.seen=[];
    challenge.monsterNo=1;

    // 怪物資料登入後就已預載；沒有資料時也先進戰鬥，用既有 fallback。
    challenge.monsterCfg=getMonsterForBattle(challenge.subject,challenge.monsterNo);
    challenge.monsterMaxHp=getMonsterHp(challenge.monsterCfg,challenge.monsterNo);
    challenge.monsterHp=challenge.monsterMaxHp;
    challenge.selectedSkill=null;challenge.question=null;challenge.lastMsg='';
    BATTLE_SKILLS_SESSION_V610=null;challenge.active=true;switchMainMode('battle');renderBattle();
  }catch(e){alert(e.message||e);}
}
function battleSkillPowerV600_(skill){return '威力 '+esc(skill.finalDamage||skill.damage)+(BigInt(skill.bonusDamage||'0')>0?'（強化 +'+esc(skill.bonusDamage)+'）':'');}
function renderBattle(){
  if(mainMode!=='battle'||!challenge.active||challenge.answering)return;
  const pet=state.pets.find(p=>String(p.petId)===String(challenge.petId));if(!pet)return;
  renderBattleMain();
  const skillScroll=battleControlsV600_().querySelector('.skill-grid')?.scrollTop||0;
  const skills=battleSkillsV610_(pet),locked=challenge.status?.locked||Number(challenge.status?.wrong||0)>=3;
  const controls=battleControlsV600_(),key=[challenge.subject,pet.petId,pet.level,!!locked].join(':');
  if(controls.dataset.battleKey===key){
    controls.querySelector('.battle-controls-heading>span').textContent=`累積 EXP ${Number(challenge.status?.exp||0)}`;
    document.getElementById('battleResult').innerHTML=challenge.lastMsg||'選擇技能，再回答題目發動攻擊。';
    controls.querySelectorAll('button,input').forEach(el=>el.disabled=!!challenge.saving);
    renderBattleQuestion();return;
  }
  controls.dataset.battleKey=key;
  controls.innerHTML=`<div class="battle-controls-heading"><h2>⚔️ ${esc(challenge.subject)}・${esc(pet.name)} Lv.${pet.level}</h2><span>累積 EXP ${Number(challenge.status?.exp||0)}</span></div>
    <div id="battleResult" class="battle-result" role="status">${challenge.lastMsg||'選擇技能，再回答題目發動攻擊。'}</div>
    ${locked?'<div class="qbox"><h3>今日對戰結束</h3><p>已達 3 次錯誤，明早 7:00 後重置。</p><button class="btn gray" onclick="renderChallengeHome()">返回挑戰首頁</button></div>':`<div class="battle-operation-grid"><section class="battle-skills"><h3>選擇技能</h3><div class="skill-grid">${skills.map(skill=>`<button class="btn purple skill-btn ${challenge.selectedSkill?.id===skill.id?'selected':''}" aria-pressed="${challenge.selectedSkill?.id===skill.id}" onclick="useBattleSkill('${skill.id}')"><b>${skill.kind==='general'?'⚔️':attributeIconHtml(skill.attribute||getPetAttribute(pet),20)} ${esc(skill.name)}</b><br><span>${battleSkillPowerV600_(skill)}</span></button>`).join('')}</div></section><section id="battleQuestionArea" class="battle-question-area" aria-label="題目與選項">${challenge.question&&challenge.selectedSkill?battleQuestionHtmlV600_():'<div class="battle-question-empty">選擇左側技能，即可開始答題。</div>'}</section></div>`}
    <div class="battle-exit-actions nav"><button class="btn blue" ${challenge.saving?'disabled':''} onclick="saveBattleAndExitV5105(this)">💾 儲存並離開</button><button class="btn gray" onclick="finishChallengeUI()">結束對戰</button><button class="btn secondary" onclick="switchTab('home',document.querySelector('[data-tab=home]'))">🏠 小屋</button><button class="btn gray" onclick="logout()">登出</button></div>`;
  const grid=battleControlsV600_().querySelector('.skill-grid');if(grid)grid.scrollTop=skillScroll;
}
function useBattleSkill(skillId){
  if(mainMode!=='battle'||!challenge.active||challenge.answering||challenge.saving||challenge.status?.locked||Number(challenge.status?.wrong||0)>=3)return;
  const pet=state.pets.find(p=>String(p.petId)===String(challenge.petId));
  const skill=battleSkillsV610_(pet).find(s=>String(s.id)===String(skillId));if(!skill)return;
  challenge.selectedSkill=skill;
  if(!challenge.questions?.length||challenge.qIndex>=challenge.questions.length){loadMoreBattleQuestions();return;}
  challenge.question=challenge.questions[challenge.qIndex];renderBattleQuestion();
}
function cancelBattleSkillV600_(){if(challenge.answering)return;challenge.question=null;challenge.selectedSkill=null;renderBattle();}

const QUESTION_IMAGE_FALLBACK_BY_ID={
  'M001':'IMG001','M002':'IMG001',
  'M004':'IMG002','M005':'IMG002',
  'M009':'IMG003','M010':'IMG004',
  'M025':'IMG005','M029':'IMG006',
  'M032':'IMG007','M036':'IMG008'
};

function resolveQuestionImage(q){
  let src=String(q?.image||q?.imagePath||'').trim().replace(/\\/g,'/');
  let imageId=String(q?.imageId||'').trim();
  if(!imageId) imageId=QUESTION_IMAGE_FALLBACK_BY_ID[String(q?.id||'')]||'';
  if(!src && imageId) src=`assets/math/${imageId}.png`;
  if(!src)return '';
  // Absolute URLs stay unchanged; GitHub-relative images get a cache-busting build query.
  if(!/^https?:\/\//i.test(src)){
    src=src.replace(/^\.?\//,'');
    src=`${src}${src.includes('?')?'&':'?'}v=${FRONTEND_BUILD}`;
  }
  return src;
}

function questionImageHtml(q){
  const src=resolveQuestionImage(q);
  if(!src)return '';
  return `<div class="question-image-wrap">
    <img class="question-image" src="${esc(src)}" alt="題目圖片"
      onload="this.parentElement.style.display='block'"
      onerror="this.parentElement.innerHTML='<div class=&quot;small&quot; style=&quot;color:#b44;padding:8px&quot;>題目圖片載入失敗：${esc(src)}</div>'">
  </div>`;
}

function renderBattleQuestion(){
  if(mainMode!=='battle'||!challenge.active||challenge.answering)return;
  const area=document.getElementById('battleQuestionArea');if(!area)return;
  area.innerHTML=challenge.question&&challenge.selectedSkill?battleQuestionHtmlV600_():'<div class="battle-question-empty">選擇左側技能，即可開始答題。</div>';
  battleControlsV600_().querySelectorAll('.skill-btn').forEach(btn=>{const selected=btn.getAttribute('onclick')===`useBattleSkill('${challenge.selectedSkill?.id}')`;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));});
}
function battleQuestionHtmlV600_(){
  const q=challenge.question,skill=challenge.selectedSkill;
  if(!q||!skill)return '';

  let answer='';
  if(String(q.type).includes('填充')){
    answer=`<input id="fillAns" class="full" type="text" placeholder="輸入答案"><button class="btn blue" style="margin-top:8px" onclick="sendBattleAnswer(document.getElementById('fillAns').value)">送出</button>`;
  }else if(String(q.type).includes('是非')){
    answer=`<div class="grid2"><button class="btn blue option" onclick="sendBattleAnswer('A')">⭕ 是</button><button class="btn red option" onclick="sendBattleAnswer('B')">❌ 否</button></div>`;
  }else{
    answer=(q.options||[]).map((o,i)=>`<button class="btn option blue" onclick="sendBattleAnswer('${String.fromCharCode(65+i)}')">${String.fromCharCode(65+i)}. ${formatMathText(o)}</button>`).join('');
  }

  return `<div class="battle-question">
    <div class="row"><b>${esc(skill.icon||'✨')} ${esc(skill.name)}</b><span>${battleSkillPowerV600_(skill)}</span></div>
    <div class="qtext">${formatMathText(q.text)}</div>
    ${questionImageHtml(q)}
    ${answer}
    <button class="btn gray" style="margin-top:8px" onclick="cancelBattleSkillV600_()">取消技能</button>
  </div>`;
}
async function sendBattleAnswer(ans){
  if(mainMode!=='battle'||!challenge.active||challenge.answering||challenge.saving||challenge.status?.locked||Number(challenge.status?.wrong||0)>=3)return;
  const q=challenge.question,skill=challenge.selectedSkill;if(!q||!skill)return;
  const epoch=BATTLE_VIEW_EPOCH_V600;challenge.answering=true;
  battleControlsV600_().querySelectorAll('button,input').forEach(el=>el.disabled=true);
  const good=normAns(ans)===normAns(q.answer);
  let gained=0;
  if(good){challenge.status.correct=Number(challenge.status.correct||0)+1;gained=challengeLocalExp(challenge.status.correct);challenge.status.exp=Number(challenge.status.exp||0)+gained;}
  else challenge.status.wrong=Number(challenge.status.wrong||0)+1;

  const damage=Math.max(1,Math.round(Number(skill.damage||0)*(good?1:.3)));
  challenge.pending.push({questionId:q.id,answer:ans});challenge.seen.push(q.id);challenge.qIndex++;
  if(challenge.questions && challenge.questions.length-challenge.qIndex<=6){const refill=localQuestionBatch(challenge.subject,challenge.seen.slice(-80),30);if(refill.length){challenge.questions=challenge.questions.slice(challenge.qIndex).concat(refill);challenge.qIndex=0;}}
  challenge.lastMsg=good?`<span class="success">✅ 正確！${esc(skill.name)}造成 <span class="damage-pop">${damage}</span> 傷害，+${gained} EXP</span>`:`<span class="wrong">❌ 答錯，只造成 30% 傷害：<span class="damage-pop">${damage}</span><br>正確答案：${formatMathText(q.answer)} ${formatMathText(q.explanation||'')}</span>`;
  challenge.question=null;challenge.selectedSkill=null;

  challenge.monsterHp=Math.max(0,Number(challenge.monsterHp||0)-damage);

  if(challenge.status.wrong>=3){
    challenge.status.locked=true;
    if(state){state.challengeStatus=state.challengeStatus||{};state.challengeStatus[challenge.subject]={...challenge.status};}
    await playPetAttackAnimation(damage);if(epoch===BATTLE_VIEW_EPOCH_V600)challenge.answering=false;
    try{await flushChallengeAnswers(true);}catch(e){alert(e.message||e);}
    if(epoch===BATTLE_VIEW_EPOCH_V600&&mainMode==='battle')renderBattle();
    return;
  }

  if(challenge.monsterHp<=0){
    challenge.lastMsg+=`<br><span class="success">🏆 擊敗怪物！下一隻怪物出現。</span>`;
    challenge.monsterNo++;
    challenge.monsterCfg=getMonsterForBattle(challenge.subject,challenge.monsterNo);
    challenge.monsterMaxHp=getMonsterHp(challenge.monsterCfg,challenge.monsterNo);
    challenge.monsterHp=challenge.monsterMaxHp;
  }
  const animation=playPetAttackAnimation(damage);
  if(challenge.pending.length>=12)flushChallengeAnswers(false);
  await animation;if(epoch===BATTLE_VIEW_EPOCH_V600)challenge.answering=false;
  if(epoch===BATTLE_VIEW_EPOCH_V600&&mainMode==='battle')renderBattle();
}
async function loadMoreBattleQuestions(){
  const epoch=BATTLE_VIEW_EPOCH_V600;
  try{
    let qs=localQuestionBatch(challenge.subject,challenge.seen.slice(-80),30);
    if(!qs.length){
      await ensureQuestionBank(challenge.subject);
      qs=localQuestionBatch(challenge.subject,challenge.seen.slice(-80),30);
    }
    if(epoch!==BATTLE_VIEW_EPOCH_V600||mainMode!=='battle')return;
    challenge.questions=qs||[];
    challenge.qIndex=0;
    if(!challenge.questions.length)throw new Error('沒有可用題目');
    challenge.question=challenge.questions[0];
    renderBattleQuestion();
  }catch(e){alert(e.message||e);}
}
function challengeLocalExp(n){if(n>=50)return 6;if(n>=40)return 5;if(n>=30)return 4;if(n>=20)return 3;if(n>=10)return 2;return 1;}
function normAns(v){return String(v??'').trim().toUpperCase().replace(/\s+/g,'');}
function challengeBatchStoragePrefixV600_(studentId){return 'petHouseChallengeBatchV600:'+encodeURIComponent(studentId)+':';}
function queuedChallengeBatchesV600_(studentId){
  const prefix=challengeBatchStoragePrefixV600_(studentId),batches=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
    const batch=JSON.parse(localStorage.getItem(key));
    if(batch?.studentId!==studentId||!batch.batchId||!Array.isArray(batch.answers))throw new Error('待同步答題紀錄無效，請保留紀錄並請老師協助');
    batches.push({...batch,storageKey:key});
  }
  return batches.sort((a,b)=>a.createdAt-b.createdAt||a.batchId.localeCompare(b.batchId));
}
function captureChallengeBatchV600_(studentId){
  if(currentId!==studentId||!challenge.pending?.length||!challenge.subject||!challenge.petId)return;
  const answers=challenge.pending.slice(0,100),batchId=crypto.randomUUID();
  const createdAt=Math.max(Date.now(),...queuedChallengeBatchesV600_(studentId).map(b=>Number(b.createdAt||0)+1));
  const batch={studentId,subject:challenge.subject,petId:challenge.petId,answers,batchId,createdAt};
  // 每批獨立 storage key，兩個分頁的保存與刪除不會互相覆蓋。
  localStorage.setItem(challengeBatchStoragePrefixV600_(studentId)+batchId,JSON.stringify(batch));
  challenge.pending.splice(0,answers.length);
}
async function flushChallengeAnswers(force){
  if(challenge.syncing){if(!force)return;await challenge.syncing;}
  const studentId=currentId;if(!studentId)return;
  let job;
  job=(async()=>{
    while(currentId===studentId){
      captureChallengeBatchV600_(studentId);
      const batch=queuedChallengeBatchesV600_(studentId)[0];if(!batch)return;
      const args=[studentId,batch.subject,batch.petId,batch.answers,batch.batchId];
      const result=await (force?gs('syncChallengeBatch',...args):gsRaw('syncChallengeBatch',...args));
      if(!result?.ok)throw new Error(result?.message||'答題同步未確認成功');
      // 只有確實收到成功才刪除；timeout 時原 ID／原內容留待重送。
      localStorage.removeItem(batch.storageKey);
      if(currentId!==studentId||!state)return;
      if(result.status){
        state.challengeStatus=state.challengeStatus||{};state.challengeStatus[batch.subject]={...result.status};
        if(CHALLENGE_HOME_META?.status)CHALLENGE_HOME_META.status[batch.subject]={...result.status};
        const queuedCurrent=queuedChallengeBatchesV600_(studentId).some(b=>b.subject===challenge.subject&&String(b.petId)===String(challenge.petId));
        if(challenge.subject===batch.subject&&String(challenge.petId)===String(batch.petId)&&((!challenge.pending.length&&!queuedCurrent)||result.status.locked))challenge.status={...result.status};
      }
    }
  })().catch(e=>{if(force)throw e;console.warn('答題批次保留待重試',e.message||e);}).finally(()=>{if(challenge.syncing===job)challenge.syncing=null;});
  challenge.syncing=job;
  if(force)return await job;
}

async function saveBattleAndExitV5105(btn){
  if(challenge.saving||challenge.answering)return;
  if(!challenge.subject || !challenge.petId)return;
  const epoch=BATTLE_VIEW_EPOCH_V600,account=currentId;
  challenge.saving=true;
  const oldText=btn?.innerHTML||'';
  if(btn){btn.disabled=true;btn.innerHTML='⏳ 儲存中...';}
  try{
    // 先把尚未同步的答題結果送出，避免答題紀錄與怪物進度不同步。
    const payload={
      subject:challenge.subject,
      petId:challenge.petId,
      monsterNo:Math.max(1,Number(challenge.monsterNo||1)),
      monsterHp:Math.max(1,Number(challenge.monsterHp||1)),
      monsterMaxHp:Math.max(1,Number(challenge.monsterMaxHp||1)),
      seen:Array.isArray(challenge.seen)?challenge.seen.slice(-80):[]
    };
    await flushChallengeAnswers(true);
    await gsRaw('saveBattleProgressV5105',account,payload);
    if(account!==currentId||epoch!==BATTLE_VIEW_EPOCH_V600)return;
    challenge.savedProgress=null;
    challenge.question=null;
    challenge.selectedSkill=null;
    currentTab='challenge';
    renderChallengeHome();
    const note=document.createElement('div');
    note.className='success';
    note.textContent=`💾 已儲存：${payload.subject}・怪物 ${payload.monsterNo}`;
    battleControlsV600_().prepend(note);
    battleTimeoutV600_(()=>note.remove(),2200);
  }catch(e){
    alert('儲存失敗：'+(e.message||e));
    if(btn){btn.disabled=false;btn.innerHTML=oldText;}
  }finally{
    challenge.saving=false;
  }
}

async function finishChallengeUI(){
  if(challenge.answering||challenge.saving)return;
  const epoch=BATTLE_VIEW_EPOCH_V600,account=currentId;
  if(challenge.subject && challenge.petId){
    const ok=confirm('這會結束目前畫面，但不會儲存這一隻怪物的 HP 與怪物編號。若想下次接著打，請按「💾 儲存並離開」。\n\n仍要直接結束嗎？');
    if(!ok)return;
  }
  try{
    await flushChallengeAnswers(true);
    if(epoch!==BATTLE_VIEW_EPOCH_V600||account!==currentId)return;
    currentTab='challenge';
    challenge.subject='';
    challenge.petId='';
    challenge.savedProgress=null;
    renderBattleMain();
    renderChallengeHome();
  }catch(e){alert(e.message||e);}
}
function showLocked(result){
  const status=result?.status||{correct:0,wrong:3,exp:0,locked:true};
  if(state && challenge.subject){
    state.challengeStatus=state.challengeStatus||{};
    state.challengeStatus[challenge.subject]={...status,locked:true};
  }
  challenge.question=null;challenge.selectedSkill=null;
  battleControlsV600_().innerHTML=`<div class="qbox"><h3>今日對戰已結束</h3><p>答對：${Number(status.correct||0)} 題</p><p>累積 EXP：${Number(status.exp||0)}</p><p>${esc(result?.resetAt||'明早 7:00')} 後重置。</p><button class="btn gray" onclick="renderChallengeHome()">返回</button></div>`;
}
async function renderMail(){
  renderMailFromCache();
  if(!mailboxLoaded || !cacheFresh(mailboxAt,60000))await refreshMailboxInBackground(true);
}
function renderMailFromCache(){
  const unclaimed=mailbox.filter(m=>!(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')).length;
  panel.innerHTML=`<h3>📬 信箱</h3><div class="mail-actions"><button class="btn blue" ${unclaimed&&!MAIL_CLAIM_BUSY_V600?'':'disabled'} onclick="claimAllMailUI()">📦 一鍵收取全部（${unclaimed}）</button><button class="btn gray" ${MAIL_CLAIM_BUSY_V600?'disabled':''} onclick="refreshMailboxInBackground(true)">更新信箱</button></div>${mailbox.map(m=>`<div class="mailcard"><b>${esc(m['標題'])}</b><br><span class="small">寄件者：${esc(m['寄件者'])}</span><p>${esc(m['內容'])}</p>${m['附件ID']?`${itemImageHtmlV610(m['附件ID'],ITEM_CONFIGS[m['附件ID']]||{},32)} ${esc(m['附件名稱'])} ×${m['附件數量']}<br>`:''}<button class="btn ${m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE'?'gray':''}" ${(MAIL_CLAIM_BUSY_V600||m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')?'disabled':''} onclick="claimMailUI('${m['信件ID']}')">${(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')?'已領取':'領取附件'}</button></div>`).join('')||'<div class="mailcard">目前沒有信件。</div>'}`;
  activateStoneSpritesV610();
}
let MAIL_CLAIM_BUSY_V600=false;
async function claimAllMailUI(){
  if(!mailbox.some(m=>!(m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')))return;
  return claimMailboxUIV600_('claimAllMailFast');
}
async function claimMailUI(id){
  const m=mailbox.find(x=>String(x['信件ID'])===String(id));
  if(!m||m['是否領取']===true||String(m['是否領取']).toUpperCase()==='TRUE')return;
  return claimMailboxUIV600_('claimMailFast',id);
}
async function claimMailboxUIV600_(action,mailId){
  if(MAIL_CLAIM_BUSY_V600)return;
  MAIL_CLAIM_BUSY_V600=true;
  const studentId=currentId;
  renderMailFromCache();
  try{
    const r=await gs(action,...(mailId?[studentId,mailId]:[studentId]));
    if(currentId!==studentId)return;
    if(Array.isArray(r?.mailbox))mailbox=r.mailbox;
    else mailbox.forEach(m=>{if(String(m['信件ID'])===String(mailId))m['是否領取']=true;});
    if(Array.isArray(r?.inventory)){inventory=r.inventory;CLIENT_CACHE.inventory=inventory;CLIENT_CACHE.inventoryAt=Date.now();saveLocal('inventory',inventory);}
    if(state)state.unreadMail=Number(r?.unreadMail??state.unreadMail);
    mailBadge.textContent=state?.unreadMail||0;
    mailBadge.classList.toggle('hidden',!state?.unreadMail);
    saveLocal('mailbox',mailbox);
  }catch(e){
    if(currentId!==studentId)return;
    alert(e.message||e);
    // 逾時可能已入帳：重新讀取實際信箱，下次以同一信件 ID 恢復交易。
    await refreshMailboxInBackground(true);
  }finally{
    MAIL_CLAIM_BUSY_V600=false;
    if(currentId===studentId && currentTab==='mail')renderMailFromCache();
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
  if(!showPurchaseBusy('兌換中'))return;
  try{
    const r=await gs('redeemBackgroundFast',currentId,id);
    state.backgrounds=Array.isArray(r.backgrounds)?r.backgrounds:state.backgrounds;
    inventory=Array.isArray(r.inventory)?r.inventory:inventory;
    CLIENT_CACHE.inventory=inventory;CLIENT_CACHE.inventoryAt=Date.now();saveLocal('inventory',inventory);
    await renderShop();
  }catch(e){alert(e.message||e);}
  finally{hidePurchaseBusy();}
}

async function renderShop(forceSync=false){
  panel.innerHTML=`<h3>🛒 土地／背景</h3><div class="itemcard">讀取背景清單中...</div>`;
  try{
    if(forceSync || !Object.keys(LIVE_LAND_CONFIGS).length){
      const local=loadLandCatalogLocalV5106();
      if(!forceSync && local?.rows?.length)applyLandCatalogV5106(local.rows);
      else await ensureLandCatalogV5106(forceSync);
    }
  }catch(e){
    if(!Object.keys(LIVE_LAND_CONFIGS).length){
      panel.innerHTML=`<h3>🛒 土地／背景</h3><div class="itemcard"><b>⚠️ 背景資料暫時無法載入</b><br>${esc(e.message||e)}<br><br><button class="btn" onclick="renderShop(true)">重新同步</button></div>`;
      return;
    }
    console.warn('背景同步失敗，沿用本機快取',e);
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
  <div class="row" style="justify-content:space-between;align-items:center"><span class="success">✓ 已同步試算表最新設定</span><button class="btn gray" onclick="refreshLiveLandCatalog(true).then(()=>renderShop())">↻ 強制同步</button></div>
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
  if(!showPurchaseBusy('購買中'))return;
  try{
    const r=await gs('buyBackgroundFast',currentId,id);
    state.backgrounds=Array.isArray(r.backgrounds)?r.backgrounds:state.backgrounds;
    if(r.coins!==undefined){state.student.coins=r.coins;coins.textContent=r.coins;}
    await renderShop();
  }catch(e){alert(e.message||e);}
  finally{hidePurchaseBusy();}
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
  try{if(currentId&&challenge.pending?.length)captureChallengeBatchV600_(currentId);}catch(e){alert('答題紀錄未能保存：'+(e.message||e));return;}
  flushChallengeAnswers(false);
  cleanupFurnitureViewV610();document.getElementById('studentLayout')?.classList.remove('furniture-mode');
  cleanupBattleViewV600_();challenge.active=false;
  document.getElementById('studentLayout')?.classList.remove('battle-mode');
  STUDENT_TOKEN_V600='';UPGRADE_AT_V600=0;UPGRADE_PET_V600='';UPGRADE_LOADING_V600=null;STONE_CATALOG_V600=[];UPGRADE_READY_V600=false;
  UPGRADE_NOTICE_V600='';UPGRADE_MODE_V600='exp';
  currentId='';state=null;mainMode='home';inventory=[];mailbox=[];shop=null;mailboxLoaded=false;mailboxAt=0;adminPassword='';sessionStorage.removeItem('petHouseAdminPassword');
  if(wanderTimer)clearInterval(wanderTimer);
  if(backgroundMailTimer)clearInterval(backgroundMailTimer);
  studentView.classList.add('hidden');adminView.classList.add('hidden');loginView.classList.remove('hidden');
}
let adminPassword=sessionStorage.getItem('petHouseAdminPassword')||'';
async function askAdminPassword(){
  return new Promise(resolve=>{
    const modal=document.getElementById('adminPasswordModal');
    const input=document.getElementById('adminPasswordInput');
    const ok=document.getElementById('adminPasswordOk');
    const cancel=document.getElementById('adminPasswordCancel');
    if(!modal||!input){resolve('');return;}
    modal.classList.add('show');input.value='';setTimeout(()=>input.focus(),20);
    const done=(value)=>{
      modal.classList.remove('show');
      ok.onclick=null;cancel.onclick=null;input.onkeydown=null;
      resolve(value);
    };
    ok.onclick=()=>done(input.value);
    cancel.onclick=()=>done('');
    input.onkeydown=e=>{if(e.key==='Enter')done(input.value);if(e.key==='Escape')done('');};
  });
}
async function openAdmin(){
  const pw=await askAdminPassword();
  if(!pw)return;
  try{
    await gs('adminLogin',pw);
    adminPassword=pw;
    sessionStorage.setItem('petHouseAdminPassword',pw);
    loginView.classList.add('hidden');adminView.classList.remove('hidden');
    await loadAdmin();
  }catch(e){alert('密碼錯誤或後台驗證失敗：'+(e.message||e));}
}
async function loadAdmin(){
  if(ADMIN_BATCH_BUSY_V610)return;
  if(!adminPassword){logout();return;}
  adminData=await gs('getAdminDataSecure',adminPassword);
  const itemOpts=adminData.items.map(x=>`<option value="${x['道具ID']}">${esc(x['名稱'])}</option>`).join('');
  const petOpts=adminData.pets.map(x=>`<option value="${x.petId}">${esc(x.name)}</option>`).join('');
  adminArea.innerHTML=`
    <div class="petcard" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div><b>⚙️ 遊戲設定快取</b><div class="small">修改試算表後按一次，成功時會顯示更新時間。</div></div>
        <button class="btn blue" onclick="adminRefreshGameConfig()">🔄 更新遊戲設定</button>
      </div>
      <div id="admin-config-status" class="small" style="margin-top:8px"></div>
    </div>

    <div class="petcard" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div><b>📊 教室連線診斷</b><div class="small">只測回應速度，不寫入 Google Sheet。</div></div>
        <button class="btn secondary" onclick="runConnectionDiagnostics()">立即測試</button>
      </div>
      <div id="diagSummary" style="margin-top:10px"></div>
      <div id="diagRecent" class="small" style="margin-top:8px"></div>
    </div>
    <div id="adminBatchV610" class="bulk-admin-card"></div>

    <table class="admin-table">
      <thead><tr><th>座號</th><th>學生</th><th>金幣</th><th>發獎勵</th></tr></thead>
      <tbody>${adminData.students.map(s=>`<tr>
        <td>${s.seat||''}</td>
        <td>${esc(s.name)}<br><span class="small">${esc(s.id)}</span></td>
        <td><span id="coin-${s.id}">${s.coins}</span></td>
        <td><div class="row">
          <input id="coinamt-${s.id}" type="number" min="1" value="10" style="width:75px">
          <button class="btn" onclick="adminCoinCustom('${s.id}')">發金幣</button>
          <select id="it-${s.id}">${itemOpts}</select>
          <input id="iq-${s.id}" type="number" min="1" value="1" style="width:65px">
          <button class="btn purple" onclick="adminItem('${s.id}')">發道具</button>
          <select id="pt-${s.id}">${petOpts}</select>
          <button class="btn secondary" onclick="adminPet('${s.id}')">發寵物</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table>`;
  renderAdminBatchV610();
}
let ADMIN_BATCH_MODE_V610='COINS',ADMIN_BATCH_BUSY_V610=false,ADMIN_BATCH_PREVIEW_V610=null;
let ADMIN_BATCH_DRAFT_V610={COINS:{},ITEMS:{}},ADMIN_BATCH_ITEM_V610='',ADMIN_BATCH_RESULT_V610=null;
const ADMIN_BATCH_PENDING_PREFIX_V610='petHouseAdminBatchV610:';
function pendingAdminBatchClientV610(){
  const rows=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key?.startsWith(ADMIN_BATCH_PENDING_PREFIX_V610))continue;
    const saved=JSON.parse(localStorage.getItem(key));
    if(!saved||!/^[A-Za-z0-9-]{16,100}$/.test(saved.requestId)||!['COINS','ITEMS'].includes(saved.mode)||!Array.isArray(saved.entries))throw new Error('批次重試資料格式錯誤');
    rows.push(saved);
  }
  return rows;
}
function captureAdminBatchDraftV610(){
  document.querySelectorAll('.admin-batch-value').forEach(el=>ADMIN_BATCH_DRAFT_V610[ADMIN_BATCH_MODE_V610][el.dataset.student]=el.value);
  const select=document.getElementById('adminBatchItemV610');if(select)ADMIN_BATCH_ITEM_V610=select.value;
}
function setAdminBatchModeV610(mode){
  if(ADMIN_BATCH_BUSY_V610)return;captureAdminBatchDraftV610();ADMIN_BATCH_MODE_V610=mode==='ITEMS'?'ITEMS':'COINS';ADMIN_BATCH_PREVIEW_V610=null;renderAdminBatchV610();
}
function renderAdminBatchV610(){
  const root=document.getElementById('adminBatchV610');if(!root||!adminData)return;
  let pending=[];try{pending=pendingAdminBatchClientV610();}catch(e){root.textContent='無法讀取批次重試資料，請先檢查瀏覽器儲存空間。';return;}
  const mode=ADMIN_BATCH_MODE_V610,coins=mode==='COINS';
  const students=[...adminData.students].sort((a,b)=>Number(a.seat||999)-Number(b.seat||999)||String(a.id).localeCompare(String(b.id)));
  if(!adminData.items.some(x=>String(x['道具ID'])===ADMIN_BATCH_ITEM_V610))ADMIN_BATCH_ITEM_V610=String(adminData.items[0]?.['道具ID']||'');
  root.innerHTML=`<h3>👩‍🏫 全班批次發放</h3><div class="row"><button class="btn ${coins?'blue':'gray'} admin-batch-control" onclick="setAdminBatchModeV610('COINS')">批次發金幣</button><button class="btn ${coins?'gray':'purple'} admin-batch-control" onclick="setAdminBatchModeV610('ITEMS')">批次發道具</button></div>
    ${pending.map(p=>`<p class="admin-batch-pending"><b>有一筆發放尚未確認</b> · ${p.mode==='COINS'?'金幣':'道具'}<br><button class="btn orange admin-batch-retry" data-request-id="${esc(p.requestId)}" onclick="submitAdminBatchV610('${esc(p.requestId)}')">以原批次重試</button></p>`).join('')}
    ${coins?'':`<p><span id="adminItemPreviewV610"></span> <label>道具 <select id="adminBatchItemV610" class="admin-batch-control" onchange="captureAdminBatchDraftV610();cancelAdminBatchV610();renderAdminItemPreviewV610()">${adminData.items.map(x=>`<option value="${esc(x['道具ID'])}" ${String(x['道具ID'])===ADMIN_BATCH_ITEM_V610?'selected':''}>${esc(x['名稱'])}</option>`).join('')}</select></label></p>`}
    <div class="row" style="margin-top:10px">${(coins?[100]:[1,5]).map(n=>`<button class="btn secondary admin-batch-control" onclick="fillAdminBatchV610(${n})">全班填入 ${n}</button>`).join('')}<button class="btn gray admin-batch-control" onclick="fillAdminBatchV610(0)">全部清空</button></div>
    <p class="small">發放數值會加到既有資產；0 或空白代表略過。每位學生可以填不同數值。</p>
    <div style="overflow:auto"><table class="admin-table"><thead><tr><th>座號</th><th>學號</th><th>${coins?'金額':'數量'}</th></tr></thead><tbody>${students.map(s=>`<tr><td>${esc(String(s.seat||'').padStart(2,'0'))}</td><td>${esc(s.id)}<br><span class="small">${esc(s.name)}</span></td><td><input type="number" min="0" step="1" inputmode="numeric" class="admin-batch-value admin-batch-control" data-student="${esc(s.id)}" value="${esc(ADMIN_BATCH_DRAFT_V610[mode][s.id]??'0')}" style="width:90px" oninput="captureAdminBatchDraftV610();cancelAdminBatchV610()"></td></tr>`).join('')}</tbody></table></div>
    <button class="btn purple admin-batch-control" style="margin-top:12px" onclick="previewAdminBatchV610()">確認批次發放</button><div id="adminBatchReviewV610"></div><div id="adminBatchResultV610" style="margin-top:10px"></div>`;
  renderAdminItemPreviewV610();
  setAdminBatchBusyV610(ADMIN_BATCH_BUSY_V610);showAdminBatchResultV610(ADMIN_BATCH_RESULT_V610);
}
function setAdminBatchBusyV610(busy){
  ADMIN_BATCH_BUSY_V610=!!busy;
  const pending=pendingAdminBatchClientV610();
  document.querySelectorAll('#adminBatchV610 .admin-batch-control').forEach(el=>el.disabled=busy||pending.length>0);
  document.querySelectorAll('#adminBatchV610 .admin-batch-retry').forEach(el=>el.disabled=busy);
}
function cancelAdminBatchV610(){
  if(ADMIN_BATCH_BUSY_V610)return;ADMIN_BATCH_PREVIEW_V610=null;
  const review=document.getElementById('adminBatchReviewV610');if(review)review.innerHTML='';
}
function fillAdminBatchV610(value){
  if(ADMIN_BATCH_BUSY_V610||pendingAdminBatchClientV610().length)return;
  document.querySelectorAll('.admin-batch-value').forEach(el=>el.value=value===0?'':String(value));captureAdminBatchDraftV610();cancelAdminBatchV610();
}
function previewAdminBatchV610(){
  if(ADMIN_BATCH_BUSY_V610||pendingAdminBatchClientV610().length)return;captureAdminBatchDraftV610();
  const mode=ADMIN_BATCH_MODE_V610,field=mode==='COINS'?'amount':'quantity';
  const entries=[...document.querySelectorAll('.admin-batch-value')].map(el=>({studentId:el.dataset.student,[field]:Number(el.value||0)}));
  if(entries.some(r=>!Number.isSafeInteger(r[field])||r[field]<0)){alert('請輸入非負整數');return;}
  if(!entries.some(r=>r[field]>0)){alert('請至少填寫一位學生的發放數值');return;}
  if(mode==='ITEMS'&&!ADMIN_BATCH_ITEM_V610){alert('請先選擇道具');return;}
  ADMIN_BATCH_PREVIEW_V610={mode,itemId:mode==='ITEMS'?ADMIN_BATCH_ITEM_V610:'',entries,reason:'課堂批次獎勵'};
  const item=adminData.items.find(x=>String(x['道具ID'])===ADMIN_BATCH_ITEM_V610),label=mode==='COINS'?'金幣':item?.['名稱']||'道具';
  const review=document.getElementById('adminBatchReviewV610');
  review.innerHTML=`<div class="petcard"><h4>確認發放：${esc(label)}</h4><p>本次 ${entries.filter(r=>r[field]>0).length} 位學生，合計 ${entries.reduce((n,r)=>n+BigInt(r[field]),0n)} ${mode==='COINS'?'金幣':'個'}。</p>${entries.filter(r=>r[field]>0).map(r=>`<div>${esc(r.studentId)}：+${r[field]}</div>`).join('')}<p>確認後一次送出整批。</p><button class="btn purple admin-batch-control" onclick="submitAdminBatchV610()">確定發放</button> <button class="btn gray admin-batch-control" onclick="cancelAdminBatchV610()">返回修改</button></div>`;
}
async function submitAdminBatchV610(requestId){
  if(ADMIN_BATCH_BUSY_V610)return;
  let pending;
  try{
    if(requestId)pending=pendingAdminBatchClientV610().find(p=>p.requestId===requestId);
    else{
      if(pendingAdminBatchClientV610().length||!ADMIN_BATCH_PREVIEW_V610)return;
      pending={...ADMIN_BATCH_PREVIEW_V610,requestId:crypto.randomUUID()};
      localStorage.setItem(ADMIN_BATCH_PENDING_PREFIX_V610+pending.requestId,JSON.stringify(pending));
    }
    if(!pending)return;setAdminBatchBusyV610(true);
    const response=pending.mode==='COINS'?await gs('grantCoinsBatchV610',adminPassword,pending.entries,pending.requestId,pending.reason):await gs('grantItemsBatchV610',adminPassword,pending.itemId,pending.entries,pending.requestId,pending.reason);
    ADMIN_BATCH_RESULT_V610=response;
    if(response.ok===false){if(response.retryable!==false)response.message=response.message||'結果尚未確認，請重試原批次';else localStorage.removeItem(ADMIN_BATCH_PENDING_PREFIX_V610+pending.requestId);}
    else{
      localStorage.removeItem(ADMIN_BATCH_PENDING_PREFIX_V610+pending.requestId);ADMIN_BATCH_PREVIEW_V610=null;
      response.results.forEach(r=>{
        if(!r.ok||r.skipped)return;
        if(pending.mode==='COINS'){
          const student=adminData.students.find(s=>String(s.id)===r.studentId);if(student)student.coins=r.coins;
          const el=document.getElementById('coin-'+r.studentId);if(el)el.textContent=r.coins;
        }
        ADMIN_BATCH_DRAFT_V610[pending.mode][r.studentId]='0';
      });
    }
  }catch(e){ADMIN_BATCH_RESULT_V610={ok:false,message:String(e.message||e)+'；請以原批次重試確認。'};}
  finally{ADMIN_BATCH_BUSY_V610=false;renderAdminBatchV610();}
}
function showAdminBatchResultV610(result){
  const el=document.getElementById('adminBatchResultV610');if(!el||!result)return;
  el.innerHTML=`<p><b>${result.ok?'發放完成':'尚未完成確認'}</b>：成功 ${result.successCount||0} 人／失敗 ${result.failedCount||0} 人／略過 ${result.skippedCount||0} 人${result.unconfirmedCount?'／待確認 '+result.unconfirmedCount+' 人':''}</p>${result.message?`<p class="wrong">${esc(result.message)}</p>`:''}${(result.results||[]).map(r=>`<div>${esc(r.studentId)}：${r.ok===null?'待確認':r.ok?(r.skipped?'略過（0）':'✅ +'+(r.amount??r.quantity)):'❌ '+esc(r.reason)}</div>`).join('')}`;
}
function toggleAllAdminStudents(on){
  document.querySelectorAll('.admin-student-check').forEach(x=>x.checked=!!on);
}
async function adminBulkItem(){
  const ids=[...document.querySelectorAll('.admin-student-check:checked')].map(x=>x.value);
  const item=document.getElementById('bulkItem')?.value;
  const qty=Math.max(1,Number(document.getElementById('bulkItemQty')?.value||1));
  if(!ids.length){alert('請先勾選至少一位學生');return;}
  try{
    const r=await gs('adminGrantItemsBatchV599',adminPassword,ids,item,qty,'課堂批量獎勵');
    alert(`✅ 已完成：${r.updated||ids.length} 位學生，每人 ${qty} 個`);
  }catch(e){alert(e.message||e);}
}
async function adminCoinCustom(id){
  const amount=Math.max(1,Number(document.getElementById('coinamt-'+id)?.value||0));
  if(!amount)return;
  try{
    const r=await gs('adminAddCoinsFastV599',adminPassword,id,amount,'課堂獎勵');
    const el=document.getElementById('coin-'+id);if(el)el.textContent=Number(r.coins||0);
  }catch(e){alert(e.message||e);}
}


function renderDiagRecent(){
  const box=document.getElementById('diagRecent');
  if(!box)return;
  const rows=API_DIAG_LOG.slice(0,10);
  box.innerHTML=rows.length?rows.map(x=>{
    const d=diagLevel(x.ms);
    const time=new Date(x.at).toLocaleTimeString('zh-TW',{hour12:false});
    return `<div>${time}｜${esc(x.fn)}｜${(x.ms/1000).toFixed(2)} 秒｜${x.ok?d.label:'❌ 失敗'}</div>`;
  }).join(''):'尚無紀錄';
}
async function timedDiag(label,fn){
  const t0=performance.now();
  try{
    await fn();
    return {label,ms:performance.now()-t0,ok:true};
  }catch(e){
    return {label,ms:performance.now()-t0,ok:false,error:e.message||String(e)};
  }
}
async function runConnectionDiagnostics(){
  const box=document.getElementById('diagSummary');
  if(box)box.innerHTML='測試中…';
  const tests=[];
  tests.push(await timedDiag('API 基本回應',()=>gsRaw('diagnosticPingV5103')));
  if(currentId){
    tests.push(await timedDiag('學生基本資料',()=>gsRaw('getPostLoginBundleV5101',currentId)));
    tests.push(await timedDiag('挑戰首頁',()=>gsRaw('getChallengeHomeBundleV5101',currentId)));
  }
  if(box){
    box.innerHTML=tests.map(t=>{
      const d=diagLevel(t.ms);
      return `<div class="itemcard" style="margin:6px 0"><b>${esc(t.label)}</b>：
        <span class="${t.ok?d.cls:'wrong'}">${(t.ms/1000).toFixed(2)} 秒｜${t.ok?d.label:'❌ 失敗'}</span>
        ${t.error?`<div class="small wrong">${esc(t.error)}</div>`:''}</div>`;
    }).join('');
  }
  renderDiagRecent();
}

async function adminRefreshGameConfig(){
  try{
    const st=document.getElementById('admin-config-status');
    if(st)st.textContent='正在更新…';
    const data=await gs('adminRefreshGameConfigV598',adminPassword);
    if(data?.catalog){
      applyStaticCatalogBundle(data.catalog);
      saveStaticCatalogCache(data.catalog);
    }
    if(st){
      st.innerHTML=`✅ 更新成功：${esc(data?.updatedAt||'剛剛')}。新登入/重新整理的學生會使用最新設定。`;
      st.style.color='#17813b';
    }
    alert('✅ 遊戲設定已更新完成');
  }catch(e){
    const st=document.getElementById('admin-config-status');
    if(st){st.textContent='❌ 更新失敗：'+(e.message||e);st.style.color='#b33';}
    alert(e.message||e);
  }
}
async function adminItem(id){
  if(adminBusyItem.has(id))return;
  const item=document.getElementById('it-'+id).value,qty=Number(document.getElementById('iq-'+id).value||1);
  const btn=document.activeElement;
  adminBusyItem.add(id);if(btn)btn.disabled=true;
  try{
    const r=await gs('adminGrantItemFast',adminPassword,id,item,qty,'課堂獎勵');
    const note=document.createElement('span');note.className='success';note.textContent=` ✅ 已發 ${qty}`;
    btn?.parentElement?.appendChild(note);setTimeout(()=>note.remove(),1400);
  }catch(e){alert(e.message||e);}
  finally{adminBusyItem.delete(id);if(btn)btn.disabled=false;}
}
async function adminPet(id){const p=document.getElementById('pt-'+id).value;try{await gs('adminAssignPet',adminPassword,id,p);alert('已分配寵物');}catch(e){alert(e.message||e);}}
