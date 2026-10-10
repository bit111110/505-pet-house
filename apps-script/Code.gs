/**
 * 班級寵物小屋 V4
 * 地面/天空寵物、升級道具、信箱整點禮物、五科無限挑戰
 * Google Apps Script + Google 試算表
 */

const APP_VERSION='V6.0';
const TZ = 'Asia/Taipei';

const SHEETS = {
  BATTLE_BACKGROUNDS:'對戰背景設定',
  PET_BATTLE:'寵物戰鬥設定',
  MONSTERS:'怪物設定',
  STUDENTS: '學生資料',
  PETS: '學生寵物',
  PET_CONFIG: '寵物設定',
  LANDS: '土地設定',
  STUDENT_LANDS: '學生土地',
  FURNITURE: '家具設定',
  FURNITURE_SERIES: '家具系列',
  STUDENT_FURNITURE: '學生家具',
  REWARDS: '獎勵紀錄',
  ITEM_CONFIG: '道具設定',
  STUDENT_ITEMS: '學生道具',
  MAILBOX: '信箱',
  QUESTIONS: '挑戰題庫',
  CHALLENGES: '挑戰紀錄',
  BATTLE_SAVES: '對戰存檔',
  SKILL_ENHANCEMENTS: '技能強化紀錄',
  STUDENT_PLOTS: '學生土地格',
  STUDENT_BACKGROUNDS: '學生背景'
};

const VALID_SEATS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,22,23,24,25];

// 你原本的三階段圖片資料夾（保留）
const STAGE1_FOLDER_ID = '12J1m_ERknyuvTEYqtw2-tdpy2oU0wwFs';
const STAGE2_FOLDER_ID = '1OoOsmcvHpz3iDtyIpN7U7xNRAotuN9E2';
const STAGE3_FOLDER_ID = '14CO9SiK-VJO06B11VXBQUOgbWKxwyGYf';

// V6.1 Phase 3: public, read-only furniture catalogs; ownership stays in 學生家具.
const STONE_SPRITE_PATH_V610='assets/items/stones/attribute-stones.png';
const LEGACY_FURNITURE_SERIES_V610='LEGACY';
function enabledFurnitureV610_(value){return value!==false&&String(value).toUpperCase()!=='FALSE';}
function furnitureImagePathV610_(value){
  const path=String(value||'').trim().replace(/\\/g,'/');
  return /^(?:https?:\/\/|assets\/)/i.test(path)?path:'';
}
function furnitureColumnV610_(sh,hm,name){
  const n=sh?sh.getLastRow()-1:0;
  return n>0&&hm[name]?sh.getRange(2,hm[name],n,1).getValues().map(r=>r[0]):Array(Math.max(0,n)).fill('');
}
function furnitureRevisionV610_(){return CacheService.getScriptCache().get('FURN_REV_V610')||'0';}
function clearFurnitureCacheV610_(){CacheService.getScriptCache().put('FURN_REV_V610',Utilities.getUuid(),21600);}
function furnitureCacheV610_(key,loader,refresh){
  const c=CacheService.getScriptCache();
  if(!refresh){try{const saved=c.get(key);if(saved)return JSON.parse(saved);}catch(e){}}
  const result=loader();
  try{const json=JSON.stringify(result);if(json.length<90000)c.put(key,json,600);}catch(e){}
  return result;
}
function furnitureSeriesMetadataV610_(){
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(SHEETS.FURNITURE_SERIES);
  const series=[];
  if(sh&&sh.getLastRow()>1){
    const hm=headerMapFast_(sh),rows=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
    rows.forEach(r=>{const id=String(r[hm['系列ID']-1]||'').trim();if(id&&enabledFurnitureV610_(r[hm['是否啟用']-1]))series.push({seriesId:id,name:String(r[hm['系列名稱']-1]||id),previewImage:furnitureImagePathV610_(r[hm['預覽圖片']-1]),itemCount:0,sort:Number(r[hm['排序']-1]||0)});});
  }
  // Home reads only identifiers and visibility, never furniture image/metadata columns.
  const cfg=ss.getSheetByName(SHEETS.FURNITURE),hm=cfg?headerMapFast_(cfg):{};
  const ids=furnitureColumnV610_(cfg,hm,'家具ID'),groups=furnitureColumnV610_(cfg,hm,'系列ID'),open=furnitureColumnV610_(cfg,hm,'是否開放');
  const counts=Object.create(null);ids.forEach((id,i)=>{if(id&&enabledFurnitureV610_(open[i])){const group=String(groups[i]||LEGACY_FURNITURE_SERIES_V610).trim();counts[group]=(counts[group]||0)+1;}});
  if(counts[LEGACY_FURNITURE_SERIES_V610]&&!series.some(x=>x.seriesId===LEGACY_FURNITURE_SERIES_V610)&&!sh)series.push({seriesId:LEGACY_FURNITURE_SERIES_V610,name:'既有裝飾',previewImage:'',itemCount:0,sort:999});
  return series.map(s=>({...s,itemCount:counts[s.seriesId]||0})).sort((a,b)=>a.sort-b.sort||a.seriesId.localeCompare(b.seriesId));
}
function getFurnitureSeriesV610(forceRefresh){
  if(forceRefresh===true)clearFurnitureCacheV610_();
  return furnitureCacheV610_('FURN_HOME_V610:'+furnitureRevisionV610_(),()=>({ok:true,series:furnitureSeriesMetadataV610_()}),forceRefresh===true);
}
function getFurnitureBySeriesV610(seriesId,forceRefresh){
  const id=String(seriesId||'').trim();if(!id||id.length>80)throw new Error('請指定家具系列');
  return furnitureCacheV610_('FURN_GROUP_V610:'+furnitureRevisionV610_()+':'+encodeURIComponent(id),()=>{
    const series=getFurnitureSeriesV610().series.find(s=>s.seriesId===id);if(!series)throw new Error('系列不存在或未啟用');
    const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.FURNITURE),items=[];
    if(!sh)return {ok:true,series,items};
    const hm=headerMapFast_(sh),groups=furnitureColumnV610_(sh,hm,'系列ID');
    // Read matching contiguous row ranges only, not other series' image metadata.
    for(let i=0;i<groups.length;){
      if(String(groups[i]||LEGACY_FURNITURE_SERIES_V610).trim()!==id){i++;continue;}
      const start=i++;while(i<groups.length&&String(groups[i]||LEGACY_FURNITURE_SERIES_V610).trim()===id)i++;
      sh.getRange(start+2,1,i-start,sh.getLastColumn()).getValues().forEach(r=>{
        const furnitureId=String(r[hm['家具ID']-1]||'');if(!furnitureId||!enabledFurnitureV610_(r[hm['是否開放']-1]))return;
        items.push({furnitureId,seriesId:id,name:String(r[hm['名稱']-1]||furnitureId),type:String(r[hm['類型']-1]||'地面型'),thumbnail:furnitureImagePathV610_(r[hm['縮圖路徑']-1]),image:furnitureImagePathV610_(r[hm['圖片']-1]),price:Number(r[hm['價格']-1]||0),sort:Number(r[hm['排序']-1]||0)});
      });
    }
    return {ok:true,series,items:items.sort((a,b)=>a.sort-b.sort||a.furnitureId.localeCompare(b.furnitureId))};
  },forceRefresh===true);
}
function setupOrUpgradeV610Phase3(){
  // Existing V6 setup already handles partially completed stone creation safely.
  setupOrUpgradeV600();
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const series=ensureSheet_(SHEETS.FURNITURE_SERIES,['系列ID','系列名稱','預覽圖片','排序','是否啟用']);
    const furniture=ensureSheet_(SHEETS.FURNITURE,['家具ID','名稱','價格','圖片','類型','是否開放','系列ID','縮圖路徑','排序']);
    const hm=headerMapFast_(furniture),groups=furnitureColumnV610_(furniture,hm,'系列ID'),ids=furnitureColumnV610_(furniture,hm,'家具ID');
    const known=new Set(furnitureColumnV610_(series,headerMapFast_(series),'系列ID').map(String));
    const needed=new Set(ids.map((id,i)=>id?String(groups[i]||LEGACY_FURNITURE_SERIES_V610).trim():'').filter(Boolean));
    needed.forEach(id=>{if(!known.has(id))appendObject_(series,{'系列ID':id,'系列名稱':id===LEGACY_FURNITURE_SERIES_V610?'既有裝飾':id,'預覽圖片':'','排序':999,'是否啟用':true});});
    const types=Array.from(new Set(['地面型','浮空型',...furnitureColumnV610_(furniture,hm,'類型').map(String).filter(Boolean)]));
    if(furniture.getMaxRows()>1)furniture.getRange(2,hm['類型'],furniture.getMaxRows()-1,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(types,true).setAllowInvalid(false).build());
    const items=SpreadsheetApp.getActive().getSheetByName(SHEETS.ITEM_CONFIG),ih=headerMapFast_(items),stones=new Set(ATTRIBUTE_STONES_V600.map(s=>s.itemId));
    furnitureColumnV610_(items,ih,'道具ID').forEach((id,i)=>{if(stones.has(String(id))&&String(items.getRange(i+2,ih['圖片']).getValue())!==STONE_SPRITE_PATH_V610)items.getRange(i+2,ih['圖片']).setValue(STONE_SPRITE_PATH_V610);});
    clearAllGameConfigCacheV598_();
    return {ok:true,message:'石頭共用 sprite 與家具系列結構已補齊；既有學生資料未變更'};
  }finally{lock.releaseLock();}
}
function doGet(e) { return apiJson_({apiOk:true,message:'PetHouse API V5.9.8 is alive'}); }

function getAppVersion(){ return APP_VERSION; }

/** 第一次或升級到 V4：不刪舊資料，只補工作表/欄位 */
function setupOrUpgradeV4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);

  ensureSheet_ (SHEETS.STUDENTS, ['學號','姓名','生日','金幣','是否啟用','建立時間','座號','最後整點禮物']);
  ensureSheet_ (SHEETS.PETS, ['學號','寵物ID','暱稱','等級','EXP','階段','土地ID','X','Y','是否目前顯示']);
  ensureSheet_ (SHEETS.PET_CONFIG, ['寵物ID','名稱','第一階圖片','第二階圖片','第三階圖片','第二階需求等級','第三階需求等級','取得價格','是否開放','對話1','對話2','對話3','移動類型']);
  ensureSheet_ (SHEETS.LANDS, ['土地ID','名稱','價格','背景圖片','寬度','高度','是否開放','取得方式','兌換道具ID','兌換數量']);
  ensureSheet_ (SHEETS.STUDENT_LANDS, ['學號','土地ID','是否擁有','購買時間','是否使用']);
  ensureSheet_ (SHEETS.FURNITURE, ['家具ID','名稱','價格','圖片','類型','是否開放']);
  ensureSheet_ (SHEETS.STUDENT_FURNITURE, ['學號','家具ID','數量','土地ID','X','Y','縮放','旋轉']);
  ensureSheet_ (SHEETS.REWARDS, ['時間','學號','姓名','金幣變動','EXP變動','原因']);
  ensureSheet_ (SHEETS.ITEM_CONFIG, ['道具ID','名稱','類型','效果值','圖片','說明','是否開放']);
  ensureSheet_ (SHEETS.STUDENT_ITEMS, ['學號','道具ID','數量']);
  ensureSheet_ (SHEETS.MAILBOX, ['信件ID','學號','時間','寄件者','標題','內容','附件類型','附件ID','附件數量','是否領取']);
  ensureSheet_ (SHEETS.QUESTIONS, ['題目ID','科目','單元','題型','題目','選項A','選項B','選項C','選項D','答案','解析','圖片ID','圖片路徑','是否啟用']);
  ensureSheet_ (SHEETS.CHALLENGES, ['週期','學號','科目','寵物ID','答對數','錯誤數','總EXP','最後題目ID','最後更新']);

  seedV4Defaults_();
  backfillSeatNumbers_();
  return 'V4 升級完成';
}

function ensureSheet_(name, headers){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if(!sh) sh = ss.insertSheet(name);
  if(sh.getLastRow() === 0){
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    const lastCol = Math.max(sh.getLastColumn(),1);
    const current = sh.getRange(1,1,1,lastCol).getValues()[0].map(String);
    headers.forEach(h=>{
      if(!current.includes(h)){
        sh.getRange(1, sh.getLastColumn()+1).setValue(h);
        current.push(h);
      }
    });
  }
  sh.setFrozenRows(1);
  return sh;
}

function seedV4Defaults_(){
  const ss = SpreadsheetApp.getActive();

  // 寵物：補移動類型，既有寵物預設地面型
  const petCfg = ss.getSheetByName(SHEETS.PET_CONFIG);
  const petCfgRows = readObjects_(petCfg);
  const existingIds = new Set(petCfgRows.map(x=>String(x['寵物ID'])));
  VALID_SEATS.forEach(n=>{
    const id = formatPetId_(n);
    if(!existingIds.has(id)){
      appendObject_(petCfg, {
        '寵物ID':id, '名稱':'寵物'+n,
        '第二階需求等級':10,'第三階需求等級':25,'取得價格':0,'是否開放':true,
        '對話1':'今天也一起努力吧！','對話2':'我很喜歡這個家～','對話3':'謝謝你陪我一起長大！',
        '移動類型':'地面型'
      });
    }
  });
  const hPet = headerMap_(petCfg);
  if(hPet['移動類型']){
    for(let r=2;r<=petCfg.getLastRow();r++){
      if(!petCfg.getRange(r,hPet['移動類型']).getValue()) petCfg.getRange(r,hPet['移動類型']).setValue('地面型');
    }
  }

  // 基本土地
  const landSh = ss.getSheetByName(SHEETS.LANDS);
  const lands = readObjects_(landSh);
  const landIds = new Set(lands.map(x=>String(x['土地ID'])));
  [
    ['LAND001','草地',0],['LAND002','森林',500],['LAND003','海灘',800],['LAND004','雪地',1000]
  ].forEach(([id,name,price])=>{
    if(!landIds.has(id)) appendObject_(landSh, {'土地ID':id,'名稱':name,'價格':price,'寬度':900,'高度':560,'是否開放':true});
  });

  // 基本道具
  const itemSh = ss.getSheetByName(SHEETS.ITEM_CONFIG);
  const items = readObjects_(itemSh);
  const itemIds = new Set(items.map(x=>String(x['道具ID'])));
  const itemDefs = [
    {id:'EXP010',name:'小經驗糖果',type:'經驗型',value:10,desc:'使用後，指定寵物獲得 10 EXP。'},
    {id:'EXP030',name:'中經驗糖果',type:'經驗型',value:30,desc:'使用後，指定寵物獲得 30 EXP。'},
    {id:'EXP050',name:'大經驗糖果',type:'經驗型',value:50,desc:'使用後，指定寵物獲得 50 EXP。'},
    {id:'TRE001',name:'閃亮星石',type:'寶物型',value:0,desc:'寵物偶爾帶回的收藏寶物。'},
    {id:'TRE002',name:'神秘貝殼',type:'寶物型',value:0,desc:'可以收藏的神秘寶物。'}
  ];
  itemDefs.forEach(x=>{ if(!itemIds.has(x.id)) appendObject_(itemSh, {'道具ID':x.id,'名稱':x.name,'類型':x.type,'效果值':x.value,'說明':x.desc,'是否開放':true}); });

  // 範例題庫（可自行刪除/增加）
  const qSh = ss.getSheetByName(SHEETS.QUESTIONS);
  if(qSh.getLastRow() <= 1){
    const qs = [
      ['Q-C-001','國語','選擇題','「聚精會神」最接近下列哪一個意思？','非常專心','非常生氣','非常疲累','非常快速','A','聚精會神表示集中精神。'],
      ['Q-C-002','國語','是非題','「一心一意」可以用來形容做事很專心。','是','否','','','A','一心一意可形容專心一致。'],
      ['Q-M-001','數學','選擇題','24 的因數中，下列哪一個不是？','3','6','8','10','D','10 不能整除 24。'],
      ['Q-M-002','數學','填充題','7 × 8 = ？','','','','','56','7×8=56。'],
      ['Q-E-001','英文','選擇題','apple 的中文意思是？','蘋果','香蕉','橘子','葡萄','A','apple = 蘋果。'],
      ['Q-E-002','英文','選擇題','「我是一位學生」較合適的英文是？','I am a student.','I is a student.','I are student.','Me student.','A','I am a student.'],
      ['Q-N-001','自然','選擇題','植物進行光合作用主要需要哪一項？','陽光','塑膠','玻璃','鐵','A','光合作用需要光。'],
      ['Q-N-002','自然','是非題','水在 0°C 附近可能結冰。','是','否','','','A','一般情況下水約在 0°C 結冰。'],
      ['Q-S-001','社會','選擇題','下列哪一項屬於公共設施？','公園','私人臥室','個人書桌','私人衣櫃','A','公園屬公共設施。'],
      ['Q-S-002','社會','是非題','遵守交通規則有助於維護公共安全。','是','否','','','A','遵守規則可提升安全。']
    ];
    qs.forEach(q=>qSh.appendRow([...q,true]));
  }
}

/** 把 G 欄座號補上；例如 50501 → 1 */
function backfillSeatNumbers_(){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENTS);
  const hm = headerMap_(sh);
  const vals = sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    const id = String(vals[i][hm['學號']-1]||'').trim();
    const seatCell = sh.getRange(i+1,hm['座號']);
    if(!seatCell.getValue()){
      const seat = inferSeat_(id);
      if(seat) seatCell.setValue(seat);
    }
  }
}

function login(studentId,birthday){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENTS);
  const hm = headerMap_(sh);
  const vals = sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    const id = String(vals[i][hm['學號']-1]||'').trim();
    if(id === String(studentId).trim() && normalizeDate_(vals[i][hm['生日']-1]) === normalizeDate_(birthday) && vals[i][hm['是否啟用']-1] !== false){
      ensureStarterData_(id);
      generateHourlyGifts_(id);
      return {ok:true,name:vals[i][hm['姓名']-1],version:APP_VERSION};
    }
  }
  return {ok:false,message:'學號或生日不正確'};
}

/**
 * V5.1：登入 + 首頁常用資料一次回傳。
 * 只付一次 Apps Script 網路延遲，進站後信箱/背包/商店都可直接開。
 */
function loginBootstrap(studentId,birthday){
  const auth=login(studentId,birthday);
  if(!auth || !auth.ok) return auth;
  const s=getStudentState(studentId);
  return {ok:true,name:auth.name,version:APP_VERSION,state:s};
}

/**
 * V5.3 快速登入：
 * 只驗證登入並取得首頁必要資料。
 * 不在登入階段讀信箱、背包、商店、挑戰紀錄，也不補整點禮物。
 */
function loginCore(studentId,birthday){
  const auth=login(studentId,birthday);
  if(!auth || !auth.ok) return auth;
  return {ok:true,name:auth.name,version:APP_VERSION,state:getStudentCoreState_(studentId)};
}

function getStudentCoreState_(studentId){
  const id=String(studentId||'').trim();
  ensureStarterData_(id);

  const ss=SpreadsheetApp.getActive();
  const student=getStudent_(id);
  if(!student)return {ok:false,message:'找不到學生'};

  const petCfg=cachedObjects_(SHEETS.PET_CONFIG,300);
  const cfgMap={}; petCfg.forEach(x=>cfgMap[String(x['寵物ID'])]=x);
  const petRows=readObjects_(ss.getSheetByName(SHEETS.PETS))
    .filter(x=>String(x['學號']).trim()===id);
  const pets=petRows.map(p=>decoratePet_(p,cfgMap[String(p['寵物ID'])]||{}));

  const landCfg=cachedObjects_(SHEETS.LANDS,300);
  const landMap={}; landCfg.forEach(x=>landMap[String(x['土地ID'])]=x);
  const studentLands=readObjects_(ss.getSheetByName(SHEETS.STUDENT_LANDS))
    .filter(x=>String(x['學號']).trim()===id && x['是否擁有']!==false);
  const active=studentLands.find(x=>x['是否使用']===true || String(x['是否使用']).toUpperCase()==='TRUE') || studentLands[0];
  const activeLandId=active?String(active['土地ID']):'LAND001';
  const lands=studentLands.map(x=>({...x,config:landMap[String(x['土地ID'])]||{}}));

  const furnCfg=cachedObjects_(SHEETS.FURNITURE,300);
  const fMap={}; furnCfg.forEach(x=>fMap[String(x['家具ID'])]=x);
  const furniture=readObjects_(ss.getSheetByName(SHEETS.STUDENT_FURNITURE))
    .filter(x=>String(x['學號']).trim()===id && String(x['土地ID']||'LAND001')===activeLandId)
    .map(x=>({...x,config:fMap[String(x['家具ID'])]||{}}));

  return safeForClient_({
    ok:true,version:APP_VERSION,student,pets,lands,activeLandId,furniture,
    unreadMail:0
  });
}



/** V4.5 效能快取：不常變動的設定資料只每 5 分鐘讀一次試算表 */
function cachedObjects_(sheetName, ttlSec){
  ttlSec = Number(ttlSec || 300);
  const cache = CacheService.getScriptCache();
  const key = 'CFG_' + sheetName;
  const hit = cache.get(key);
  if(hit){
    try{return JSON.parse(hit);}catch(e){}
  }
  const rows = safeForClient_(readObjects_(SpreadsheetApp.getActive().getSheetByName(sheetName)));
  try{ cache.put(key, JSON.stringify(rows), ttlSec); }catch(e){}
  return rows;
}
function clearGameConfigCache(){
  const c=CacheService.getScriptCache();
  [SHEETS.PET_CONFIG,SHEETS.LANDS,SHEETS.FURNITURE,SHEETS.ITEM_CONFIG,SHEETS.QUESTIONS].forEach(n=>c.remove('CFG_'+n));
  ['FAST_BG_CATALOG','FAST_MONSTER_CATALOG'].forEach(k=>c.remove(k));
  ['QUESTION_DISPLAY_V5106_STABILITY','QUESTION_BANK_V5106_DISPLAY'].forEach(k=>c.remove(k));
  ['國語','數學','英文','自然','社會'].forEach(s=>c.remove('QUESTION_SUBJECT_V5106_DISPLAY:'+s));
  return true;
}
function cachedMap_(sheetName,keyCol,ttlSec){
  const o={}; cachedObjects_(sheetName,ttlSec).forEach(x=>o[String(x[keyCol])]=x); return o;
}

function getStudentState(studentId){
  const id = String(studentId||'').trim();
  ensureStarterData_(id);
  generateHourlyGifts_(id);
  const ss = SpreadsheetApp.getActive();
  const student = getStudent_(id);
  if(!student) return {ok:false,message:'找不到學生'};

  const petCfg = cachedObjects_(SHEETS.PET_CONFIG,300);
  const cfgMap = {}; petCfg.forEach(x=>cfgMap[String(x['寵物ID'])]=x);
  const petRows = readObjects_(ss.getSheetByName(SHEETS.PETS)).filter(x=>String(x['學號']).trim()===id);
  const pets = petRows.map(p=>decoratePet_(p,cfgMap[String(p['寵物ID'])]||{}));

  const landCfg = cachedObjects_(SHEETS.LANDS,300);
  const landMap={}; landCfg.forEach(x=>landMap[String(x['土地ID'])]=x);
  let studentLands = readObjects_(ss.getSheetByName(SHEETS.STUDENT_LANDS)).filter(x=>String(x['學號']).trim()===id && x['是否擁有']!==false);
  let active = studentLands.find(x=>x['是否使用']===true || String(x['是否使用']).toUpperCase()==='TRUE') || studentLands[0];
  const activeLandId = active ? String(active['土地ID']) : 'LAND001';
  const lands = studentLands.map(x=>({...x,config:landMap[String(x['土地ID'])]||{}}));

  const furnCfg = cachedObjects_(SHEETS.FURNITURE,300);
  const fMap={}; furnCfg.forEach(x=>fMap[String(x['家具ID'])]=x);
  const furniture = readObjects_(ss.getSheetByName(SHEETS.STUDENT_FURNITURE))
    .filter(x=>String(x['學號']).trim()===id && String(x['土地ID']||'LAND001')===activeLandId)
    .map(x=>({...x,config:fMap[String(x['家具ID'])]||{}}));

  // V5.1：登入時一次載入常用分頁資料，避免之後點信箱/背包/商店又等待 2~3 秒。
  const mailbox = getMailbox(id);
  const inventory = getInventory(id);
  const shop = getShop();
  const unreadMail = mailbox.filter(x=>!(x['是否領取']===true || String(x['是否領取']).toUpperCase()==='TRUE')).length;

  return safeForClient_({
    ok:true,version:APP_VERSION,student,pets,lands,activeLandId,furniture,
    unreadMail,
    mailbox,
    inventory,
    shop,
    challengeStatus:getAllChallengeStatus_(id)
  });
}

function ensureStarterData_(studentId){
  const ss = SpreadsheetApp.getActive();
  const id = String(studentId||'').trim();
  if(!id) return;
  const student = findStudentRow_(id);
  if(!student) return;

  // 初始土地
  const sl = ss.getSheetByName(SHEETS.STUDENT_LANDS);
  const owned = readObjects_(sl).filter(x=>String(x['學號']).trim()===id);
  if(!owned.some(x=>String(x['土地ID'])==='LAND001')) appendObject_(sl,{'學號':id,'土地ID':'LAND001','是否擁有':true,'購買時間':new Date(),'是否使用':true});
  if(owned.length && !owned.some(x=>x['是否使用']===true || String(x['是否使用']).toUpperCase()==='TRUE')) setActiveLand_(id,'LAND001');

  // 初始座號寵物
  let seat = Number(student.obj['座號']);
  if(!VALID_SEATS.includes(seat)) seat = inferSeat_(id);
  if(seat){
    if(!student.obj['座號']) student.sheet.getRange(student.row,student.hm['座號']).setValue(seat);
    const petId = formatPetId_(seat);
    const ps = ss.getSheetByName(SHEETS.PETS);
    const has = readObjects_(ps).some(x=>String(x['學號']).trim()===id && String(x['寵物ID'])===petId);
    if(!has) appendObject_(ps,{'學號':id,'寵物ID':petId,'等級':1,'EXP':0,'階段':1,'土地ID':'LAND001','X':45,'Y':70,'是否目前顯示':true});
  }
}

function getStudent_(id){
  const f=findStudentRow_(id); if(!f) return null;
  return {id:f.obj['學號'],name:f.obj['姓名'],coins:Number(f.obj['金幣']||0),seat:Number(f.obj['座號']||0)};
}

function decoratePet_(p,cfg){
  const level=Number(p['等級']||1), exp=Number(p['EXP']||0);
  const l2=Number(cfg['第二階需求等級']||10), l3=Number(cfg['第三階需求等級']||25);
  const stage=level>=l3?3:(level>=l2?2:1);
  const image=stage===3?cfg['第三階圖片']:(stage===2?cfg['第二階圖片']:cfg['第一階圖片']);
  return {
    petId:String(p['寵物ID']),name:cfg['名稱']||p['寵物ID'],nickname:p['暱稱']||'',level,exp,expNeed:level>=30?0:expNeeded_(level),stage,
    landId:String(p['土地ID']||'LAND001'),x:Number(p['X']||45),y:Number(p['Y']||70),image:image||'',
    movementType:String(cfg['移動類型']||'地面型'),
    attribute:String(cfg['屬性']||'光'),
    dialogs:[cfg['對話1']||'今天也一起努力吧！',cfg['對話2']||'我喜歡這裡～',cfg['對話3']||'一起變強吧！']
  };
}

function expNeeded_(level){ return 20 + (Number(level)-1)*5; }

function addPetExp_(studentId,petId,amount){
  assertNoPendingChallengeBatchV600_(String(studentId).trim(),String(petId));
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]).trim()===String(studentId).trim() && String(vals[i][hm['寵物ID']-1])===String(petId)){
      let lv=Number(vals[i][hm['等級']-1]||1), exp=Number(vals[i][hm['EXP']-1]||0)+Number(amount||0);
      // 保留既有超過上限的資料，不降級或重設；新的 EXP 最多升至 30 級。
      if(lv>=30)return {level:lv,exp:Number(vals[i][hm['EXP']-1]||0),expNeed:0};
      while(lv<30 && exp>=expNeeded_(lv)){ exp-=expNeeded_(lv); lv++; }
      if(lv>=30)exp=0;
      if(exp<0) exp=0;
      sh.getRange(i+1,hm['等級']).setValue(lv);
      sh.getRange(i+1,hm['EXP']).setValue(exp);
      return {level:lv,exp,expNeed:lv>=30?0:expNeeded_(lv)};
    }
  }
  throw new Error('找不到寵物');
}

/** 背包 */
function getInventory(studentId){
  const ss=SpreadsheetApp.getActive(), id=String(studentId).trim();
  const cfg=cachedObjects_(SHEETS.ITEM_CONFIG,300); const map={}; cfg.forEach(x=>map[String(x['道具ID'])]=x);
  return readObjects_(ss.getSheetByName(SHEETS.STUDENT_ITEMS)).filter(x=>String(x['學號']).trim()===id && Number(x['數量']||0)>0)
    .map(x=>({itemId:String(x['道具ID']),quantity:Number(x['數量']||0),config:map[String(x['道具ID'])]||{}}));
}

function grantItem(studentId,itemId,quantity,reason){
  if(attributeStoneV600_(itemId)){grantAttributeStonesV600_([studentId],itemId,quantity,reason);return true;}
  return assetWriteLockV610_(()=>{
  quantity=Math.max(1,Number(quantity||1));
  assertNoPendingStoneMailV600_(String(studentId).trim(),String(itemId));
  addItem_LockedMailV600_(String(studentId).trim(),String(itemId),quantity);
  const s=getStudent_(studentId);
  SpreadsheetApp.getActive().getSheetByName(SHEETS.REWARDS).appendRow([new Date(),studentId,s?s.name:'',0,0,(reason||'老師發放')+'：'+itemId+' ×'+quantity]);
  return true;
  });
}

function addItem_(studentId,itemId,qty){
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
  assertNoPendingStoneMailV600_(String(studentId).trim(),String(itemId));
    return addItem_LockedMailV600_(studentId,itemId,qty);
  }finally{lock.releaseLock();}
}
function addItem_LockedMailV600_(studentId,itemId,qty){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_ITEMS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]).trim()===studentId && String(vals[i][hm['道具ID']-1])===itemId){
      sh.getRange(i+1,hm['數量']).setValue(Number(vals[i][hm['數量']-1]||0)+qty); return;
    }
  }
  appendObject_(sh,{'學號':studentId,'道具ID':itemId,'數量':qty});
}

function useExpItem(studentId,itemId,petId,quantity){
  // 共用既有批量升級流程，保持 API 相容，統一鎖、階段、圖片與滿級規則。
  return useExpItemsBatchV599(studentId,petId,[{itemId:itemId,quantity:quantity}]);
}

/** 信箱與整點禮物 */
function generateHourlyGifts_(studentId){ return generateHourlyGiftsFast_(studentId); }

function randomGift_(){
  const r=Math.random();
  if(r<0.60) return {itemId:'EXP010',qty:1};
  if(r<0.82) return {itemId:'EXP030',qty:1};
  if(r<0.94) return {itemId:'TRE001',qty:1};
  return {itemId:'TRE002',qty:1};
}

function createMail_(studentId,sender,title,content,attachType,attachId,qty,time){
  const id='MAIL-'+Utilities.getUuid();
  appendObject_(SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX),{
    '信件ID':id,'學號':studentId,'時間':time||new Date(),'寄件者':sender,'標題':title,'內容':content,
    '附件類型':attachType||'','附件ID':attachId||'','附件數量':Number(qty||0),'是否領取':false
  });
  return id;
}

function getMailbox(studentId){ return getMailboxFast_(studentId); }

/** 背景更新用：先補整點禮物，再回傳信箱。 */
function getMailboxFresh(studentId){
  const id=String(studentId||'').trim();
  generateHourlyGiftsFast_(id);
  const mailbox=getMailboxFast_(id);
  return {mailbox:mailbox,unreadMail:getUnreadMailCountFast_(id)};
}

/**
 * V5.1 快速領取：
 * 只回傳必要資料，不再為了領一封信重讀整個信箱。
 */
function claimMailFast(studentId,mailId){
  const id=String(studentId).trim(),lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX);
    const rows=readRowsWithPositionV600_(sh);
    const mail=rows.find(r=>String(r['信件ID'])===String(mailId) && String(r['學號']).trim()===id);
    if(!mail)throw new Error('找不到信件');
    claimMailLockedV600_(id,sh,mail,rows);
  }finally{lock.releaseLock();}
  return {ok:true,inventory:getInventory(id),unreadMail:getUnreadMailCount_(id)};
}

// 保留舊 API；同樣使用信件 ID 去重與可恢復的領取交易。
function claimMail(studentId,mailId){return claimMailFast(studentId,mailId);}
function mailClaimedV600_(mail){return mail['是否領取']===true || String(mail['是否領取']).toUpperCase()==='TRUE';}
function assertNoPendingStoneMailV600_(studentId,itemId,exceptMailId,rows){
  assertNoPendingAdminGrantV610_(studentId,'ITEMS',itemId);
  const mails=rows||readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX));
  const pending=mails.some(m=>{
    if(String(m['學號']).trim()!==studentId||String(m['附件ID'])!==itemId||String(m['信件ID'])===String(exceptMailId||'')||mailClaimedV600_(m)||!m['領取交易'])return false;
    try{
      const t=JSON.parse(String(m['領取交易']));
      if(t.version===2&&t.status==='COMMITTED'&&t.transactionId===mailTransactionIdV600_(studentId,m['信件ID'])&&t.itemId===itemId&&t.quantity===Number(m['附件數量']))return false;
    }catch(e){}
    return true;
  });
  if(pending)throw new Error('請先確認上一封尚未完成的領取交易；確認前不能變更同一道具數量');
}
/** 永久 ID 綁定學號＋信件 ID，不隨前端重送或庫存消耗改變。 */
function mailTransactionIdV600_(studentId,mailId){return 'MAIL_V600:'+JSON.stringify([String(studentId),String(mailId)]);}
function requireMailSheetsServiceV600_(){
  if(typeof Sheets==='undefined'||!Sheets.Spreadsheets)throw new Error('請老師先啟用 Apps Script 的 Google Sheets API 服務');
}
// 編輯器可執行的唯讀部署檢查，不新增前端 API。
function checkMailTransactionServiceV600(){
  requireMailSheetsServiceV600_();
  Sheets.Spreadsheets.get(SpreadsheetApp.getActive().getId(),{fields:'spreadsheetId'});
  return 'Google Sheets API 可用；信箱領取將以原子交易提交';
}
function mailCellRequestV600_(sh,row,col,value){
  const userEnteredValue=typeof value==='boolean'?{boolValue:value}:typeof value==='number'?{numberValue:value}:{stringValue:String(value)};
  return {updateCells:{start:{sheetId:sh.getSheetId(),rowIndex:row-1,columnIndex:col-1},rows:[{values:[{userEnteredValue}]}],fields:'userEnteredValue'}};
}
function claimMailLockedV600_(id,sh,mail,mails,batch){return claimMailsLockedV600_(id,sh,[mail],mails,batch);}
/** 呼叫端已持有同一把 ScriptLock；單封／全部共用一個原子提交核心。 */
function claimMailsLockedV600_(id,sh,targets,mails,batch){
  const ss=SpreadsheetApp.getActive(),mh=headerMap_(sh),plans=[],requests=[];
  const items=ss.getSheetByName(SHEETS.STUDENT_ITEMS),ih=headerMap_(items);
  let itemRows=batch?.itemRows||null;
  let nextItemRow=items.getLastRow()+1;
  const mailIdCounts=new Map();mails.forEach(m=>{if(String(m['學號']).trim()===id){const key=String(m['信件ID']);mailIdCounts.set(key,(mailIdCounts.get(key)||0)+1);}});
  for(const mail of targets){
    if(mailClaimedV600_(mail))continue;
    if(!mh['領取交易'])throw new Error('請先執行 setupOrUpgradeV600() 新增信箱領取交易欄位');
    const iid=String(mail['附件ID']||''),qty=Number(mail['附件數量']||0),mailId=String(mail['信件ID']||'');
    if(!mailId||String(mail['學號']).trim()!==id)throw new Error('信件身分無效');
    if(mailIdCounts.get(mailId)!==1)throw new Error('信件 ID 重複，請老師核對；系統不會重複發放');
    const transactionId=mailTransactionIdV600_(id,mailId);
    let existing=null;
    if(mail['領取交易']){
      try{existing=JSON.parse(String(mail['領取交易']));}catch(e){throw new Error('領取交易資料無效，請老師核對');}
      // 舊版只記錄 before/after，不能證明曾否入帳。保留原資料，禁止猜測或自動重發。
      if(existing?.version!==2)throw new Error('舊版未完成領取交易，請老師核對入帳紀錄；系統不會自動重發');
      if(existing.transactionId!==transactionId||existing.itemId!==iid||existing.quantity!==qty)throw new Error('信件交易身分已變動，請老師核對');
      if(existing.status==='COMMITTED'){
        requests.push(mailCellRequestV600_(sh,mail._row,mh['是否領取'],true));
        plans.push({mail,committed:existing});continue;
      }
      // 上一次請求可能仍在伺服器完成中。不得重送入帳，也不得從目前數量猜測結果。
      throw new Error('領取交易尚未確認，請稍後重試；若持續未完成，請老師核對。獎勵不會重複發放');
    }
    const submitted={version:2,transactionId,itemId:iid,quantity:qty,status:'SUBMITTED'};
    if(String(mail['附件類型'])==='道具' && iid && qty>0){
      if(!Number.isSafeInteger(qty))throw new Error('信件附件數量無效');
      assertNoPendingStoneMailV600_(id,iid,mailId,mails);
      if(attributeStoneV600_(iid)){
        const log=ss.getSheetByName(SHEETS.SKILL_ENHANCEMENTS);
        if((batch?.skillOperations||readObjects_(log)).some(r=>String(r['學號']).trim()===id && r['狀態']==='PENDING'))throw new Error('請先重試上一筆尚未完成的強化');
      }
      if(!itemRows)itemRows=readRowsWithPositionV600_(items);
      let row=itemRows.find(r=>String(r['學號']).trim()===id && String(r['道具ID'])===iid);
      const quantityBefore=Number(row?.['數量']||0),quantityAfter=quantityBefore+qty;
      if(!Number.isSafeInteger(quantityBefore)||quantityBefore<0||!Number.isSafeInteger(quantityAfter))throw new Error('道具數量無效或超出儲存範圍');
      // 庫存僅用於計算加總，永遠不用來判斷交易有沒有入帳。
      if(!row){
        row={'學號':id,'道具ID':iid,'數量':0,_row:nextItemRow++};itemRows.push(row);
        requests.push(mailCellRequestV600_(items,row._row,ih['學號'],id),mailCellRequestV600_(items,row._row,ih['道具ID'],iid));
      }
      requests.push(mailCellRequestV600_(items,row._row,ih['數量'],quantityAfter));row['數量']=quantityAfter;
    }
    const committed={...submitted,status:'COMMITTED'};
    requests.push(mailCellRequestV600_(sh,mail._row,mh['領取交易'],JSON.stringify(committed)),mailCellRequestV600_(sh,mail._row,mh['是否領取'],true));
    plans.push({mail,submitted,committed});
  }
  if(!plans.length)return;
  requireMailSheetsServiceV600_();
  if(nextItemRow-1>items.getMaxRows())requests.unshift({appendDimension:{sheetId:items.getSheetId(),dimension:'ROWS',length:nextItemRow-1-items.getMaxRows()}});
  // 先永久記錄已送出。若被 Apps Script timeout 中斷，下一次絕不盲目重送這筆入帳。
  plans.forEach(p=>{if(p.submitted)sh.getRange(p.mail._row,mh['領取交易']).setValue(JSON.stringify(p.submitted));});
  SpreadsheetApp.flush();
  // Google Sheets 保證同一 batch 的所有子請求原子套用：數量、COMMITTED、已領取一起成功或一起失敗。
  Sheets.Spreadsheets.batchUpdate({requests},ss.getId());
  plans.forEach(p=>{p.mail['領取交易']=JSON.stringify(p.committed);p.mail['是否領取']=true;});
}

function getUnreadMailCount_(studentId){ return getUnreadMailCountFast_(studentId); }

/** 挑戰 */
function getAllChallengeStatus_(studentId){
  const subjects=['國語','數學','英文','自然','社會'];
  const period=challengePeriodKey_(new Date());
  const rows=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.CHALLENGES));
  const out={};
  subjects.forEach(s=>{
    const r=rows.find(x=>String(x['週期'])===period && String(x['學號']).trim()===String(studentId).trim() && String(x['科目'])===s);
    out[s]=r?{correct:Number(r['答對數']||0),wrong:Number(r['錯誤數']||0),exp:Number(r['總EXP']||0),locked:Number(r['錯誤數']||0)>=3}:{correct:0,wrong:0,exp:0,locked:false};
  });
  return out;
}

function startChallenge(studentId,subject,petId){
  const id=String(studentId).trim();
  validatePetOwnership_(id,petId);
  const rec=getOrCreateChallenge_(id,subject,petId);
  if(Number(rec.obj['錯誤數']||0)>=3) return {ok:false,locked:true,resetAt:nextResetText_(),status:challengeStatusFromObj_(rec.obj)};
  const q=getRandomQuestion_(subject,rec.obj['最後題目ID']);
  if(!q) throw new Error('這個科目目前沒有啟用中的題目');
  rec.sheet.getRange(rec.row,rec.hm['最後題目ID']).setValue(q.id);
  rec.sheet.getRange(rec.row,rec.hm['最後更新']).setValue(new Date());
  return {ok:true,question:q,status:challengeStatusFromObj_(rec.obj),resetAt:nextResetText_()};
}

function answerChallenge(studentId,subject,petId,questionId,answer){
  const id=String(studentId).trim(); validatePetOwnership_(id,petId);
  const rec=getOrCreateChallenge_(id,subject,petId);
  let wrong=Number(rec.sheet.getRange(rec.row,rec.hm['錯誤數']).getValue()||0);
  let correct=Number(rec.sheet.getRange(rec.row,rec.hm['答對數']).getValue()||0);
  let totalExp=Number(rec.sheet.getRange(rec.row,rec.hm['總EXP']).getValue()||0);
  if(wrong>=3) return {ok:false,locked:true,resetAt:nextResetText_(),status:{correct,wrong,exp:totalExp}};

  const qrow=subjectQuestionRowsV610_(subject).find(x=>String(x['題目ID'])===String(questionId));
  if(!qrow || String(qrow['科目'])!==String(subject)) throw new Error('題目無效');
  const expected=normalizeAnswer_(qrow['答案']);
  const actual=normalizeAnswer_(answer);
  const isCorrect=actual===expected;
  let gained=0;
  if(isCorrect){
    correct++;
    gained=challengeExpForCorrectCount_(correct);
    totalExp+=gained;
    addPetExp_(id,petId,gained);
  } else wrong++;

  rec.sheet.getRange(rec.row,rec.hm['答對數']).setValue(correct);
  rec.sheet.getRange(rec.row,rec.hm['錯誤數']).setValue(wrong);
  rec.sheet.getRange(rec.row,rec.hm['總EXP']).setValue(totalExp);
  rec.sheet.getRange(rec.row,rec.hm['寵物ID']).setValue(petId);
  rec.sheet.getRange(rec.row,rec.hm['最後更新']).setValue(new Date());

  const locked=wrong>=3;
  let next=null;
  if(!locked){
    next=getRandomQuestion_(subject,questionId);
    if(next) rec.sheet.getRange(rec.row,rec.hm['最後題目ID']).setValue(next.id);
  }
  return {ok:true,isCorrect,correctAnswer:qrow['答案'],explanation:qrow['解析']||'',gained,status:{correct,wrong,exp:totalExp,locked},locked,resetAt:nextResetText_(),question:next};
}

function challengeExpForCorrectCount_(n){
  if(n>=50) return 6;
  if(n>=40) return 5;
  if(n>=30) return 4;
  if(n>=20) return 3;
  if(n>=10) return 2;
  return 1;
}

function getOrCreateChallenge_(studentId,subject,petId){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.CHALLENGES), hm=headerMap_(sh), vals=sh.getDataRange().getValues(), period=challengePeriodKey_(new Date());
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['週期']-1])===period && String(vals[i][hm['學號']-1]).trim()===studentId && String(vals[i][hm['科目']-1])===String(subject)){
      return {sheet:sh,row:i+1,hm,obj:rowObject_(sh,vals[i])};
    }
  }
  appendObject_(sh,{'週期':period,'學號':studentId,'科目':subject,'寵物ID':petId,'答對數':0,'錯誤數':0,'總EXP':0,'最後更新':new Date()});
  const row=sh.getLastRow(); return {sheet:sh,row,hm:headerMap_(sh),obj:rowObject_(sh,sh.getRange(row,1,1,sh.getLastColumn()).getValues()[0])};
}

function resolveQuestionImage_(x){
  const fallback={
    'M001':'IMG001','M002':'IMG001',
    'M004':'IMG002','M005':'IMG002',
    'M009':'IMG003','M010':'IMG004',
    'M025':'IMG005','M029':'IMG006',
    'M032':'IMG007','M036':'IMG008'
  };
  let imageId=String(x['圖片ID']||'').trim();
  if(!imageId) imageId=fallback[String(x['題目ID']||'')]||'';
  let image=String(x['圖片路徑']||'').trim().replace(/\\/g,'/');
  if(!image && imageId) image='assets/math/'+imageId+'.png';
  return {imageId:imageId,image:image};
}

function getRandomQuestion_(subject,lastId){
  let q=subjectQuestionRowsV610_(subject).filter(questionEnabled_);
  if(!q.length) return null;
  if(q.length>1) q=q.filter(x=>String(x['題目ID'])!==String(lastId));
  const x=q[Math.floor(Math.random()*q.length)];
  const qi=resolveQuestionImage_(x); return {id:String(x['題目ID']),subject:String(x['科目']),unit:String(x['單元']||''),type:String(x['題型']||'選擇題'),text:String(x['題目']),options:[x['選項A'],x['選項B'],x['選項C'],x['選項D']].filter(v=>v!=='' && v!=null),imageId:qi.imageId,image:qi.image};
}

function challengePeriodKey_(d){
  const shifted=new Date(d.getTime()-7*3600000);
  return Utilities.formatDate(shifted,TZ,'yyyy-MM-dd');
}
function nextResetText_(){
  const now=new Date();
  let y=Number(Utilities.formatDate(now,TZ,'yyyy')),m=Number(Utilities.formatDate(now,TZ,'MM'))-1,day=Number(Utilities.formatDate(now,TZ,'dd')),h=Number(Utilities.formatDate(now,TZ,'HH'));
  const base=new Date(y,m,day,7,0,0);
  const next=h<7?base:new Date(base.getTime()+24*3600000);
  return Utilities.formatDate(next,TZ,'yyyy/MM/dd HH:mm');
}
function challengeStatusFromObj_(o){ return {correct:Number(o['答對數']||0),wrong:Number(o['錯誤數']||0),exp:Number(o['總EXP']||0),locked:Number(o['錯誤數']||0)>=3}; }
function normalizeAnswer_(v){ return String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,''); }

/** 地圖/移動 */
function setActiveLand(studentId,landId){
  const id=String(studentId).trim();
  const owned=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_LANDS)).some(x=>String(x['學號']).trim()===id && String(x['土地ID'])===String(landId) && x['是否擁有']!==false);
  if(!owned) throw new Error('尚未擁有這塊土地');
  setActiveLand_(id,landId); return getStudentState(id);
}
function setActiveLand_(studentId,landId){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_LANDS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++) if(String(vals[i][hm['學號']-1]).trim()===studentId) sh.getRange(i+1,hm['是否使用']).setValue(String(vals[i][hm['土地ID']-1])===String(landId));
}
function movePetToLand(studentId,petId,landId){
  const id=String(studentId).trim();
  const owned=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_LANDS)).some(x=>String(x['學號']).trim()===id && String(x['土地ID'])===String(landId) && x['是否擁有']!==false);
  if(!owned) throw new Error('尚未擁有這塊土地');
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++) if(String(vals[i][hm['學號']-1]).trim()===id && String(vals[i][hm['寵物ID']-1])===String(petId)){ sh.getRange(i+1,hm['土地ID']).setValue(landId); return true; }
  throw new Error('找不到寵物');
}
function savePetPosition(studentId,petId,landId,x,y){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++) if(String(vals[i][hm['學號']-1]).trim()===String(studentId).trim() && String(vals[i][hm['寵物ID']-1])===String(petId)){
    sh.getRange(i+1,hm['土地ID']).setValue(landId||'LAND001'); sh.getRange(i+1,hm['X']).setValue(Number(x)); sh.getRange(i+1,hm['Y']).setValue(Number(y)); return true;
  }
  return false;
}


function getBackgroundCatalogFresh(){
  const rows=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.LANDS))
    .filter(x=>x['是否開放']!==false);
  const itemMap={};
  readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.ITEM_CONFIG)).forEach(x=>itemMap[String(x['道具ID'])]=x);

  return safeForClient_(rows.map(x=>{
    const acquireType=String(x['取得方式']||'金幣').trim();
    const itemId=String(x['兌換道具ID']||'').trim();
    const exchangeQty=(x['兌換數量']===''||x['兌換數量']===null||x['兌換數量']===undefined)?'':Number(x['兌換數量']);
    const itemName=String((itemMap[itemId]||{})['名稱']||itemId);
    const price=(x['價格']===''||x['價格']===null||x['價格']===undefined)?'':Number(x['價格']);

    return {
      landId:String(x['土地ID']||''),
      name:String(x['名稱']||x['土地ID']||''),
      price:price,
      background:String(x['背景圖片']||''),
      width:Number(x['寬度']||900),
      height:Number(x['高度']||560),
      enabled:x['是否開放']!==false,
      acquireType:acquireType,
      exchangeItemId:itemId,
      exchangeQty:exchangeQty,
      exchangeItemName:itemName,

      // 同時回傳中文鍵，避免任何前端版本在欄位映射時遺失。
      '取得方式':acquireType,
      '兌換道具ID':itemId,
      '兌換數量':exchangeQty,
      '兌換道具名稱':itemName
    };
  }));
}

function getShop(){
  return {
    lands:cachedObjects_(SHEETS.LANDS,300).filter(x=>x['是否開放']!==false),
    furniture:cachedObjects_(SHEETS.FURNITURE,300).filter(x=>x['是否開放']!==false)
  };
}
function buyLand(studentId,landId){
  const id=String(studentId).trim(), ss=SpreadsheetApp.getActive();
  const item=readObjects_(ss.getSheetByName(SHEETS.LANDS)).find(x=>String(x['土地ID'])===String(landId)); if(!item) throw new Error('找不到土地');
  const sl=ss.getSheetByName(SHEETS.STUDENT_LANDS); if(readObjects_(sl).some(x=>String(x['學號']).trim()===id && String(x['土地ID'])===String(landId))) return getStudentState(id);
  spendCoins_(id,Number(item['價格']||0)); appendObject_(sl,{'學號':id,'土地ID':landId,'是否擁有':true,'購買時間':new Date(),'是否使用':false}); return getStudentState(id);
}
function spendCoins_(studentId,amount){
  return assetWriteLockV610_(()=>{
  assertNoPendingAdminGrantV610_(String(studentId).trim(),'COINS');
  const f=findStudentRow_(studentId); if(!f) throw new Error('找不到學生');
  const now=Number(f.obj['金幣']||0); if(now<amount) throw new Error('金幣不足'); f.sheet.getRange(f.row,f.hm['金幣']).setValue(now-amount);
  });
}


/** V4.5：一次儲存多隻寵物位置，避免寵物每走一步就各自連一次後端 */
function savePetPositionsBatch(studentId, positions){
  const id=String(studentId||'').trim();
  if(!Array.isArray(positions) || !positions.length) return true;
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  const wanted={}; positions.forEach(p=>wanted[String(p.petId)] = p);
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]).trim()!==id) continue;
    const pid=String(vals[i][hm['寵物ID']-1]); const p=wanted[pid]; if(!p) continue;
    sh.getRange(i+1,hm['土地ID'],1,3).setValues([[String(p.landId||'LAND001'),Number(p.x||45),Number(p.y||70)]]);
  }
  return true;
}

/** 切換土地只回傳真正變動的資料，不重新載入整個學生狀態 */
function setActiveLandFast(studentId,landId){
  setActiveLand_(String(studentId).trim(),String(landId));
  const id=String(studentId).trim(), ss=SpreadsheetApp.getActive();
  const fMap=cachedMap_(SHEETS.FURNITURE,'家具ID',300);
  const furniture=readObjects_(ss.getSheetByName(SHEETS.STUDENT_FURNITURE))
    .filter(x=>String(x['學號']).trim()===id && String(x['土地ID']||'LAND001')===String(landId))
    .map(x=>({...x,config:fMap[String(x['家具ID'])]||{}}));
  return safeForClient_({ok:true,activeLandId:String(landId),furniture});
}

/** 買土地後只回傳新增土地與剩餘金幣，不重新 getStudentState */
function buyLandFast(studentId,landId){
  const id=String(studentId).trim(), ss=SpreadsheetApp.getActive();
  const item=cachedObjects_(SHEETS.LANDS,300).find(x=>String(x['土地ID'])===String(landId));
  if(!item) throw new Error('找不到土地');
  const sl=ss.getSheetByName(SHEETS.STUDENT_LANDS);
  const exists=readObjects_(sl).some(x=>String(x['學號']).trim()===id && String(x['土地ID'])===String(landId));
  if(!exists){
    spendCoins_(id,Number(item['價格']||0));
    appendObject_(sl,{'學號':id,'土地ID':landId,'是否擁有':true,'購買時間':new Date(),'是否使用':false});
  }
  const student=getStudent_(id);
  return safeForClient_({ok:true,coins:student?student.coins:0,land:{'學號':id,'土地ID':landId,'是否擁有':true,'是否使用':false,config:item}});
}

/** 挑戰題目批次載入：答題畫面不用每一題等待 Apps Script */
function getChallengeQuestionBatch(subject, excludeIds, limit){
  limit=Math.max(5,Math.min(50,Number(limit||30)));
  const ex=new Set((excludeIds||[]).map(String));
  let rows=subjectQuestionRowsV610_(subject).filter(questionEnabled_);
  if(rows.length>1){ const filtered=rows.filter(x=>!ex.has(String(x['題目ID']))); if(filtered.length) rows=filtered; }
  // 洗牌
  for(let i=rows.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
  return rows.slice(0,limit).map(x=>{
    const qi=resolveQuestionImage_(x);
    return {
      id:String(x['題目ID']),subject:String(x['科目']),unit:String(x['單元']||''),type:String(x['題型']||'選擇題'),text:String(x['題目']),
      options:[x['選項A'],x['選項B'],x['選項C'],x['選項D']].filter(v=>v!==''&&v!=null),
      answer:String(x['答案']||''),explanation:String(x['解析']||''),
      imageId:qi.imageId,image:qi.image
    };
  });
}
function startChallengeBatch(studentId,subject,petId){
  const id=String(studentId).trim(); validatePetOwnership_(id,petId);
  const rec=getOrCreateChallenge_(id,subject,petId);
  const status=challengeStatusFromObj_(rec.obj);
  if(Number(status.wrong||0)>=3) return {ok:false,locked:true,resetAt:nextResetText_(),status};
  const questions=getChallengeQuestionBatch(subject,[],30);
  if(!questions.length) throw new Error('這個科目目前沒有啟用中的題目');
  return {ok:true,questions,status,resetAt:nextResetText_()};
}
/** 一次同步多題答案；伺服器會重新驗證答案，不直接相信前端計分 */
// 每批一列，沿用獎勵紀錄；不把永久歷史塞進單一儲存格或快取。
const CHALLENGE_BATCH_HEADERS_V600=['答題批次ID','答題科目','答題寵物ID','答題內容','答題交易狀態','答題結果'];
// Battle reads keep authoritative mutable values inside the existing shared lock.
// Advanced Sheets batches scattered student rows; mock/legacy runtimes retain a safe fallback.
function battleReadRangesV610_(sh,ranges){
  if(!ranges.length)return [];
  if(typeof Sheets==='undefined'||!Sheets.Spreadsheets?.Values?.batchGet)return ranges.map(r=>sh.getRange(r.row,r.col,r.count,r.width).getValues());
  const prefix="'"+sh.getName().replace(/'/g,"''")+"'!";
  const a1=ranges.map(r=>prefix+adminColumnNameV610_(r.col)+r.row+':'+adminColumnNameV610_(r.col+r.width-1)+(r.row+r.count-1));
  const data=[];
  // Avoid oversized batchGet URLs for long, interleaved enhancement histories.
  for(let i=0;i<a1.length;i+=80)data.push(...(Sheets.Spreadsheets.Values.batchGet(SpreadsheetApp.getActive().getId(),{ranges:a1.slice(i,i+80),valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges||[]));
  return ranges.map((r,index)=>Array.from({length:r.count},(_,i)=>Array.from({length:r.width},(_,j)=>data[index]?.values?.[i]?.[j]??'')));
}
function battleStudentRowsV610_(sh,studentId){
  if(!sh||sh.getLastRow()<2)return [];
  const hm=headerMap_(sh),ids=battleReadRangesV610_(sh,[{row:2,col:hm['學號'],count:sh.getLastRow()-1,width:1}])[0],ranges=[];
  ids.forEach((r,i)=>{if(String(r[0]).trim()!==studentId)return;const last=ranges[ranges.length-1],row=i+2;if(last&&last.row+last.count===row)last.count++;else ranges.push({row,col:1,count:1,width:sh.getLastColumn()});});
  const values=battleReadRangesV610_(sh,ranges),rows=[];
  ranges.forEach((range,index)=>values[index].forEach((r,i)=>{const obj={_row:range.row+i};Object.keys(hm).forEach(key=>obj[key]=r[hm[key]-1]);rows.push(obj);}));
  return rows;
}
function challengeBatchRecordsV600_(studentId,batchId){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.REWARDS),hm=headerMap_(sh);
  if(!CHALLENGE_BATCH_HEADERS_V600.every(h=>hm[h]))throw new Error('請老師先執行 setupOrUpgradeV600() 補上答題批次欄位');
  if(sh.getLastRow()<2)return [];
  const n=sh.getLastRow()-1,columns=battleReadRangesV610_(sh,['學號','答題批次ID','答題交易狀態'].map(key=>({row:2,col:hm[key],count:n,width:1}))),ids=columns[0],bids=columns[1],statuses=columns[2],rows=[];
  const matches=[];
  for(let i=0;i<n;i++)if(String(ids[i][0]).trim()===studentId && bids[i][0] && (String(bids[i][0])===String(batchId||'')||statuses[i][0]==='SUBMITTED'))matches.push({row:i+2,col:1,count:1,width:sh.getLastColumn()});
  const values=battleReadRangesV610_(sh,matches);
  matches.forEach((range,i)=>{const record={_row:range.row};Object.keys(hm).forEach(key=>record[key]=values[i][0][hm[key]-1]);rows.push(record);});
  return rows;
}
function assertNoPendingChallengeBatchV600_(studentId,petId){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.REWARDS);
  if(!sh||!headerMap_(sh)['答題批次ID'])return;
  if(challengeBatchRecordsV600_(studentId).some(r=>r['答題交易狀態']==='SUBMITTED' && (!petId||String(r['答題寵物ID'])===String(petId))))throw new Error('答題批次尚未確認完成，請先重試原批次；確認前不能變更寵物 EXP');
}
function syncChallengeBatch(studentId,subject,petId,answers,batchId){
  const id=String(studentId).trim(),sub=String(subject).trim(),pid=String(petId);
  // 也接受第四參數 envelope；舊四參數陣列有安全指紋 fallback，新版每批使用 UUID。
  if(!Array.isArray(answers)&&answers?.batchId){batchId=batchId||answers.batchId;answers=answers.answers;}
  if(!id||!['國語','數學','英文','自然','社會'].includes(sub)||!Array.isArray(answers)||!answers.length||answers.length>100)throw new Error('答題批次資料無效');
  const normalized=answers.map(a=>({questionId:String(a?.questionId||''),answer:String(a?.answer??'')}));
  const content=JSON.stringify({subject:sub,petId:pid,answers:normalized});
  if(content.length>30000)throw new Error('答題批次內容過長');
  let bid=String(batchId||'');
  if(!bid){
    const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,content,Utilities.Charset.UTF_8);
    bid='LEGACY-'+digest.map(byte=>(byte&255).toString(16).padStart(2,'0')).join('');
  }
  if(!/^[A-Za-z0-9-]{16,100}$/.test(bid))throw new Error('batchId 格式無效');
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const records=challengeBatchRecordsV600_(id,bid),matches=records.filter(r=>String(r['答題批次ID'])===bid);
    if(matches.length>1)throw new Error('答題批次識別重複，請老師核對');
    const existing=matches[0];
    if(existing){
      if(String(existing['答題內容'])!==content||String(existing['答題科目'])!==sub||String(existing['答題寵物ID'])!==pid)throw new Error('同一 batchId 不可用於不同答題內容');
      if(existing['答題交易狀態']==='COMMITTED')return JSON.parse(String(existing['答題結果']));
      throw new Error('答題批次結果尚未確認，請稍後以原 batchId 重試；不會重複計分');
    }
    if(records.some(r=>r['答題交易狀態']==='SUBMITTED'))throw new Error('請先確認上一筆答題批次，不會重複計分');
    requireMailSheetsServiceV600_();
    const ss=SpreadsheetApp.getActive(),ps=ss.getSheetByName(SHEETS.PETS),ph=headerMap_(ps);
    const pet=battleStudentRowsV610_(ps,id).find(p=>String(p['寵物ID'])===pid);
    if(!pet)throw new Error('這不是你的寵物');
    const cs=ss.getSheetByName(SHEETS.CHALLENGES),ch=headerMap_(cs),period=challengePeriodKey_(new Date());
    const record=battleStudentRowsV610_(cs,id).find(r=>String(r['週期'])===period&&String(r['科目'])===sub);
    let wrong=Number(record?.['錯誤數']||0),correct=Number(record?.['答對數']||0),totalExp=Number(record?.['總EXP']||0),gainedTotal=0,processed=0;
    const qMap={};subjectQuestionRowsV610_(sub).forEach(q=>qMap[String(q['題目ID'])]=q);
    for(const answer of normalized){
      if(wrong>=3)break;
      const q=qMap[answer.questionId];if(!q||String(q['科目'])!==sub)continue;
      if(normalizeAnswer_(answer.answer)===normalizeAnswer_(q['答案'])){correct++;const gained=challengeExpForCorrectCount_(correct);totalExp+=gained;gainedTotal+=gained;}
      else wrong++;
      processed++;
    }
    const result={ok:true,batchId:bid,processed,gained:gainedTotal,status:{correct,wrong,exp:totalExp,locked:wrong>=3},locked:wrong>=3,resetAt:nextResetText_()};
    const rewards=ss.getSheetByName(SHEETS.REWARDS),rh=headerMap_(rewards);
    // 先永久標記 SUBMITTED。結果不明時絕不盲目重送原子寫入。
    const transaction={_row:rewards.getLastRow()+1};
    appendObject_(rewards,{'時間':new Date(),'學號':id,'金幣變動':0,'EXP變動':0,'原因':'答題同步批次','答題批次ID':bid,'答題科目':sub,'答題寵物ID':pid,'答題內容':content,'答題交易狀態':'SUBMITTED','答題結果':''});SpreadsheetApp.flush();
    // Shared lock fixes the reserved row; verify only that row, not all historical batches.
    if(String(rewards.getRange(transaction._row,rh['答題批次ID']).getValue())!==bid)throw new Error('無法確認答題交易列，停止提交');
    const requests=[],challengeRow=record?record._row:cs.getLastRow()+1;
    if(!record){
      if(challengeRow>cs.getMaxRows())requests.push({appendDimension:{sheetId:cs.getSheetId(),dimension:'ROWS',length:challengeRow-cs.getMaxRows()}});
      for(const [key,value] of Object.entries({'週期':period,'學號':id,'科目':sub}))requests.push(mailCellRequestV600_(cs,challengeRow,ch[key],value));
    }
    for(const [key,value] of Object.entries({'答對數':correct,'錯誤數':wrong,'總EXP':totalExp,'寵物ID':pid,'最後更新':Utilities.formatDate(new Date(),TZ,'yyyy-MM-dd HH:mm:ss')}))requests.push(mailCellRequestV600_(cs,challengeRow,ch[key],value));
    if(gainedTotal>0&&Number(pet['等級']||1)<30){
      let level=Number(pet['等級']||1),exp=Number(pet['EXP']||0)+gainedTotal;
      while(level<30&&exp>=expNeeded_(level)){exp-=expNeeded_(level);level++;}
      if(level>=30)exp=0;if(exp<0)exp=0;
      requests.push(mailCellRequestV600_(ps,pet._row,ph['等級'],level),mailCellRequestV600_(ps,pet._row,ph['EXP'],exp));
    }
    requests.push(mailCellRequestV600_(rewards,transaction._row,rh['EXP變動'],gainedTotal),mailCellRequestV600_(rewards,transaction._row,rh['答題結果'],JSON.stringify(result)),mailCellRequestV600_(rewards,transaction._row,rh['答題交易狀態'],'COMMITTED'));
    Sheets.Spreadsheets.batchUpdate({requests},ss.getId());
    return result;
  }finally{lock.releaseLock();}
}

/** ====================== V5.10.5 對戰存檔 ====================== **/

function getBattleProgressV5105(studentId,subject){
  const id=String(studentId||'').trim(), sub=String(subject||'').trim();
  if(!id || !sub)return null;
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.BATTLE_SAVES);
  if(!sh || sh.getLastRow()<2)return null;
  const hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]).trim()===id && String(vals[i][hm['科目']-1]).trim()===sub){
      let seen=[];
      try{seen=JSON.parse(String(vals[i][hm['已看題目']-1]||'[]'));}catch(e){}
      return safeForClient_({
        exists:true,
        subject:sub,
        petId:String(vals[i][hm['寵物ID']-1]||''),
        monsterNo:Math.max(1,Number(vals[i][hm['怪物編號']-1]||1)),
        monsterHp:Math.max(0,Number(vals[i][hm['怪物HP']-1]||0)),
        monsterMaxHp:Math.max(1,Number(vals[i][hm['怪物最大HP']-1]||1)),
        seen:Array.isArray(seen)?seen.slice(-80):[],
        updatedAt:vals[i][hm['最後更新']-1]||''
      });
    }
  }
  return null;
}

function saveBattleProgressV5105(studentId,payload){
  const lock=LockService.getScriptLock();
  lock.waitLock(12000);
  try{
    const id=String(studentId||'').trim();
    const p=payload||{};
    const sub=String(p.subject||'').trim();
    const petId=String(p.petId||'').trim();
    if(!id || !sub || !petId)throw new Error('對戰存檔資料不完整');
    validatePetOwnership_(id,petId);

    const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.BATTLE_SAVES);
    if(!sh)throw new Error('找不到對戰存檔工作表，請先執行 setupOrUpgradeV5105()');
    const hm=headerMap_(sh), vals=sh.getDataRange().getValues();
    let row=0;
    for(let i=1;i<vals.length;i++){
      if(String(vals[i][hm['學號']-1]).trim()===id && String(vals[i][hm['科目']-1]).trim()===sub){
        row=i+1;break;
      }
    }
    const seen=Array.isArray(p.seen)?p.seen.map(String).slice(-80):[];
    const data={
      '學號':id,'科目':sub,'寵物ID':petId,
      '怪物編號':Math.max(1,Number(p.monsterNo||1)),
      '怪物HP':Math.max(0,Number(p.monsterHp||0)),
      '怪物最大HP':Math.max(1,Number(p.monsterMaxHp||1)),
      '已看題目':JSON.stringify(seen),
      '最後更新':new Date()
    };
    if(row){
      Object.keys(data).forEach(k=>{if(hm[k])sh.getRange(row,hm[k]).setValue(data[k]);});
    }else{
      appendObject_(sh,data);
    }
    return {ok:true,save:getBattleProgressV5105(id,sub)};
  }finally{
    lock.releaseLock();
  }
}

function clearBattleProgressV5105(studentId,subject){
  const lock=LockService.getScriptLock();
  lock.waitLock(12000);
  try{
    const id=String(studentId||'').trim(), sub=String(subject||'').trim();
    const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.BATTLE_SAVES);
    if(!sh || sh.getLastRow()<2)return {ok:true};
    const hm=headerMap_(sh), vals=sh.getDataRange().getValues();
    for(let i=vals.length-1;i>=1;i--){
      if(String(vals[i][hm['學號']-1]).trim()===id && String(vals[i][hm['科目']-1]).trim()===sub){
        sh.deleteRow(i+1);
      }
    }
    return {ok:true};
  }finally{
    lock.releaseLock();
  }
}

/** 老師後台 */
function getAdminData(){
  const ss=SpreadsheetApp.getActive();
  const students=readObjects_(ss.getSheetByName(SHEETS.STUDENTS)).map(s=>({id:s['學號'],name:s['姓名'],seat:s['座號'],coins:Number(s['金幣']||0)}));
  const items=readObjects_(ss.getSheetByName(SHEETS.ITEM_CONFIG)).filter(x=>x['是否開放']!==false);
  const pets=readObjects_(ss.getSheetByName(SHEETS.PET_CONFIG)).filter(x=>x['是否開放']!==false).map(x=>({petId:x['寵物ID'],name:x['名稱']}));
  return {students,items,pets};
}
function addCoins(studentId,amount,reason){
  return assetWriteLockV610_(()=>{
  assertNoPendingAdminGrantV610_(String(studentId).trim(),'COINS');
  const f=findStudentRow_(studentId); if(!f) throw new Error('找不到學生');
  f.sheet.getRange(f.row,f.hm['金幣']).setValue(Number(f.obj['金幣']||0)+Number(amount||0));
  SpreadsheetApp.getActive().getSheetByName(SHEETS.REWARDS).appendRow([new Date(),studentId,f.obj['姓名'],Number(amount||0),0,reason||'老師發放']); return true;
  });
}
function assignPetToStudent(studentId,petId){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS), id=String(studentId).trim();
  if(readObjects_(sh).some(x=>String(x['學號']).trim()===id && String(x['寵物ID'])===String(petId))) throw new Error('學生已經擁有這隻寵物');
  const active=(readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_LANDS)).find(x=>String(x['學號']).trim()===id && (x['是否使用']===true || String(x['是否使用']).toUpperCase()==='TRUE'))||{})['土地ID']||'LAND001';
  appendObject_(sh,{'學號':id,'寵物ID':petId,'等級':1,'EXP':0,'階段':1,'土地ID':active,'X':45,'Y':70,'是否目前顯示':true}); return true;
}

/** 地圖圖片批次匯入：把四張圖放同一 Drive 資料夾，檔名含 草地/森林/海灘/雪地 */
function importBasicLandImagesFromDrive(folderId){
  const folder=DriveApp.getFolderById(String(folderId).replace(/\?.*$/,''));
  const files=folder.getFiles();
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.LANDS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  const nameToId={'草地':'LAND001','森林':'LAND002','海灘':'LAND003','雪地':'LAND004'};
  const found=[];
  while(files.hasNext()){
    const f=files.next(); if(!String(f.getMimeType()).startsWith('image/')) continue;
    const key=Object.keys(nameToId).find(k=>f.getName().includes(k)); if(!key) continue;
    const url='https://drive.google.com/thumbnail?id='+f.getId()+'&sz=w1600';
    for(let i=1;i<vals.length;i++) if(String(vals[i][hm['土地ID']-1])===nameToId[key]){ sh.getRange(i+1,hm['背景圖片']).setValue(url); found.push(key); }
  }
  return found;
}

/** 寵物三階段圖匯入（保留舊功能） */
function importAllPetStagesFromDrive(){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PET_CONFIG), hm=headerMap_(sh);
  const map={}; readObjects_(sh).forEach((x,i)=>map[normalizePetId_(x['寵物ID'])]=i+2);
  [[STAGE1_FOLDER_ID,1],[STAGE2_FOLDER_ID,2],[STAGE3_FOLDER_ID,3]].forEach(([folderId,stage])=>{
    const files=DriveApp.getFolderById(folderId).getFiles();
    while(files.hasNext()){
      const f=files.next(); if(!String(f.getMimeType()).startsWith('image/')) continue;
      const m=f.getName().match(/^0*(\d+)/); if(!m) continue; const n=Number(m[1]); if(!VALID_SEATS.includes(n)) continue;
      const row=map[String(n)]; if(!row) continue;
      const col=stage===1?hm['第一階圖片']:(stage===2?hm['第二階圖片']:hm['第三階圖片']);
      sh.getRange(row,col).setValue('https://drive.google.com/thumbnail?id='+f.getId()+'&sz=w1000');
    }
  });
  return true;
}


/** ====================== V5.8 效能核心 ====================== **/

function fastCache_(){
  return CacheService.getScriptCache();
}

function clearRuntimeCaches_(studentId){
  const c=fastCache_();
  const keys=[
    'FAST_BG_CATALOG','FAST_MONSTER_CATALOG',
    'FAST_STUDENT_INDEX'
  ];
  if(studentId){
    const id=String(studentId).trim();
    keys.push('READY_'+id);
  }
  keys.forEach(k=>{try{c.remove(k);}catch(e){}});
}

function headerMapFast_(sh){
  const c=fastCache_();
  const key='HDR_'+sh.getSheetId()+'_'+sh.getLastColumn();
  const hit=c.get(key);
  if(hit){try{return JSON.parse(hit);}catch(e){}}
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const m={};h.forEach((x,i)=>m[String(x).trim()]=i+1);
  try{c.put(key,JSON.stringify(m),21600);}catch(e){}
  return m;
}

function objectRow_(sh,obj){
  const hm=headerMapFast_(sh);
  const row=Array(sh.getLastColumn()).fill('');
  Object.keys(obj).forEach(k=>{if(hm[k])row[hm[k]-1]=obj[k];});
  return row;
}

function appendObjectsBatch_(sh,objects){
  if(!objects || !objects.length)return;
  const rows=objects.map(o=>objectRow_(sh,o));
  sh.getRange(sh.getLastRow()+1,1,rows.length,sh.getLastColumn()).setValues(rows);
}

function ensureStudentReadyFast_(studentId){
  const id=String(studentId||'').trim();
  if(!id)return;
  const c=fastCache_(),key='READY_'+id;
  if(c.get(key)==='1')return;
  ensureStarterData_(id);
  ensurePlotData_(id);
  try{c.put(key,'1',21600);}catch(e){}
}

/** 從表格尾端分段找某學生最近的資料，避免信箱數萬列時整張 getDataRange。 */
function recentRowsForStudent_(sh,studentId,idHeader,limit,chunkSize){
  if(!sh || sh.getLastRow()<2)return [];
  const hm=headerMapFast_(sh), idCol=hm[idHeader];
  if(!idCol)return [];
  const lastCol=sh.getLastColumn(), lastRow=sh.getLastRow();
  const wanted=String(studentId).trim();
  const out=[];
  chunkSize=Math.max(100,Number(chunkSize||500));
  for(let endRow=lastRow;endRow>=2 && out.length<limit;endRow-=chunkSize){
    const startRow=Math.max(2,endRow-chunkSize+1);
    const num=endRow-startRow+1;
    const vals=sh.getRange(startRow,1,num,lastCol).getValues();
    for(let i=vals.length-1;i>=0 && out.length<limit;i--){
      if(String(vals[i][idCol-1]||'').trim()!==wanted)continue;
      const o={};
      Object.keys(hm).forEach(k=>o[k]=vals[i][hm[k]-1]);
      out.push(o);
    }
  }
  return out;
}

/** 未讀數只讀「學號」與「是否領取」兩欄，不再抓信箱全部欄位。 */
function getUnreadMailCountFast_(studentId){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX);
  if(!sh || sh.getLastRow()<2)return 0;
  const hm=headerMapFast_(sh), idCol=hm['學號'], claimedCol=hm['是否領取'];
  const n=sh.getLastRow()-1;
  const ids=sh.getRange(2,idCol,n,1).getValues();
  const claimed=sh.getRange(2,claimedCol,n,1).getValues();
  const wanted=String(studentId).trim();
  let count=0;
  for(let i=0;i<n;i++){
    if(String(ids[i][0]||'').trim()!==wanted)continue;
    const v=claimed[i][0];
    if(!(v===true||String(v).toUpperCase()==='TRUE'))count++;
  }
  return count;
}

function getMailboxFast_(studentId){
  const id=String(studentId).trim();
  const itemCfg=cachedObjects_(SHEETS.ITEM_CONFIG,300),m={};
  itemCfg.forEach(x=>m[String(x['道具ID'])]=x);
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX);
  const rows=recentRowsForStudent_(sh,id,'學號',100,600)
    .map(x=>({...x,附件名稱:(m[String(x['附件ID'])]||{})['名稱']||x['附件ID']}));
  return safeForClient_(rows);
}

function getBackgroundCatalogCached_(){
  const c=fastCache_(),key='FAST_BG_CATALOG';
  const hit=c.get(key);
  if(hit){try{return JSON.parse(hit);}catch(e){}}
  const rows=getBackgroundCatalogFresh();
  try{c.put(key,JSON.stringify(rows),30);}catch(e){}
  return rows;
}
function getBackgroundCatalogFast(){
  return getBackgroundCatalogCached_();
}

function getMonsterCatalogCached_(){
  const c=fastCache_(),key='FAST_MONSTER_CATALOG';
  const hit=c.get(key);
  if(hit){try{return JSON.parse(hit);}catch(e){}}
  const rows=getMonsterCatalogFresh();
  try{c.put(key,JSON.stringify(rows),300);}catch(e){}
  return rows;
}

/** 登入後一次取得信箱、背包、背景、怪物。原本是 4 次 API。 */
function getRuntimeBundleFast(studentId){
  const id=String(studentId||'').trim();
  generateHourlyGiftsFast_(id);
  return safeForClient_({
    mailbox:getMailboxFast_(id),
    unreadMail:getUnreadMailCountFast_(id),
    inventory:getInventory(id),
    backgrounds:getBackgroundCatalogCached_(),
    monsters:getMonsterCatalogCached_(),
    battleBackgrounds:getBattleBackgroundCatalogFast(),
    petBattleConfigs:getPetBattleConfigFast()
  });
}

/** 整點禮物改成一次 setValues，不再每封 appendRow。 */
// 每封整點寵物禮物抽中屬性石的機率（0～1）；數量累積機率 80/90/96/99/100%。
const HOURLY_STONE_DROP_RATE_V600 = 0.50;
function hourlyPetGiftV600_(petId,attributes,available){
  const stone=ATTRIBUTE_STONES_V600.find(s=>s.attribute===attributes[String(petId)]);
  if(stone && available.has(stone.itemId) && Math.random()<HOURLY_STONE_DROP_RATE_V600){
    const r=Math.random(),qty=r<0.80?1:r<0.90?2:r<0.96?3:r<0.99?4:5;
    return {itemId:stone.itemId,qty,title:stone.name,content:'寵物帶回了 '+qty+' 顆'+stone.name+'！可以用來強化技能傷害。'};
  }
  return randomGift_();
}
function generateHourlyGiftsFast_(studentId){
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{return generateHourlyGiftsLockedV600_(studentId);}finally{lock.releaseLock();}
}
function generateHourlyGiftsLockedV600_(studentId){
  const id=String(studentId||'').trim();
  const f=findStudentRow_(id);if(!f)return;
  const pets=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS))
    .filter(x=>String(x['學號']).trim()===id);
  if(!pets.length)return;

  const now=new Date(),thisHour=new Date(now);thisHour.setMinutes(0,0,0);
  const col=f.hm['最後整點禮物'];
  let last=f.obj['最後整點禮物'];
  if(!(last instanceof Date)||isNaN(last)){
    f.sheet.getRange(f.row,col).setValue(thisHour);return;
  }

  let cursor=new Date(last);cursor.setMinutes(0,0,0);cursor=new Date(cursor.getTime()+3600000);
  if(cursor>thisHour)return;
  const mailboxSheet=SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX);
  // 固定學號＋整點 ID：發信完成、最後整點欄位更新失敗時，重試不重複發放。
  const mailHeaders=headerMap_(mailboxSheet);
  const existing=new Set(mailboxSheet.getLastRow()<2?[]:mailboxSheet.getRange(2,mailHeaders['信件ID'],mailboxSheet.getLastRow()-1,1).getValues().map(r=>String(r[0])));
  const attributes={};getPetBattleConfigFast().forEach(p=>attributes[p.petId]=String(p.attribute).trim());
  cachedObjects_(SHEETS.PET_CONFIG,300).forEach(p=>{const pid=String(p['寵物ID']);if(!attributes[pid])attributes[pid]=String(p['屬性']||'').trim();});
  const available=new Set(cachedObjects_(SHEETS.ITEM_CONFIG,300).filter(x=>String(x['類型'])==='屬性石').map(x=>String(x['道具ID'])));
  const mails=[];let made=0;
  while(cursor<=thisHour && made<48){
    const pet=pets[made%pets.length],mailId='MAIL-H600-'+id+'-'+cursor.getTime();
    if(existing.has(mailId)){made++;cursor=new Date(cursor.getTime()+3600000);continue;}
    const gift=hourlyPetGiftV600_(pet['寵物ID'],attributes,available);
    mails.push({
      '信件ID':mailId,
      '學號':id,
      '時間':new Date(cursor),
      '寄件者':String(pet['寵物ID']),
      '標題':gift.title||'整點小禮物',
      '內容':gift.content||'寵物在整點時替你帶回了一份禮物！',
      '附件類型':'道具',
      '附件ID':gift.itemId,
      '附件數量':gift.qty,
      '是否領取':false
    });
    made++;cursor=new Date(cursor.getTime()+3600000);
  }
  if(mails.length){
    appendObjectsBatch_(SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX),mails);
  }
  f.sheet.getRange(f.row,col).setValue(thisHour);
}

/** 批次增加多種道具：學生道具只讀一次、寫一次。 */
function addItemsBatch_(studentId,gifts){
  const id=String(studentId).trim();
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_ITEMS);
  const hm=headerMapFast_(sh),lastCol=sh.getLastColumn();
  const vals=sh.getLastRow()>=2?sh.getRange(2,1,sh.getLastRow()-1,lastCol).getValues():[];
  const rowByItem={};
  for(let i=0;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]||'').trim()===id){
      rowByItem[String(vals[i][hm['道具ID']-1]||'')]={index:i,row:i+2};
    }
  }
  const appends=[];
  Object.keys(gifts||{}).forEach(itemId=>{
    const qty=Number(gifts[itemId]||0);if(qty<=0)return;
    const found=rowByItem[itemId];
    if(found){
      vals[found.index][hm['數量']-1]=Number(vals[found.index][hm['數量']-1]||0)+qty;
    }else{
      appends.push({'學號':id,'道具ID':itemId,'數量':qty});
    }
  });
  if(vals.length){
    sh.getRange(2,1,vals.length,lastCol).setValues(vals);
  }
  if(appends.length)appendObjectsBatch_(sh,appends);
}


/** 工具 */
function findStudentRow_(id){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENTS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++) if(String(vals[i][hm['學號']-1]||'').trim()===String(id).trim()) return {sheet:sh,row:i+1,hm,obj:rowObject_(sh,vals[i])};
  return null;
}
function inferSeat_(id){ const m=String(id||'').match(/(\d{2})$/); if(!m) return null; const n=Number(m[1]); return VALID_SEATS.includes(n)?n:null; }
function validatePetOwnership_(studentId,petId){ const ok=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS)).some(x=>String(x['學號']).trim()===studentId && String(x['寵物ID'])===String(petId)); if(!ok) throw new Error('這不是你的寵物'); }
/** 將試算表中的 Date 等資料轉成 google.script.run 可安全傳回前端的格式 */
function safeForClient_(value){
  return JSON.parse(JSON.stringify(value, function(key, v){
    if (v instanceof Date) {
      return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
    }
    if (typeof v === 'undefined') return null;
    return v;
  }));
}

function normalizeDate_(v){ if(v instanceof Date) return Utilities.formatDate(v,TZ,'yyyy-MM-dd'); return String(v||'').replace(/\//g,'-').trim(); }
function formatPetId_(n){ return 'PET'+String(Number(n)).padStart(3,'0'); }
function normalizePetId_(v){ const m=String(v||'').match(/(\d+)/); return m?String(Number(m[1])):''; }
function headerMap_(sh){ return headerMapFast_(sh); }
function rowObject_(sh,row){ const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0], o={}; h.forEach((x,i)=>o[String(x).trim()]=row[i]); return o; }
function readObjects_(sh){ if(!sh || sh.getLastRow()<2) return []; const v=sh.getDataRange().getValues(), h=v[0]; return v.slice(1).filter(r=>r.some(x=>x!=='' && x!=null)).map(r=>{const o={};h.forEach((x,i)=>o[String(x).trim()]=r[i]);return o;}); }
function appendObject_(sh,obj){ const hm=headerMap_(sh), row=Array(sh.getLastColumn()).fill(''); Object.keys(obj).forEach(k=>{if(hm[k]) row[hm[k]-1]=obj[k];}); sh.appendRow(row); }




/** ======================== V5.5 ======================== */
const LAND_SLOT_PRICE_V55 = 2000;

function setupOrUpgradeV55(){
  setupOrUpgradeV4();
  ensureSheet_(SHEETS.STUDENT_PLOTS,['學號','土地格ID','土地序號','背景ID','是否使用','購買時間']);
  ensureSheet_(SHEETS.STUDENT_BACKGROUNDS,['學號','背景ID','是否擁有','購買時間']);
  const students=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENTS));
  students.forEach(s=>{const id=String(s['學號']||'').trim();if(id)ensurePlotData_(id);});
  return 'V5.5 升級完成';
}

function normalizeMonthDay_(v){
  if(v instanceof Date) return Utilities.formatDate(v,TZ,'MM/dd');
  let s=String(v||'').trim();
  let m=s.match(/^(\d{4})[-\/]?(\d{1,2})[-\/](\d{1,2})$/); if(m)return String(Number(m[2])).padStart(2,'0')+'/'+String(Number(m[3])).padStart(2,'0');
  m=s.match(/(\d{1,2})\D+(\d{1,2})$/); if(m)return String(Number(m[1])).padStart(2,'0')+'/'+String(Number(m[2])).padStart(2,'0');
  const d=s.replace(/\D/g,''); if(d.length>=4){const x=d.slice(-4);return x.slice(0,2)+'/'+x.slice(2);}
  return s;
}
function loginV55(studentId,birthdayMD){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENTS),hm=headerMap_(sh),vals=sh.getDataRange().getValues(),wanted=normalizeMonthDay_(birthdayMD);
  for(let i=1;i<vals.length;i++){
    const id=String(vals[i][hm['學號']-1]||'').trim();
    if(id===String(studentId).trim() && normalizeMonthDay_(vals[i][hm['生日']-1])===wanted && vals[i][hm['是否啟用']-1]!==false){return {ok:true,name:vals[i][hm['姓名']-1],version:APP_VERSION};}
  }
  return {ok:false,message:'學號或生日（月/日）不正確'};
}
function loginCoreV55(studentId,birthdayMD){const auth=loginV55(studentId,birthdayMD);if(!auth.ok)return auth;return {ok:true,name:auth.name,version:APP_VERSION,state:getStudentCoreStateV55_(studentId)};}

function ensurePlotData_(studentId){
  const ss=SpreadsheetApp.getActive(),id=String(studentId).trim();
  const ps=ss.getSheetByName(SHEETS.STUDENT_PLOTS),bs=ss.getSheetByName(SHEETS.STUDENT_BACKGROUNDS);
  let plots=readObjects_(ps).filter(x=>String(x['學號']).trim()===id);
  if(!plots.length){
    const legacy=readObjects_(ss.getSheetByName(SHEETS.STUDENT_LANDS)).filter(x=>String(x['學號']).trim()===id && x['是否擁有']!==false);
    const source=legacy.length?legacy:[{'土地ID':'LAND001','是否使用':true}];
    const map={};source.forEach((r,i)=>{const slot='SLOT'+String(i+1).padStart(3,'0'),bg=String(r['土地ID']||'LAND001');map[bg]=slot;appendObject_(ps,{'學號':id,'土地格ID':slot,'土地序號':i+1,'背景ID':bg,'是否使用':i===0 || r['是否使用']===true || String(r['是否使用']).toUpperCase()==='TRUE','購買時間':r['購買時間']||new Date()});if(!readObjects_(bs).some(x=>String(x['學號']).trim()===id&&String(x['背景ID'])===bg))appendObject_(bs,{'學號':id,'背景ID':bg,'是否擁有':true,'購買時間':new Date()});});
    const petSh=ss.getSheetByName(SHEETS.PETS),hm=headerMap_(petSh),vals=petSh.getDataRange().getValues();for(let i=1;i<vals.length;i++){if(String(vals[i][hm['學號']-1]).trim()!==id)continue;const old=String(vals[i][hm['土地ID']-1]||'LAND001');petSh.getRange(i+1,hm['土地ID']).setValue(map[old]||'SLOT001');}
  }
  const bgs=readObjects_(bs).filter(x=>String(x['學號']).trim()===id);if(!bgs.some(x=>String(x['背景ID'])==='LAND001'))appendObject_(bs,{'學號':id,'背景ID':'LAND001','是否擁有':true,'購買時間':new Date()});
  plots=readObjects_(ps).filter(x=>String(x['學號']).trim()===id);if(plots.length&&!plots.some(x=>x['是否使用']===true||String(x['是否使用']).toUpperCase()==='TRUE')){const hm=headerMap_(ps),vals=ps.getDataRange().getValues();for(let i=1;i<vals.length;i++)if(String(vals[i][hm['學號']-1]).trim()===id){ps.getRange(i+1,hm['是否使用']).setValue(true);break;}}
}
function getStudentCoreStateV55_(studentId,includeFurniture=true){
  const id=String(studentId||'').trim();ensureStudentReadyFast_(id);const ss=SpreadsheetApp.getActive(),student=getStudent_(id);if(!student)return {ok:false,message:'找不到學生'};
  const petCfg=cachedObjects_(SHEETS.PET_CONFIG,300),cfgMap={};petCfg.forEach(x=>cfgMap[String(x['寵物ID'])]=x);const pets=readObjects_(ss.getSheetByName(SHEETS.PETS)).filter(x=>String(x['學號']).trim()===id).map(p=>decoratePet_(p,cfgMap[String(p['寵物ID'])]||{}));
  const bgCfg=cachedObjects_(SHEETS.LANDS,300),bgMap={};bgCfg.forEach(x=>bgMap[String(x['土地ID'])]=x);let plots=readObjects_(ss.getSheetByName(SHEETS.STUDENT_PLOTS)).filter(x=>String(x['學號']).trim()===id);const active=plots.find(x=>x['是否使用']===true||String(x['是否使用']).toUpperCase()==='TRUE')||plots[0];const activeLandId=active?String(active['土地格ID']):'SLOT001';const lands=plots.map(x=>({'學號':id,'土地ID':String(x['土地格ID']),'土地序號':Number(x['土地序號']||1),'背景ID':String(x['背景ID']||'LAND001'),'是否使用':x['是否使用'],config:bgMap[String(x['背景ID']||'LAND001')]||{}}));
  const backgrounds=readObjects_(ss.getSheetByName(SHEETS.STUDENT_BACKGROUNDS)).filter(x=>String(x['學號']).trim()===id&&x['是否擁有']!==false).map(x=>String(x['背景ID']));
  let furniture=[];
  if(includeFurniture){const fMap=cachedMap_(SHEETS.FURNITURE,'家具ID',300);furniture=readObjects_(ss.getSheetByName(SHEETS.STUDENT_FURNITURE)).filter(x=>String(x['學號']).trim()===id&&String(x['土地ID']||'SLOT001')===activeLandId).map(x=>({...x,config:fMap[String(x['家具ID'])]||{}}));}
  return safeForClient_({ok:true,version:APP_VERSION,student,pets,lands,backgrounds,activeLandId,furniture,unreadMail:0,challengeStatus:{},skillEnhancements:getSkillEnhancementsV600_(id)});
}
function getStudentStateV55(studentId){
  const s=getStudentCoreStateV55_(studentId);if(!s.ok)return s;
  s.mailbox=getMailbox(studentId);
  s.inventory=getInventory(studentId);
  s.challengeStatus=getAllChallengeStatusFastV596(studentId);
  // 信箱只回傳最近 100 封；未領總數必須以完整信箱計數。
  s.unreadMail=getUnreadMailCountFast_(studentId);
  return safeForClient_(s);
}
function setActivePlotFastV55(studentId,slotId){
  const id=String(studentId).trim(),sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_PLOTS);
  const hm=headerMapFast_(sh),vals=sh.getDataRange().getValues();
  const updates=[];let found=false;
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]).trim()!==id)continue;
    const yes=String(vals[i][hm['土地格ID']-1])===String(slotId);
    updates.push({row:i+1,value:yes});
    if(yes)found=true;
  }
  if(!found)throw new Error('找不到土地');
  updates.forEach(u=>sh.getRange(u.row,hm['是否使用']).setValue(u.value));
  const fMap=cachedMap_(SHEETS.FURNITURE,'家具ID',300);
  const furniture=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_FURNITURE))
    .filter(x=>String(x['學號']).trim()===id&&String(x['土地ID'])===String(slotId))
    .map(x=>({...x,config:fMap[String(x['家具ID'])]||{}}));
  return safeForClient_({ok:true,activeLandId:String(slotId),furniture});
}
function buyPlotFast(studentId){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const id=String(studentId).trim();ensurePlotData_(id);
    spendCoins_(id,LAND_SLOT_PRICE_V55);
    const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(SHEETS.STUDENT_PLOTS);
    const rows=readObjects_(sh).filter(x=>String(x['學號']).trim()===id);
    const n=rows.reduce((m,x)=>Math.max(m,Number(x['土地序號']||0)),0)+1;
    const slot='SLOT'+String(n).padStart(3,'0');
    const bg=(readObjects_(ss.getSheetByName(SHEETS.STUDENT_BACKGROUNDS)).find(x=>String(x['學號']).trim()===id&&x['是否擁有']!==false)||{})['背景ID']||'LAND001';
    appendObject_(sh,{'學號':id,'土地格ID':slot,'土地序號':n,'背景ID':bg,'是否使用':false,'購買時間':new Date()});
    const student=getStudent_(id);
    return {ok:true,coins:student.coins,plot:{'土地ID':slot,'土地序號':n,'背景ID':bg,'是否使用':false}};
  }finally{lock.releaseLock();}
}
function buyBackgroundFast(studentId,bgId){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const id=String(studentId).trim();ensurePlotData_(id);
    const ss=SpreadsheetApp.getActive();
    const cfg=readObjects_(ss.getSheetByName(SHEETS.LANDS)).find(x=>String(x['土地ID'])===String(bgId));
    if(!cfg)throw new Error('找不到背景');

    const method=String(cfg['取得方式']||'金幣').trim();
    if(method==='寶物'||method.includes('兌換'))throw new Error('這張背景只能使用寶物兌換');

    const priceRaw=cfg['價格'];
    const price=(priceRaw===''||priceRaw===null||priceRaw===undefined)?NaN:Number(priceRaw);
    if(!Number.isFinite(price)||price<=0)throw new Error('這張背景尚未設定有效的金幣價格，已停止購買');

    const bgSh=ss.getSheetByName(SHEETS.STUDENT_BACKGROUNDS), bgRows=readObjects_(bgSh);
    const already=bgRows.some(x=>String(x['學號']).trim()===id&&String(x['背景ID'])===String(bgId)&&x['是否擁有']!==false);
    if(already){
      const s=getStudent_(id);
      return {ok:true,alreadyOwned:true,coins:Number(s?.coins||0),backgrounds:bgRows.filter(x=>String(x['學號']).trim()===id&&x['是否擁有']!==false).map(x=>String(x['背景ID']))};
    }

    assertNoPendingAdminGrantV610_(id,'COINS');
    const stuSh=ss.getSheetByName(SHEETS.STUDENTS),hm=headerMap_(stuSh),vals=stuSh.getDataRange().getValues();
    for(let i=1;i<vals.length;i++){
      if(String(vals[i][hm['學號']-1]).trim()===id){
        const coins=Number(vals[i][hm['金幣']-1]||0);
        if(coins<price)throw new Error('金幣不足');
        stuSh.getRange(i+1,hm['金幣']).setValue(coins-price);
        appendObject_(bgSh,{'學號':id,'背景ID':bgId,'是否擁有':true,'購買時間':new Date()});
        const backgrounds=readObjects_(bgSh).filter(x=>String(x['學號']).trim()===id&&x['是否擁有']!==false).map(x=>String(x['背景ID']));
        return {ok:true,coins:coins-price,backgrounds:[...new Set(backgrounds)]};
      }
    }
    throw new Error('找不到學生');
  }finally{lock.releaseLock();}
}

function redeemBackgroundFast(studentId,bgId){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const id=String(studentId).trim();ensurePlotData_(id);
    const ss=SpreadsheetApp.getActive();
    const cfg=readObjects_(ss.getSheetByName(SHEETS.LANDS)).find(x=>String(x['土地ID'])===String(bgId));
    if(!cfg)throw new Error('找不到背景');
    const method=String(cfg['取得方式']||'金幣');
    if(!(method.includes('寶物')||method.includes('兌換')))throw new Error('這張背景不是寶物兌換背景');
    const itemId=String(cfg['兌換道具ID']||'').trim(), need=Math.max(1,Number(cfg['兌換數量']||0));
    if(!itemId)throw new Error('尚未設定兌換道具ID');
    assertNoPendingStoneMailV600_(id,itemId);

    const bgSh=ss.getSheetByName(SHEETS.STUDENT_BACKGROUNDS), bgRows=readObjects_(bgSh);
    const already=bgRows.some(x=>String(x['學號']).trim()===id&&String(x['背景ID'])===String(bgId)&&x['是否擁有']!==false);
    if(already)return {ok:true,alreadyOwned:true,backgrounds:bgRows.filter(x=>String(x['學號']).trim()===id&&x['是否擁有']!==false).map(x=>String(x['背景ID'])),inventory:getInventory(id)};

    const itemSh=ss.getSheetByName(SHEETS.STUDENT_ITEMS), hm=headerMap_(itemSh), vals=itemSh.getDataRange().getValues();
    let row=-1,have=0;
    for(let i=1;i<vals.length;i++){
      if(String(vals[i][hm['學號']-1]).trim()===id&&String(vals[i][hm['道具ID']-1])===itemId){
        row=i+1;have=Number(vals[i][hm['數量']-1]||0);break;
      }
    }
    if(row<0||have<need)throw new Error('寶物數量不足');
    itemSh.getRange(row,hm['數量']).setValue(have-need);
    appendObject_(bgSh,{'學號':id,'背景ID':bgId,'是否擁有':true,'購買時間':new Date()});
    const backgrounds=readObjects_(bgSh).filter(x=>String(x['學號']).trim()===id&&x['是否擁有']!==false).map(x=>String(x['背景ID']));
    return {ok:true,backgrounds:[...new Set(backgrounds)],inventory:getInventory(id),spentItemId:itemId,spentQty:need};
  }finally{lock.releaseLock();}
}

function setPlotBackgroundFast(studentId,slotId,bgId){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const id=String(studentId).trim();ensurePlotData_(id);const ss=SpreadsheetApp.getActive();
    const own=readObjects_(ss.getSheetByName(SHEETS.STUDENT_BACKGROUNDS)).some(x=>String(x['學號']).trim()===id&&String(x['背景ID'])===String(bgId)&&x['是否擁有']!==false);
    if(!own)throw new Error('尚未擁有這個背景');
    const sh=ss.getSheetByName(SHEETS.STUDENT_PLOTS),hm=headerMap_(sh),vals=sh.getDataRange().getValues();
    for(let i=1;i<vals.length;i++)if(String(vals[i][hm['學號']-1]).trim()===id&&String(vals[i][hm['土地格ID']-1])===String(slotId)){sh.getRange(i+1,hm['背景ID']).setValue(bgId);SpreadsheetApp.flush();return {ok:true,backgroundId:String(bgId)};}
    throw new Error('找不到土地');
  }finally{lock.releaseLock();}
}
function movePetToLandV55(studentId,petId,slotId){const id=String(studentId).trim();const own=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_PLOTS)).some(x=>String(x['學號']).trim()===id&&String(x['土地格ID'])===String(slotId));if(!own)throw new Error('尚未擁有這塊土地');const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS),hm=headerMap_(sh),vals=sh.getDataRange().getValues();for(let i=1;i<vals.length;i++)if(String(vals[i][hm['學號']-1]).trim()===id&&String(vals[i][hm['寵物ID']-1])===String(petId)){sh.getRange(i+1,hm['土地ID']).setValue(slotId);return true;}throw new Error('找不到寵物');}

function claimAllMailFast(studentId){
  const id=String(studentId).trim(),lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX),rows=readRowsWithPositionV600_(sh);
    // 先恢復未完成交易，再領其他信件；單封與全部領取共用相同去重流程。
    const targets=rows.filter(r=>String(r['學號']).trim()===id && !mailClaimedV600_(r));
    targets.sort((a,b)=>Number(Boolean(b['領取交易']))-Number(Boolean(a['領取交易'])));
    if(targets.length){
      const ss=SpreadsheetApp.getActive(),batch={itemRows:readRowsWithPositionV600_(ss.getSheetByName(SHEETS.STUDENT_ITEMS)),skillOperations:readObjects_(ss.getSheetByName(SHEETS.SKILL_ENHANCEMENTS))};
      claimMailsLockedV600_(id,sh,targets,rows,batch);
    }
  }finally{lock.releaseLock();}
  return {ok:true,mailbox:getMailboxFast_(id),inventory:getInventory(id),unreadMail:getUnreadMailCount_(id)};
}

function getAdminPassword_(){return String(PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD')||'');}
function verifyAdminPassword_(password){const expected=getAdminPassword_();if(!expected)throw new Error('尚未設定 ADMIN_PASSWORD。請到 Apps Script 專案設定的「指令碼屬性」新增 ADMIN_PASSWORD。');if(String(password)!==expected)throw new Error('老師密碼錯誤');return true;}
function adminLogin(password){verifyAdminPassword_(password);return {ok:true};}
function getAdminDataSecure(password){verifyAdminPassword_(password);return getAdminData();}
function adminAddCoins(password,studentId,amount,reason){verifyAdminPassword_(password);return addCoins(studentId,amount,reason);}
function adminGrantItem(password,studentId,itemId,quantity,reason){verifyAdminPassword_(password);return grantItem(studentId,itemId,quantity,reason);}
function adminAssignPet(password,studentId,petId){verifyAdminPassword_(password);return assignPetToStudent(studentId,petId);}


function ensureHeaders_(sh,headers){
  const current=sh.getLastColumn()?sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]:[];
  headers.forEach(h=>{
    if(!current.includes(h)){sh.getRange(1,sh.getLastColumn()+1).setValue(h);current.push(h);}
  });
}

function setupOrUpgradeV56(){
  setupOrUpgradeV55();
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.LANDS);
  ensureHeaders_(sh,['取得方式','兌換道具ID','兌換數量']);
  const hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(!vals[i][hm['土地ID']-1])continue;
    if(!vals[i][hm['取得方式']-1]) sh.getRange(i+1,hm['取得方式']).setValue('金幣');
  }
  clearGameConfigCache();
  return 'V5.6 升級完成';
}


function setupOrUpgradeV561(){
  setupOrUpgradeV56();
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.LANDS);
  ensureHeaders_(sh,['取得方式','兌換道具ID','兌換數量']);
  // 僅補空白取得方式為「金幣」；價格空白就維持空白，前後端都會阻止 0 元購買。
  const hm=headerMap_(sh),vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(!vals[i][hm['土地ID']-1])continue;
    if(!vals[i][hm['取得方式']-1])sh.getRange(i+1,hm['取得方式']).setValue('金幣');
  }
  clearGameConfigCache();
  return 'V5.6.1 升級完成';
}


/** ====================== V5.6.2 試算表下拉選單 / 勾選框 ====================== **/
function setupOrUpgradeV562(){
  setupOrUpgradeV561();
  setupSpreadsheetControlsV562_();
  clearGameConfigCache();
  return 'V5.6.2 升級完成：已建立下拉選單與勾選框';
}

function setupSpreadsheetControlsV562_(){
  const ss=SpreadsheetApp.getActive();

  // 共用工具
  const listRule_ = values => SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();

  const rangeRule_ = range => SpreadsheetApp.newDataValidation()
    .requireValueInRange(range, true)
    .setAllowInvalid(false)
    .build();

  const applyList_ = (sheetName, header, values, maxRows=1000) => {
    const sh=ss.getSheetByName(sheetName);
    if(!sh)return;
    const hm=headerMap_(sh);
    const col=hm[header];
    if(!col)return;
    sh.getRange(2,col,Math.max(1,maxRows-1),1).setDataValidation(listRule_(values));
  };

  const applyRange_ = (sheetName, header, sourceRange, maxRows=1000) => {
    const sh=ss.getSheetByName(sheetName);
    if(!sh)return;
    const hm=headerMap_(sh);
    const col=hm[header];
    if(!col)return;
    sh.getRange(2,col,Math.max(1,maxRows-1),1).setDataValidation(rangeRule_(sourceRange));
  };

  const applyCheckbox_ = (sheetName, header, maxRows=1000) => {
    const sh=ss.getSheetByName(sheetName);
    if(!sh)return;
    const hm=headerMap_(sh);
    const col=hm[header];
    if(!col)return;
    sh.getRange(2,col,Math.max(1,maxRows-1),1).insertCheckboxes();
  };

  // 1. 學生資料
  applyCheckbox_(SHEETS.STUDENTS,'是否啟用');

  // 2. 學生寵物
  applyCheckbox_(SHEETS.PETS,'是否目前顯示');

  // 3. 寵物設定
  applyCheckbox_(SHEETS.PET_CONFIG,'是否開放');
  applyList_(SHEETS.PET_CONFIG,'移動類型',['地面型','天空型']);

  // 4. 土地 / 背景設定
  applyCheckbox_(SHEETS.LANDS,'是否開放');
  applyList_(SHEETS.LANDS,'取得方式',['金幣','寶物']);

  // 兌換道具 ID 直接從「道具設定」A欄選，避免打錯 TRE001 / TRE002。
  const itemSh=ss.getSheetByName(SHEETS.ITEM_CONFIG);
  if(itemSh){
    const itemHm=headerMap_(itemSh);
    const itemIdCol=itemHm['道具ID'];
    if(itemIdCol){
      const sourceRange=itemSh.getRange(2,itemIdCol,Math.max(1,itemSh.getMaxRows()-1),1);
      applyRange_(SHEETS.LANDS,'兌換道具ID',sourceRange);
    }
  }

  // 5. 學生土地
  applyCheckbox_(SHEETS.STUDENT_LANDS,'是否擁有');
  applyCheckbox_(SHEETS.STUDENT_LANDS,'是否使用');

  // 6. 家具設定
  applyCheckbox_(SHEETS.FURNITURE,'是否開放');

  // 7. 道具設定
  applyList_(SHEETS.ITEM_CONFIG,'類型',['經驗型','寶物型']);
  applyCheckbox_(SHEETS.ITEM_CONFIG,'是否開放');

  // 8. 信箱
  applyList_(SHEETS.MAILBOX,'附件類型',['道具']);
  applyCheckbox_(SHEETS.MAILBOX,'是否領取');

  // 9. 挑戰題庫
  applyList_(SHEETS.QUESTIONS,'科目',['國語','數學','英文','自然','社會']);
  applyList_(SHEETS.QUESTIONS,'題型',['選擇題','是非題']);
  applyCheckbox_(SHEETS.QUESTIONS,'是否啟用');

  // 10. V5.5 / V5.6 新增表
  if(SHEETS.STUDENT_PLOTS){
    applyCheckbox_(SHEETS.STUDENT_PLOTS,'是否使用');
  }
  if(SHEETS.STUDENT_BACKGROUNDS){
    applyCheckbox_(SHEETS.STUDENT_BACKGROUNDS,'是否擁有');
  }

  // 美化：固定標題列，避免大量資料往下滑時看不到欄名。
  [
    SHEETS.STUDENTS,SHEETS.PETS,SHEETS.PET_CONFIG,SHEETS.LANDS,
    SHEETS.STUDENT_LANDS,SHEETS.FURNITURE,SHEETS.STUDENT_FURNITURE,
    SHEETS.ITEM_CONFIG,SHEETS.STUDENT_ITEMS,SHEETS.MAILBOX,
    SHEETS.QUESTIONS,SHEETS.CHALLENGES,SHEETS.REWARDS,
    SHEETS.STUDENT_PLOTS,SHEETS.STUDENT_BACKGROUNDS
  ].filter(Boolean).forEach(name=>{
    const sh=ss.getSheetByName(name);
    if(sh)sh.setFrozenRows(1);
  });
}


function setupOrUpgradeV57(){
  setupOrUpgradeV562();
  const ss=SpreadsheetApp.getActive();
  const sh=ensureSheet_(SHEETS.MONSTERS,['怪物ID','名稱','圖片','基礎HP','HP成長','出現科目','是否開放']);

  // 預設放一隻陽春怪物，之後可自行刪除或修改。
  if(sh.getLastRow()<2){
    sh.appendRow(['MON001','訓練史萊姆','',100,25,'全部',true]);
  }

  // 下拉選單 / 勾選框
  const hm=headerMap_(sh);
  if(hm['出現科目']){
    sh.getRange(2,hm['出現科目'],Math.max(1,sh.getMaxRows()-1),1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['全部','國語','數學','英文','自然','社會'],true)
          .setAllowInvalid(false)
          .build()
      );
  }
  if(hm['是否開放']){
    sh.getRange(2,hm['是否開放'],Math.max(1,sh.getMaxRows()-1),1).insertCheckboxes();
  }
  sh.setFrozenRows(1);
  clearGameConfigCache();
  return 'V5.7 升級完成：已新增怪物設定';
}

function getMonsterCatalogFresh(){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.MONSTERS);
  if(!sh)return [];
  const rows=readObjects_(sh).filter(x=>x['是否開放']!==false);
  return safeForClient_(rows.map(x=>({
    monsterId:String(x['怪物ID']||''),
    name:String(x['名稱']||x['怪物ID']||'怪物'),
    image:String(x['圖片']||''),
    baseHp:Number(x['基礎HP']||100),
    hpGrowth:Number(x['HP成長']||25),
    subject:String(x['出現科目']||'全部'),
    enabled:x['是否開放']!==false
  })));
}


function setupOrUpgradeV59(){
  setupOrUpgradeV57();
  const ss=SpreadsheetApp.getActive();
  const attrs=['光','地','暗','草','水','毒','火','電','冰','風','鋼','混沌'];

  const qsh=ss.getSheetByName(SHEETS.QUESTIONS);
  ensureHeaders_(qsh,['單元','圖片ID','圖片路徑']);

  const petCfg=ss.getSheetByName(SHEETS.PET_CONFIG);
  ensureHeaders_(petCfg,['屬性']);
  const ph=headerMap_(petCfg);
  petCfg.getRange(2,ph['屬性'],Math.max(1,petCfg.getMaxRows()-1),1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(attrs,true).setAllowInvalid(false).build());

  const bg=ensureSheet_(SHEETS.BATTLE_BACKGROUNDS,['背景ID','名稱','圖片','適用科目','是否開放']);
  const bh=headerMap_(bg);
  bg.getRange(2,bh['適用科目'],Math.max(1,bg.getMaxRows()-1),1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['全部','國語','數學','英文','自然','社會'],true).setAllowInvalid(false).build());
  bg.getRange(2,bh['是否開放'],Math.max(1,bg.getMaxRows()-1),1).insertCheckboxes();

  const pb=ensureSheet_(SHEETS.PET_BATTLE,['寵物代碼','屬性','專屬技能','專屬技能傷害']);
  const pbh=headerMap_(pb);
  pb.getRange(2,pbh['屬性'],Math.max(1,pb.getMaxRows()-1),1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(attrs,true).setAllowInvalid(false).build());
  if(ph['寵物ID']){
    const src=petCfg.getRange(2,ph['寵物ID'],Math.max(1,petCfg.getMaxRows()-1),1);
    pb.getRange(2,pbh['寵物代碼'],Math.max(1,pb.getMaxRows()-1),1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(src,true).setAllowInvalid(false).build());
  }

  if(pb.getLastRow()<2){
    const pets=readObjects_(petCfg).filter(x=>String(x['寵物ID']||'').trim());
    if(pets.length){
      const rows=pets.map(x=>[String(x['寵物ID']),String(x['屬性']||'光'),'','']);
      pb.getRange(2,1,rows.length,4).setValues(rows);
    }
  }

  petCfg.setFrozenRows(1);bg.setFrozenRows(1);pb.setFrozenRows(1);
  clearGameConfigCache();
  try{CacheService.getScriptCache().remove('FAST_PET_BATTLE');}catch(e){}
  return 'V5.9.2 升級完成：技能表已簡化';
}
function setupOrUpgradeV592(){ return setupOrUpgradeV59(); }
function setupOrUpgradeV593(){ const r=setupOrUpgradeV59(); clearGameConfigCache(); return 'V5.9.3 升級完成：挑戰題庫已支援圖片'; }
function setupOrUpgradeV594(){ const r=setupOrUpgradeV593(); clearGameConfigCache(); return 'V5.9.4 升級完成：題目圖片路徑已加強'; }

function getBattleBackgroundCatalogFast(){
  const c=CacheService.getScriptCache(),key='FAST_BATTLE_BG';
  const hit=c.get(key);if(hit){try{return JSON.parse(hit);}catch(e){}}
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.BATTLE_BACKGROUNDS);
  const rows=!sh?[]:readObjects_(sh).filter(x=>x['是否開放']!==false).map(x=>({
    bgId:String(x['背景ID']||''),name:String(x['名稱']||x['背景ID']||''),image:String(x['圖片']||''),subject:String(x['適用科目']||'全部'),enabled:x['是否開放']!==false
  }));
  try{c.put(key,JSON.stringify(rows),300);}catch(e){}
  return safeForClient_(rows);
}
function getPetBattleConfigFast(){
  const c=CacheService.getScriptCache(),key='FAST_PET_BATTLE';
  const hit=c.get(key);if(hit){try{return JSON.parse(hit);}catch(e){}}
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PET_BATTLE);
  if(!sh)return [];
  const rows=readObjects_(sh).filter(x=>String(x['寵物代碼']||'').trim()).map(x=>({
    petId:String(x['寵物代碼']||''),attribute:String(x['屬性']||'光'),specialName:String(x['專屬技能']||''),specialDamage:Number(x['專屬技能傷害']||0)
  }));
  try{c.put(key,JSON.stringify(rows),300);}catch(e){}
  return safeForClient_(rows);
}

/** ====================== /V5.5 ======================== */

/**
 * V5 GitHub Pages API endpoint.
 * 部署方式：執行身分=我；存取權=任何人。
 * 前端以 text/plain POST，避免瀏覽器 OPTIONS preflight。
 */

/** ======================== V5.9.6 HIGH SPEED ======================== */


/**
 * V5.10.4 固定學生登入名單
 * 只在這裡驗證「學號 + 生日(月/日)」，登入時不再掃描「學生資料」工作表。
 * 若日後學生帳號或生日有變動，直接修改這裡即可。
 */
const STATIC_STUDENT_LOGIN_V5104 = Object.freeze({
  '50501':'09/08','50502':'10/13','50503':'10/16','50504':'10/23','50505':'11/09',
  '50506':'12/01','50507':'01/25','50508':'02/11','50509':'02/12','50510':'02/25',
  '50511':'03/02','50512':'03/12','50513':'04/11','50514':'05/28','50515':'09/06',
  '50516':'09/26','50517':'10/17','50518':'11/02','50519':'02/22','50520':'03/03',
  '50522':'03/21','50523':'04/07','50524':'07/01','50525':'06/03','50526':'02/06'
});

/** 快速登入：只驗證學生，不讀寵物/土地/信箱/題庫。 */
function loginFastV596(studentId,birthdayMD){
  const id=String(studentId||'').trim();
  const wanted=normalizeMonthDay_(birthdayMD);
  const expected=STATIC_STUDENT_LOGIN_V5104[id]||'';
  if(!expected || wanted!==expected){
    return {ok:false,message:'學號或生日（月/日）不正確'};
  }
  return safeForClient_({
    ok:true,name:id,coins:0,version:APP_VERSION,authToken:createStudentSessionV600_(id),
    state:{
      ok:true,version:APP_VERSION,
      student:{id:id,name:id,coins:0},
      pets:[],lands:[],backgrounds:[],activeLandId:'',furniture:[],
      unreadMail:0,challengeStatus:{}
    }
  });
}

const QUESTION_SUBJECTS_V610=['國語','數學','英文','自然','社會'];
const QUESTION_HEADERS_V610=['題目ID','科目','題型','題目','選項A','選項B','選項C','選項D','答案','解析','是否啟用','單元','圖片ID','圖片路徑'];
const QUESTION_CACHE_TTL_V610=21600;
function questionSubjectV610_(subject){
  const s=String(subject||'').trim();if(!QUESTION_SUBJECTS_V610.includes(s))throw new Error('科目無效');return s;
}
function questionCacheBaseV610_(subject){
  return 'question-bank:'+subject+':v610:'+(PropertiesService.getScriptProperties().getProperty('QUESTION_REV_V610:'+subject)||'0');
}
function clearSubjectQuestionCacheV610_(subject){
  const s=questionSubjectV610_(subject),lock=LockService.getScriptLock(),owned=lock.hasLock();
  if(!owned)lock.waitLock(12000);
  try{
    const c=CacheService.getScriptCache();
    c.remove(questionCacheBaseV610_(s)+':meta');
    PropertiesService.getScriptProperties().setProperty('QUESTION_REV_V610:'+s,Utilities.getUuid());
    c.remove('QUESTION_SUBJECT_V5106_DISPLAY:'+s);c.remove('QUESTION_BANK_V5106_DISPLAY');c.remove('QUESTION_COUNTS_V5101');
  }finally{if(!owned)lock.releaseLock();}
}
function adminRefreshQuestionBankV610(password,subject){
  verifyAdminPassword_(password);const s=questionSubjectV610_(subject);
  clearSubjectQuestionCacheV610_(s);return {ok:true,subject:s};
}
function onEdit(e){
  const name=e?.range?.getSheet()?.getName();
  const subject=QUESTION_SUBJECTS_V610.find(s=>name==='題庫_'+s);
  if(subject)clearSubjectQuestionCacheV610_(subject);
}
function readQuestionSheetDisplayV610_(sh){
  if(!sh||!sh.getLastRow()||!sh.getLastColumn())return [];
  const values=sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getDisplayValues();
  const headers=values[0].map(h=>String(h).trim());
  return values.slice(1).filter(r=>r.some(v=>String(v).trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
function subjectQuestionRowsV610_(subject){
  const s=questionSubjectV610_(subject),c=CacheService.getScriptCache();
  const readCache=()=>{
    try{
      const base=questionCacheBaseV610_(s),meta=JSON.parse(c.get(base+':meta')||'null');if(!meta)return null;
      let json='';for(let i=0;i<meta.parts;i++){const part=c.get(base+':'+meta.generation+':'+i);if(part===null)return null;json+=part;}
      return JSON.parse(json);
    }catch(e){return null;}
  };
  const hit=readCache();if(hit)return hit;
  const lock=LockService.getScriptLock(),owned=lock.hasLock();if(!owned)lock.waitLock(12000);
  try{
    const second=readCache();if(second)return second;
    const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName('題庫_'+s);
    // Old deployments remain readable until migration; migrated subjects never read the total bank.
    const source=sh?readQuestionSheetDisplayV610_(sh).map(q=>({...q,'科目':String(q['科目']||'').trim()||s})):readQuestionObjectsDisplay_();
    const seen=new Set(),rows=source.filter(q=>{
      const id=String(q['題目ID']||'').trim();if(!id||String(q['科目']||'').trim()!==s||seen.has(id))return false;seen.add(id);return true;
    });
    const base=questionCacheBaseV610_(s),generation=Utilities.getUuid(),json=JSON.stringify(rows);let parts=0;
    try{
      for(let offset=0;offset<json.length;){let end=Math.min(offset+20000,json.length);if(end<json.length&&/[\uD800-\uDBFF]/.test(json[end-1]))end--;c.put(base+':'+generation+':'+parts++,json.slice(offset,end),QUESTION_CACHE_TTL_V610);offset=end;}
      c.put(base+':meta',JSON.stringify({generation,parts}),QUESTION_CACHE_TTL_V610);
    }catch(e){}
    PropertiesService.getScriptProperties().setProperty('QUESTION_COUNT_V610:'+s,String(rows.filter(questionEnabled_).length));
    c.remove('QUESTION_COUNTS_V5101');
    return rows;
  }finally{if(!owned)lock.releaseLock();}
}
function getQuestionBatchV610(subject,batchSize,excludeIds){
  const s=questionSubjectV610_(subject),limit=Math.max(20,Math.min(30,Math.floor(Number(batchSize)||25)));
  if(excludeIds!=null&&(!Array.isArray(excludeIds)||excludeIds.length>20000))throw new Error('排除題目清單無效');
  const all=getQuestionBankSubjectFast(s),exclude=new Set((excludeIds||[]).map(String));
  const pool=all.filter(q=>!exclude.has(q.id));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  // No automatic recycling: the client only starts a new cycle after its current queue is exhausted.
  return {subject:s,questions:pool.slice(0,limit),total:all.length,remaining:Math.max(0,pool.length-limit)};
}
function setupOrMigrateSubjectQuestionBanksV610(){
  requireMailSheetsServiceV600_();
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const ss=SpreadsheetApp.getActive(),source=readQuestionObjectsDisplay_(),extra=Array.from(new Set(source.flatMap(q=>Object.keys(q))));
    const report=[];
    for(const s of QUESTION_SUBJECTS_V610){
      const sh=ensureSheet_('題庫_'+s,QUESTION_HEADERS_V610.concat(extra.filter(h=>!QUESTION_HEADERS_V610.includes(h))));
      const headers=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(String),existing=readQuestionSheetDisplayV610_(sh),ids=new Set(existing.map(q=>String(q['題目ID'])));
      const added=[];for(const q of source){const id=String(q['題目ID']||'');if(!id||String(q['科目']||'').trim()!==s||ids.has(id))continue;ids.add(id);added.push(headers.map(h=>String(q[h]??'')));}
      if(added.length){
        const start=sh.getLastRow()+1,needed=start+added.length-1;
        if(needed>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),needed-sh.getMaxRows());
        // Explicit string cells prevent fractions (2/3), dates and leading '=' text becoming formulas.
        Sheets.Spreadsheets.batchUpdate({requests:[{updateCells:{start:{sheetId:sh.getSheetId(),rowIndex:start-1,columnIndex:0},rows:added.map(r=>({values:r.map(v=>({userEnteredValue:{stringValue:v}}))})),fields:'userEnteredValue'}}]},ss.getId());
      }
      clearSubjectQuestionCacheV610_(s);
      PropertiesService.getScriptProperties().setProperty('QUESTION_COUNT_V610:'+s,String(existing.concat(added.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])))).filter(questionEnabled_).length));
      report.push({subject:s,sheet:'題庫_'+s,added:added.length});
    }
    return {ok:true,subjects:report};
  }finally{lock.releaseLock();}
}

/** Legacy total-bank reader is retained for migration and pre-migration compatibility only. */
function readQuestionObjectsDisplay_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.QUESTIONS);
  if(!sh)return [];
  const vals=sh.getDataRange().getDisplayValues();
  if(!vals.length)return [];
  const headers=vals[0].map(h=>String(h).trim());
  const out=[];
  for(let r=1;r<vals.length;r++){
    if(!vals[r].some(v=>String(v).trim()!==''))continue;
    const o={};
    headers.forEach((h,c)=>o[h]=vals[r][c]);
    out.push(o);
  }
  return out;
}
// 題目、選項及答案均保留 Sheet 顯示文字，不把日期型儲存值轉成 Date 字串。
// 無法從已變成日期的資料可靠推回原始分數；不猜測或改寫學生／題庫資料。
function cachedQuestionObjectsDisplay_(){
  const c=CacheService.getScriptCache(),key='QUESTION_DISPLAY_V5106_STABILITY';
  const hit=c.get(key);if(hit){try{return JSON.parse(hit);}catch(e){}}
  const rows=readQuestionObjectsDisplay_();
  try{c.put(key,JSON.stringify(rows),600);}catch(e){}
  return rows;
}
function questionEnabled_(row){
  return !['FALSE','否','0'].includes(String(row['是否啟用']??'').trim().toUpperCase());
}
function getQuestionBankSubjectFast(subject){
  const s=String(subject||'').trim();
  if(!['國語','數學','英文','自然','社會'].includes(s))return [];
  const rows=subjectQuestionRowsV610_(s).filter(questionEnabled_);

  const out=rows.map(x=>{
    const qi=resolveQuestionImage_(x);
    return {
      id:String(x['題目ID']||''),
      subject:s,
      unit:String(x['單元']||''),
      type:String(x['題型']||'選擇題'),
      text:String(x['題目']||''),
      options:[x['選項A'],x['選項B'],x['選項C'],x['選項D']].filter(v=>v!==''&&v!=null),
      answer:String(x['答案']||''),
      explanation:String(x['解析']||''),
      imageId:qi.imageId,
      image:qi.image
    };
  });

  return safeForClient_(out);
}

function getQuestionBankBundleFast(){
  const c=CacheService.getScriptCache(),key='QUESTION_BANK_V5106_DISPLAY';
  const hit=c.get(key);if(hit){try{return JSON.parse(hit);}catch(e){}}
  const out={'國語':[],'數學':[],'英文':[],'自然':[],'社會':[]};
  const rows=QUESTION_SUBJECTS_V610.flatMap(subjectQuestionRowsV610_).filter(questionEnabled_);
  rows.forEach(x=>{
    const s=String(x['科目']||'');if(!out[s])return;
    const qi=resolveQuestionImage_(x);
    out[s].push({
      id:String(x['題目ID']),subject:s,unit:String(x['單元']||''),type:String(x['題型']||'選擇題'),text:String(x['題目']||''),
      options:[x['選項A'],x['選項B'],x['選項C'],x['選項D']].filter(v=>v!==''&&v!=null),
      answer:String(x['答案']||''),explanation:String(x['解析']||''),
      imageId:qi.imageId,image:qi.image
    });
  });
  try{c.put(key,JSON.stringify(out),600);}catch(e){}
  return safeForClient_(out);
}

/** 只讀挑戰狀態，不建立紀錄。 */
function getAllChallengeStatusFastV596(studentId){
  const id=String(studentId||'').trim(),period=challengePeriodKey_(new Date()),subjects=['國語','數學','英文','自然','社會'];
  const rows=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.CHALLENGES))
    .filter(x=>String(x['週期'])===period && String(x['學號']).trim()===id);
  const out={};
  subjects.forEach(s=>{
    const r=rows.find(x=>String(x['科目'])===s);
    out[s]=r?challengeStatusFromObj_(r):{correct:0,wrong:0,exp:0,locked:false};
  });
  return out;
}

/** 登入後背景只打一支 API：完整小屋 + 共用設定 + 題庫 + 挑戰狀態。 */
function getPostLoginBundleV596(studentId){
  const id=String(studentId||'').trim();
  // 不在這裡補整點禮物，避免登入後背景載入被 mailbox 寫入拖慢；
  // 原有 45 秒背景信箱更新仍會補禮物。
  const core=getStudentCoreStateV55_(id);
  const runtime=safeForClient_({
    mailbox:getMailboxFast_(id),
    unreadMail:getUnreadMailCountFast_(id),
    inventory:getInventory(id)
  });
  return safeForClient_({
    core:core,
    runtime:runtime,
    challengeStatus:getAllChallengeStatusFastV596(id)
  });
}

/** 老師發道具：以 row cache 直接定位，不再每次額外讀學生資料。 */
function adminGrantItemFast(password,studentId,itemId,quantity,reason){
  verifyAdminPassword_(password);
  if(attributeStoneV600_(itemId))return adminGrantItemFastLockedMailV600_(password,studentId,itemId,quantity,reason);
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
  assertNoPendingStoneMailV600_(String(studentId).trim(),String(itemId));
    return adminGrantItemFastLockedMailV600_(password,studentId,itemId,quantity,reason);
  }finally{lock.releaseLock();}
}
function adminGrantItemFastLockedMailV600_(password,studentId,itemId,quantity,reason){
  verifyAdminPassword_(password);
  if(attributeStoneV600_(itemId)){
    const r=grantAttributeStonesV600_([studentId],itemId,quantity,reason);
    return {ok:true,itemId:String(itemId),quantity:r.quantities[String(studentId).trim()]};
  }
  const id=String(studentId||'').trim(), iid=String(itemId||'').trim(), qty=Math.max(1,Number(quantity||1));
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(SHEETS.STUDENT_ITEMS),hm=headerMapFast_(sh);
  const c=CacheService.getScriptCache(),ck='ITEMROW_V596:'+id+':'+iid;
  let row=Number(c.get(ck)||0), current=0;

  if(row>1 && row<=sh.getLastRow()){
    const vals=sh.getRange(row,1,1,sh.getLastColumn()).getValues()[0];
    if(String(vals[hm['學號']-1]).trim()===id && String(vals[hm['道具ID']-1])===iid){
      current=Number(vals[hm['數量']-1]||0);
    }else row=0;
  }
  if(!row){
    const vals=sh.getDataRange().getValues();
    for(let i=1;i<vals.length;i++){
      if(String(vals[i][hm['學號']-1]).trim()===id && String(vals[i][hm['道具ID']-1])===iid){
        row=i+1;current=Number(vals[i][hm['數量']-1]||0);break;
      }
    }
  }
  if(row){
    sh.getRange(row,hm['數量']).setValue(current+qty);
  }else{
    row=sh.getLastRow()+1;
    const newRow=Array(sh.getLastColumn()).fill('');
    newRow[hm['學號']-1]=id;newRow[hm['道具ID']-1]=iid;newRow[hm['數量']-1]=qty;
    sh.getRange(row,1,1,newRow.length).setValues([newRow]);
  }
  try{c.put(ck,String(row),21600);}catch(e){}

  // 獎勵紀錄只寫一列，不再先 getStudent_。
  const rewards=ss.getSheetByName(SHEETS.REWARDS),rhm=headerMapFast_(rewards);
  const rr=Array(rewards.getLastColumn()).fill('');
  if(rhm['時間'])rr[rhm['時間']-1]=new Date();
  if(rhm['學號'])rr[rhm['學號']-1]=id;
  if(rhm['原因'])rr[rhm['原因']-1]=(reason||'老師發放')+'：'+iid+' ×'+qty;
  // 相容舊獎勵表：找不到表頭時才用既有 6 欄排列。
  if(!rhm['學號'] && rewards.getLastColumn()>=6){
    rr[0]=new Date();rr[1]=id;rr[5]=(reason||'老師發放')+'：'+iid+' ×'+qty;
  }
  rewards.getRange(rewards.getLastRow()+1,1,1,rr.length).setValues([rr]);
  return {ok:true,itemId:iid,quantity:current+qty};
}

/** V5.9.6 精簡 setup：不再連鎖 V593/V59/V57。 */
function setupOrUpgradeV5961(){
  const r=setupOrUpgradeV596();
  try{const c=CacheService.getScriptCache();['國語','數學','英文','自然','社會'].forEach(s=>c.remove('QUESTION_SUBJECT_V5961:'+s));}catch(e){}
  return 'V5.9.6.1 題庫單科載入修正完成';
}

function setupOrUpgradeV596(){
  const ss=SpreadsheetApp.getActive();
  const qsh=ss.getSheetByName(SHEETS.QUESTIONS);
  if(qsh)ensureHeaders_(qsh,['單元','圖片ID','圖片路徑']);
  try{
    const c=CacheService.getScriptCache();
    ['AUTH_STUDENTS_V596','QUESTION_BANK_V596','FAST_BG_CATALOG','FAST_MONSTER_CATALOG','FAST_BATTLE_BG','FAST_PET_BATTLE'].forEach(k=>c.remove(k));
    ['國語','數學','英文','自然','社會'].forEach(s=>c.remove('QUESTION_SUBJECT_V5961:'+s));
  }catch(e){}
  try{clearGameConfigCache();}catch(e){}
  return 'V5.9.6 高速版升級完成';
}


/** ======================== V5.9.7 STATIC CATALOGS ======================== */
function getPetCatalogFastV598(){
  return cachedObjects_(SHEETS.PET_CONFIG,21600)
    .filter(x=>x['是否開放']!==false && String(x['是否開放']).toUpperCase()!=='FALSE')
    .map(x=>({
      petId:String(x['寵物ID']||''),
      name:String(x['名稱']||x['寵物ID']||''),
      stage1:String(x['第一階圖片']||'').replace(/\\/g,'/'),
      stage2:String(x['第二階圖片']||'').replace(/\\/g,'/'),
      stage3:String(x['第三階圖片']||'').replace(/\\/g,'/'),
      stage2Level:Number(x['第二階需求等級']||10),
      stage3Level:Number(x['第三階需求等級']||25),
      price:Number(x['取得價格']||0),
      enabled:x['是否開放']!==false,
      moveType:String(x['移動類型']||'地面型'),
      attribute:String(x['屬性']||'光'),
      dialogues:[
        String(x['對話1']||'今天也一起努力吧！'),
        String(x['對話2']||'我喜歡這裡～'),
        String(x['對話3']||'一起變強吧！')
      ]
    }));
}

function getItemCatalogFastV598(){
  return cachedObjects_(SHEETS.ITEM_CONFIG,21600)
    .filter(x=>x['是否開放']!==false && String(x['是否開放']).toUpperCase()!=='FALSE')
    .map(x=>({
      itemId:String(x['道具ID']||''),
      name:String(x['名稱']||x['道具ID']||''),
      type:String(x['類型']||''),
      effect:Number(x['效果值']||0),
      image:String(x['圖片']||'').replace(/\\/g,'/'),
      description:String(x['說明']||''),
      enabled:x['是否開放']!==false
    }));
}

function getStaticCatalogBundleV598(forceRefresh){
  const c=CacheService.getScriptCache(),key='STATIC_CATALOG_BUNDLE_V598';
  if(!forceRefresh){
    const hit=c.get(key);
    if(hit){try{return JSON.parse(hit);}catch(e){}}
  }
  const lock=LockService.getScriptLock();
  let locked=false;
  if(!forceRefresh){
    try{lock.waitLock(8000);locked=true;}catch(e){
      const retry=c.get(key);
      if(retry){try{return JSON.parse(retry);}catch(x){}}
    }
  }
  try{
    if(!forceRefresh){
      const hit2=c.get(key);
      if(hit2){try{return JSON.parse(hit2);}catch(e){}}
    }
    const out=safeForClient_({
      pets:getPetCatalogFastV598(),
      lands:getBackgroundCatalogCached_(),
      monsters:getMonsterCatalogCached_(),
      battleBackgrounds:getBattleBackgroundCatalogFast(),
      petBattleConfigs:getPetBattleConfigFast(),
      items:getItemCatalogFastV598()
    });
    try{
      const txt=JSON.stringify(out);
      if(txt.length<95000)c.put(key,txt,21600);
    }catch(e){}
    return out;
  }finally{
    if(locked){try{lock.releaseLock();}catch(e){}}
  }
}

// 舊 V5.9.7 API 保留相容性，但資料仍由試算表產生。
function getStaticCatalogBundleV597(){ return getStaticCatalogBundleV598(false); }

function clearAllGameConfigCacheV598_(){
  QUESTION_SUBJECTS_V610.forEach(clearSubjectQuestionCacheV610_);
  const c=CacheService.getScriptCache();
  clearFurnitureCacheV610_();

  // cachedObjects_ 使用的 Sheet 設定快取
  [
    SHEETS.PET_CONFIG,SHEETS.LANDS,SHEETS.FURNITURE,SHEETS.ITEM_CONFIG,
    SHEETS.QUESTIONS,SHEETS.MONSTERS,SHEETS.BATTLE_BACKGROUNDS,SHEETS.PET_BATTLE
  ].forEach(n=>{try{c.remove('CFG_'+n);}catch(e){}});

  [
    'STATIC_CATALOG_BUNDLE_V598','STATIC_CATALOG_BUNDLE_V597',
    'FAST_BG_CATALOG','FAST_MONSTER_CATALOG','FAST_BATTLE_BG','FAST_PET_BATTLE',
    'QUESTION_BANK_V596','QUESTION_COUNTS_V5101',
    'QUESTION_DISPLAY_V5106_STABILITY','QUESTION_BANK_V5106_DISPLAY'
  ].forEach(k=>{try{c.remove(k);}catch(e){}});

  ['國語','數學','英文','自然','社會'].forEach(s=>{
    try{c.remove('QUESTION_SUBJECT_V5961:'+s);}catch(e){}
    try{c.remove('QUESTION_SUBJECT_V5100:'+s);}catch(e){}
    try{c.remove('QUESTION_SUBJECT_V5106_DISPLAY:'+s);}catch(e){}
  });
}

function adminRefreshGameConfigV598(password){
  verifyAdminPassword_(password);
  clearAllGameConfigCacheV598_();

  // 清完後立即從 Google Sheet 重建一次，第一位學生不必承擔重建時間。
  const catalog=getStaticCatalogBundleV598(true);

  return safeForClient_({
    ok:true,
    updatedAt:Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Taipei','yyyy/MM/dd HH:mm:ss'),
    catalog:catalog
  });
}

function setupOrUpgradeV598(){
  const ss=SpreadsheetApp.getActive();
  const qsh=ss.getSheetByName(SHEETS.QUESTIONS);
  if(qsh)ensureHeaders_(qsh,['單元','圖片ID','圖片路徑']);

  clearAllGameConfigCacheV598_();
  // 先建立一次共用設定快取。
  getStaticCatalogBundleV598(true);

  return 'V5.9.8 完成：Google 試算表已成為唯一設定來源';
}



/** ======================== V5.9.9 TEACHER / BATCH ======================== */
function adminAddCoinsFastV599(password,studentId,amount,reason){
  verifyAdminPassword_(password);
  return assetWriteLockV610_(()=>{
  assertNoPendingAdminGrantV610_(String(studentId).trim(),'COINS');
  const n=Math.max(1,Number(amount||0));
  const f=findStudentRow_(studentId);if(!f)throw new Error('找不到學生');
  const newCoins=Number(f.obj['金幣']||0)+n;
  f.sheet.getRange(f.row,f.hm['金幣']).setValue(newCoins);
  SpreadsheetApp.getActive().getSheetByName(SHEETS.REWARDS)
    .appendRow([new Date(),studentId,f.obj['姓名'],n,0,reason||'老師發放']);
  return {ok:true,coins:newCoins};
  });
}

/** V6.1 Phase 2：沿用獎勵紀錄作為永久批次收據，不建立另一套資產表。 */
const ADMIN_BATCH_HEADERS_V610=['老師批次ID','老師批次內容','老師批次狀態','老師批次結果'];
function setupAdminBatchV610(){
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    ensureSheet_(SHEETS.REWARDS,['時間','學號','姓名','金幣變動','EXP變動','原因'].concat(ADMIN_BATCH_HEADERS_V610));
    CacheService.getScriptCache().remove('ADMIN_PENDING_V610');
    return '老師批次發放欄位已補齊；未發放或重設任何資產';
  }finally{lock.releaseLock();}
}
// 已持鎖的商店與舊 API 不重複取鎖；舊單人發金幣亦與批次共用鎖。
function assetWriteLockV610_(work){
  const lock=LockService.getScriptLock(),owned=lock.hasLock();
  if(!owned)lock.waitLock(12000);
  try{return work();}finally{if(!owned){try{SpreadsheetApp.flush();}finally{lock.releaseLock();}}}
}
function pendingAdminGrantsV610_(){
  const cache=CacheService.getScriptCache();if(cache.get('ADMIN_PENDING_V610')==='NONE')return [];
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.REWARDS),hm=sh?headerMap_(sh):{};
  if(!hm['老師批次狀態']||sh.getLastRow()<2)return [];
  const states=sh.getRange(2,hm['老師批次狀態'],sh.getLastRow()-1,1).getValues(),pending=[];
  states.forEach((r,i)=>{if(r[0]==='SUBMITTED'){
    const row=rowObject_(sh,sh.getRange(i+2,1,1,sh.getLastColumn()).getValues()[0]);
    pending.push({requestId:String(row['老師批次ID']),payload:JSON.parse(String(row['老師批次內容'])),result:JSON.parse(String(row['老師批次結果']))});
  }});
  if(!pending.length)cache.put('ADMIN_PENDING_V610','NONE',300);
  return pending;
}
function assertNoPendingAdminGrantV610_(studentId,mode,itemId){
  if(pendingAdminGrantsV610_().some(p=>p.payload.mode===mode&&(mode!=='ITEMS'||p.payload.itemId===String(itemId))&&p.result.results.some(r=>r.ok&&!r.skipped&&r.studentId===studentId)))throw new Error('老師批次發放尚未確認；請先重試原批次，確認前不能變更同一資產');
}
function adminBatchReceiptV610_(sh,hm,requestId){
  if(sh.getLastRow()<2)return null;
  const ids=sh.getRange(2,hm['老師批次ID'],sh.getLastRow()-1,1).getValues();
  const index=ids.findIndex(r=>String(r[0])===requestId);
  return index<0?null:{...rowObject_(sh,sh.getRange(index+2,1,1,sh.getLastColumn()).getValues()[0]),_row:index+2};
}
function adminColumnNameV610_(number){let out='';while(number>0){number--;out=String.fromCharCode(65+number%26)+out;number=Math.floor(number/26);}return out;}
// 必要欄位一次 Values.batchGet，不依學生逐一定位範圍。
function adminReadColumnsV610_(sheets){
  const specs=[],ranges=[];
  sheets.forEach(({sh,keys})=>{
    const hm=headerMap_(sh),count=Math.max(0,sh.getLastRow()-1),spec={sh,hm,keys,count,start:ranges.length};specs.push(spec);
    if(count)keys.forEach(key=>{if(!hm[key])throw new Error('缺少欄位：'+sh.name+' '+key);const col=adminColumnNameV610_(hm[key]);ranges.push("'"+sh.getName().replace(/'/g,"''")+"'!"+col+'2:'+col+(count+1));});
  });
  const values=ranges.length?Sheets.Spreadsheets.Values.batchGet(SpreadsheetApp.getActive().getId(),{ranges,valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges:[];
  return specs.map(spec=>({sh:spec.sh,hm:spec.hm,rows:Array.from({length:spec.count},(_,i)=>{
    const row={_row:i+2};spec.keys.forEach((key,j)=>row[key]=values[spec.start+j]?.values?.[i]?.[0]??'');return row;
  })}));
}
function adminRowsRequestV610_(sh,row,col,values){
  return {updateCells:{start:{sheetId:sh.getSheetId(),rowIndex:row-1,columnIndex:col-1},rows:values.map(r=>({values:r.map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:String(value)}}))})),fields:'userEnteredValue'}};
}
function adminChangeRequestsV610_(changes){
  const groups=[];
  changes.sort((a,b)=>a.sh.getSheetId()-b.sh.getSheetId()||a.col-b.col||a.row-b.row).forEach(c=>{
    const last=groups[groups.length-1];
    if(last&&last.sh===c.sh&&last.col===c.col&&last.row+last.values.length===c.row)last.values.push([c.value]);
    else groups.push({sh:c.sh,row:c.row,col:c.col,values:[[c.value]]});
  });
  return groups.map(g=>adminRowsRequestV610_(g.sh,g.row,g.col,g.values));
}
function adminEnsureRowsV610_(sh,required){
  const max=sh.getMaxRows();if(required>max)sh.insertRowsAfter(max,required-max);
}
function grantCoinsBatchV610(password,entries,requestId,reason){return grantAdminBatchV610_(password,'COINS','',entries,requestId,reason);}
function grantItemsBatchV610(password,itemId,entries,requestId,reason){return grantAdminBatchV610_(password,'ITEMS',String(itemId||'').trim(),entries,requestId,reason);}
function grantAdminBatchV610_(password,mode,itemId,entries,requestId,reason){
  verifyAdminPassword_(password);
  const rid=String(requestId||''),field=mode==='COINS'?'amount':'quantity';
  if(!/^[A-Za-z0-9-]{16,100}$/.test(rid)||!Array.isArray(entries)||!entries.length||entries.length>100)return {ok:false,retryable:false,message:'批次編號或學生清單無效'};
  const payload={mode,itemId,reason:String(reason||'老師批次發放').slice(0,200),entries:entries.map(r=>({studentId:String(r?.studentId||'').trim(),value:String(r?.[field]??'')}))},content=JSON.stringify(payload);
  if(content.length>30000)return {ok:false,retryable:false,message:'批次內容過長'};
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const ss=SpreadsheetApp.getActive(),rewards=ss.getSheetByName(SHEETS.REWARDS),rh=headerMap_(rewards);
    if(ADMIN_BATCH_HEADERS_V610.some(h=>!rh[h]))return {ok:false,retryable:false,message:'請先執行 setupAdminBatchV610()'};
    const existing=adminBatchReceiptV610_(rewards,rh,rid);
    if(existing){
      if(String(existing['老師批次內容'])!==content)return {ok:false,retryable:false,message:'同一 requestId 的內容不可變更'};
      const result=JSON.parse(String(existing['老師批次結果']));
      if(existing['老師批次狀態']==='COMMITTED')return {...result,replayed:true};
      return adminUnconfirmedResultV610_(result);
    }
    if(pendingAdminGrantsV610_().length)return {ok:false,retryable:true,message:'請先確認上一筆老師批次；不會建立新的發放交易'};
    requireMailSheetsServiceV600_();
    const studentSheet=ss.getSheetByName(SHEETS.STUDENTS),itemSheet=ss.getSheetByName(SHEETS.STUDENT_ITEMS);
    const specs=[{sh:studentSheet,keys:mode==='COINS'?['學號','姓名','金幣']:['學號','姓名']}];
    if(mode==='ITEMS'){
      specs.push({sh:itemSheet,keys:['學號','道具ID','數量']},{sh:ss.getSheetByName(SHEETS.MAILBOX),keys:['學號','信件ID','附件ID','附件數量','是否領取','領取交易']});
      if(attributeStoneV600_(itemId))specs.push({sh:ss.getSheetByName(SHEETS.SKILL_ENHANCEMENTS),keys:['學號','狀態']});
    }
    const data=adminReadColumnsV610_(specs),students=new Map(),duplicates=new Set();
    data[0].rows.forEach(r=>{const id=String(r['學號']).trim();if(students.has(id))duplicates.add(id);students.set(id,r);});
    const counts=new Map();payload.entries.forEach(r=>counts.set(r.studentId,(counts.get(r.studentId)||0)+1));
    const catalog=mode==='ITEMS'?cachedMap_(SHEETS.ITEM_CONFIG,'道具ID',300):{},inventory=new Map(),inventoryDuplicates=new Set();
    if(mode==='ITEMS')data[1].rows.forEach(r=>{if(String(r['道具ID'])!==itemId)return;const id=String(r['學號']).trim();if(inventory.has(id))inventoryDuplicates.add(id);inventory.set(id,r);});
    const now=Utilities.formatDate(new Date(),TZ,'yyyy/MM/dd HH:mm:ss'),results=[],changes=[],audit=[],newItems=[];
    let nextItemRow=itemSheet.getLastRow()+1;
    payload.entries.forEach(entry=>{
      const id=entry.studentId,n=Number(entry.value),student=students.get(id);
      const fail=reason=>results.push({studentId:id,ok:false,reason});
      if(!id||counts.get(id)>1)return fail('學號空白或同批重複');
      if(!student)return fail('學生不存在');if(duplicates.has(id))return fail('學生資料有重複學號');
      if(!Number.isSafeInteger(n)||n<0)return fail('請輸入非負整數');
      if(mode==='ITEMS'&&!catalog[itemId])return fail('道具不存在');
      if(n===0){results.push({studentId:id,ok:true,skipped:true,[field]:0});return;}
      try{
        if(mode==='COINS'){
          const before=Number(student['金幣']||0),after=before+n;
          if(!Number.isSafeInteger(before)||before<0||!Number.isSafeInteger(after))throw new Error('金幣數量無效或超出儲存範圍');
          changes.push({row:student._row,col:data[0].hm['金幣'],value:after,sh:studentSheet});
          results.push({studentId:id,ok:true,amount:n,coins:after});audit.push([now,id,student['姓名'],n,0,payload.reason]);
        }else{
          if(inventoryDuplicates.has(id))throw new Error('道具庫存有重複列');
          assertNoPendingStoneMailV600_(id,itemId,undefined,data[2].rows);
          if(attributeStoneV600_(itemId)&&data[3].rows.some(r=>String(r['學號']).trim()===id&&r['狀態']==='PENDING'))throw new Error('學生有未完成的屬性石強化');
          const item=inventory.get(id),before=Number(item?.['數量']||0),after=before+n;
          if(!Number.isSafeInteger(before)||before<0||!Number.isSafeInteger(after))throw new Error('道具數量無效或超出儲存範圍');
          const row=item?item._row:nextItemRow++;
          if(!item){const values=Array(itemSheet.getLastColumn()).fill('');values[data[1].hm['學號']-1]=id;values[data[1].hm['道具ID']-1]=itemId;values[data[1].hm['數量']-1]=0;newItems.push(values);}
          changes.push({row,col:data[1].hm['數量'],value:after,sh:itemSheet});
          results.push({studentId:id,ok:true,quantity:n,itemId,remainingQuantity:after});audit.push([now,id,student['姓名'],0,0,payload.reason+'：'+itemId+' ×'+n]);
        }
      }catch(e){fail(e.message);}
    });
    const result={ok:true,requestId:rid,mode,itemId,successCount:results.filter(r=>r.ok&&!r.skipped).length,failedCount:results.filter(r=>!r.ok).length,skippedCount:results.filter(r=>r.skipped).length,results};
    const receiptRow=rewards.getLastRow()+1,receipt=Array(rewards.getLastColumn()).fill('');
    receipt[rh['時間']-1]=now;receipt[rh['原因']-1]='老師批次發放交易';receipt[rh['老師批次ID']-1]=rid;receipt[rh['老師批次內容']-1]=content;receipt[rh['老師批次狀態']-1]='SUBMITTED';receipt[rh['老師批次結果']-1]=JSON.stringify(result);
    // 先保留新庫存列及稽核列，避免逾時 RPC 的固定列號覆蓋後續新增資料。
    CacheService.getScriptCache().remove('ADMIN_PENDING_V610');
    if(newItems.length){adminEnsureRowsV610_(itemSheet,nextItemRow-1);itemSheet.getRange(itemSheet.getLastRow()+1,1,newItems.length,itemSheet.getLastColumn()).setValues(newItems);}
    const reservedAudit=audit.map(row=>{const values=Array(rewards.getLastColumn()).fill('');Object.entries({'時間':row[0],'學號':row[1],'姓名':row[2],'金幣變動':0,'EXP變動':0,'原因':'老師批次待確認：'+rid}).forEach(([key,value])=>values[rh[key]-1]=value);return values;});
    adminEnsureRowsV610_(rewards,receiptRow+reservedAudit.length);
    rewards.getRange(receiptRow,1,1+reservedAudit.length,rewards.getLastColumn()).setValues([receipt,...reservedAudit]);SpreadsheetApp.flush();
    const requests=adminChangeRequestsV610_(changes);
    if(audit.length){const rows=audit.map(row=>{const values=Array(rewards.getLastColumn()).fill('');Object.entries({'時間':row[0],'學號':row[1],'姓名':row[2],'金幣變動':row[3],'EXP變動':row[4],'原因':row[5]}).forEach(([key,value])=>values[rh[key]-1]=value);return values;});requests.push(adminRowsRequestV610_(rewards,receiptRow+1,1,rows));}
    requests.push(mailCellRequestV600_(rewards,receiptRow,rh['老師批次狀態'],'COMMITTED'));
    try{Sheets.Spreadsheets.batchUpdate({requests},ss.getId());}
    catch(e){return adminUnconfirmedResultV610_(result);}
    CacheService.getScriptCache().put('ADMIN_PENDING_V610','NONE',300);
    return {...result,replayed:false};
  }finally{lock.releaseLock();}
}
function adminUnconfirmedResultV610_(result){
  return {...result,ok:false,retryable:true,status:'SUBMITTED',successCount:0,unconfirmedCount:result.successCount,message:'批次結果尚未確認，請用原 requestId 重試；未確認前不會重複發放',results:result.results.map(r=>r.ok&&!r.skipped?{...r,ok:null,status:'SUBMITTED',reason:'交易尚未確認'}:r)};
}

function adminGrantItemsBatchV599(password,studentIds,itemId,quantity,reason){
  verifyAdminPassword_(password);
  if(attributeStoneV600_(itemId))return adminGrantItemsBatchV599LockedMailV600_(password,studentIds,itemId,quantity,reason);
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
  (studentIds||[]).forEach(id=>assertNoPendingStoneMailV600_(String(id).trim(),String(itemId)));
    return adminGrantItemsBatchV599LockedMailV600_(password,studentIds,itemId,quantity,reason);
  }finally{lock.releaseLock();}
}
function adminGrantItemsBatchV599LockedMailV600_(password,studentIds,itemId,quantity,reason){
  verifyAdminPassword_(password);
  if(attributeStoneV600_(itemId))return grantAttributeStonesV600_(studentIds,itemId,quantity,reason);
  const ids=[...new Set((studentIds||[]).map(x=>String(x).trim()).filter(Boolean))];
  if(!ids.length)throw new Error('沒有選擇學生');
  const iid=String(itemId||'').trim(),qty=Math.max(1,Number(quantity||1));
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(SHEETS.STUDENT_ITEMS),hm=headerMapFast_(sh);
  const lastCol=sh.getLastColumn();
  const vals=sh.getLastRow()>=2?sh.getRange(2,1,sh.getLastRow()-1,lastCol).getValues():[];
  const idSet=new Set(ids),found=new Map();
  for(let i=0;i<vals.length;i++){
    const sid=String(vals[i][hm['學號']-1]||'').trim();
    const it=String(vals[i][hm['道具ID']-1]||'');
    if(idSet.has(sid)&&it===iid)found.set(sid,i);
  }
  ids.forEach(sid=>{
    if(found.has(sid)){
      const i=found.get(sid);
      vals[i][hm['數量']-1]=Number(vals[i][hm['數量']-1]||0)+qty;
    }
  });
  ids.forEach(sid=>{if(found.has(sid)){const i=found.get(sid);sh.getRange(i+2,hm['數量']).setValue(vals[i][hm['數量']-1]);}});

  const appends=[];
  ids.forEach(sid=>{
    if(found.has(sid))return;
    const row=Array(lastCol).fill('');
    row[hm['學號']-1]=sid;row[hm['道具ID']-1]=iid;row[hm['數量']-1]=qty;
    appends.push(row);
  });
  if(appends.length)sh.getRange(sh.getLastRow()+1,1,appends.length,lastCol).setValues(appends);

  const rewards=ss.getSheetByName(SHEETS.REWARDS);
  const studentMap={};readObjects_(ss.getSheetByName(SHEETS.STUDENTS)).forEach(s=>studentMap[String(s['學號']).trim()]=s);
  const rr=ids.map(sid=>[new Date(),sid,(studentMap[sid]||{})['姓名']||'',0,0,(reason||'老師批量發放')+'：'+iid+' ×'+qty]);
  if(rr.length)rewards.getRange(rewards.getLastRow()+1,1,rr.length,6).setValues(rr);
  return {ok:true,updated:ids.length,itemId:iid,quantity:qty};
}

function useExpItemsBatchV599(studentId,petId,uses){
  const lock=LockService.getScriptLock();
  lock.waitLock(12000);
  try{
  const id=String(studentId||'').trim(),pid=String(petId||'').trim();
  assertNoPendingChallengeBatchV600_(id,pid);
  const list=Array.isArray(uses)?uses:[];
  if(!list.length)throw new Error('沒有選擇經驗道具');

  const ss=SpreadsheetApp.getActive(),itemCfg=cachedObjects_(SHEETS.ITEM_CONFIG,300);
  const cfgMap={};itemCfg.forEach(x=>cfgMap[String(x['道具ID'])]=x);

  const itemSh=ss.getSheetByName(SHEETS.STUDENT_ITEMS),ih=headerMap_(itemSh),vals=itemSh.getDataRange().getValues();
  const requested={};
  list.forEach(u=>{
    const iid=String(u.itemId||'').trim(),q=Math.max(1,Number(u.quantity||1));
    if(!Number.isSafeInteger(q))throw new Error('道具數量必須是有效整數');
    assertNoPendingStoneMailV600_(id,iid);
    const cfg=cfgMap[iid];
    if(!cfg||String(cfg['類型'])!=='經驗型')throw new Error(iid+' 不是經驗型道具');
    requested[iid]=(requested[iid]||0)+q;
  });

  const rowByItem={};
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][ih['學號']-1]).trim()===id){
      rowByItem[String(vals[i][ih['道具ID']-1]||'')]=i;
    }
  }
  let gained=0;
  Object.keys(requested).forEach(iid=>{
    const idx=rowByItem[iid];
    if(idx===undefined)throw new Error('道具數量不足：'+iid);
    const have=Number(vals[idx][ih['數量']-1]||0),q=requested[iid];
    if(have<q)throw new Error('道具數量不足：'+iid);
    vals[idx][ih['數量']-1]=have-q;
    gained+=Number(cfgMap[iid]['效果值']||0)*q;
  });
  // 先驗證寵物與進化設定，確認可完成升級後才扣道具。
  const petSh=ss.getSheetByName(SHEETS.PETS),ph=headerMap_(petSh),pv=petSh.getDataRange().getValues();
  let prow=-1,level=1,exp=0;
  for(let i=1;i<pv.length;i++){
    if(String(pv[i][ph['學號']-1]).trim()===id && String(pv[i][ph['寵物ID']-1])===pid){
      prow=i+1;level=Number(pv[i][ph['等級']-1]||1);exp=Number(pv[i][ph['EXP']-1]||0);break;
    }
  }
  if(prow<0)throw new Error('找不到寵物');
  const pcfg=cachedObjects_(SHEETS.PET_CONFIG,300).find(x=>String(x['寵物ID'])===pid)||{};
  if(level>=30){
    const pet=decoratePet_({'寵物ID':pid,'等級':level,'EXP':exp},pcfg);
    return {ok:true,gained:0,level,exp,expNeed:0,stage:pet.stage,image:pet.image,inventory:getInventory(id)};
  }
  exp+=gained;
  while(level<30 && exp>=expNeeded_(level)){exp-=expNeeded_(level);level++;}
  if(level>=30)exp=0;
  const l2=Number(pcfg['第二階需求等級']||10),l3=Number(pcfg['第三階需求等級']||25);
  const stage=level>=l3?3:(level>=l2?2:1);
  const image=stage===3?pcfg['第三階圖片']:(stage===2?pcfg['第二階圖片']:pcfg['第一階圖片']);

  // 只寫入本次消耗的道具數量，不把整張學生道具表寫回。
  Object.keys(requested).forEach(iid=>{
    const idx=rowByItem[iid];
    itemSh.getRange(idx+1,ih['數量']).setValue(vals[idx][ih['數量']-1]);
  });
  petSh.getRange(prow,ph['等級']).setValue(level);
  petSh.getRange(prow,ph['EXP']).setValue(exp);

  return {
    ok:true,gained,level,exp,expNeed:level>=30?0:expNeeded_(level),stage,image:image||'',
    inventory:getInventory(id)
  };
  }finally{
    lock.releaseLock();
  }
}

function setupOrUpgradeV599(){
  // 不重跑舊版升級鏈，只清目前設定快取。
  try{clearAllGameConfigCacheV598_();}catch(e){}
  return 'V5.9.9 更新完成';
}

function setupOrUpgradeV5100(){
  try{clearAllGameConfigCacheV598_();}catch(e){}
  try{
    const c=CacheService.getScriptCache();
    ['國語','數學','英文','自然','社會'].forEach(s=>c.remove('QUESTION_SUBJECT_V5100:'+s));
  }catch(e){}
  return 'V5.10.0 完成：無題目科目自動關閉，分數顯示讀取也已修正';
}


/** ======================== V5.10.1 CLASSROOM PERFORMANCE ======================== */

/**
 * 登入後只拿小屋核心資料 + 背包。
 * 不再讀完整信箱、不讀五科題庫、不讀挑戰紀錄。
 */
function getPostLoginBundleV5101(studentId){
  const id=String(studentId||'').trim();
  return safeForClient_({
    core:getStudentCoreStateV55_(id,false),
    runtime:{
      inventory:getInventory(id)
    },
    challengeStatus:getAllChallengeStatusFastV596(id)
  });
}

/**
 * 對戰首頁只需要「各科有幾題」與「今日挑戰狀態」。
 * 這比一次下載五科完整題目小非常多。
 */
function getChallengeHomeBundleV5101(studentId){
  const id=String(studentId||'').trim();
  const c=CacheService.getScriptCache();
  const countKey='QUESTION_COUNTS_V5101';

  let counts=null;
  const hit=c.get(countKey);
  if(hit){try{counts=JSON.parse(hit);}catch(e){}}

  if(!counts){
    counts={'國語':0,'數學':0,'英文':0,'自然':0,'社會':0};
    const props=PropertiesService.getScriptProperties();
    QUESTION_SUBJECTS_V610.forEach(s=>counts[s]=Number(props.getProperty('QUESTION_COUNT_V610:'+s)||0));
    try{c.put(countKey,JSON.stringify(counts),600);}catch(e){}
  }

  return safeForClient_({
    counts:counts,
    status:getAllChallengeStatusFastV596(id)
  });
}

function setupOrUpgradeV5106(){
  try{
    const c=CacheService.getScriptCache();
    ['STATIC_CATALOG_BUNDLE_V598','FAST_BG_CATALOG','FAST_MONSTER_CATALOG','FAST_BATTLE_BG','FAST_PET_BATTLE'].forEach(k=>{try{c.remove(k);}catch(e){}});
  }catch(e){}
  return 'V5.10.6 效能急救版完成';
}

function setupOrUpgradeV5105(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(SHEETS.BATTLE_SAVES,['學號','科目','寵物ID','怪物編號','怪物HP','怪物最大HP','已看題目','最後更新']);
  try{
    const c=CacheService.getScriptCache();
    ['QUESTION_COUNTS_V5101'].forEach(k=>{try{c.remove(k);}catch(e){}});
  }catch(e){}
  return 'V5.10.5 對戰存檔功能完成';
}

function setupOrUpgradeV5104(){
  try{
    const c=CacheService.getScriptCache();
    ['AUTH_STUDENTS_V596','QUESTION_COUNTS_V5101'].forEach(k=>{try{c.remove(k);}catch(e){}});
  }catch(e){}
  return 'V5.10.4 小更新完成';
}

function setupOrUpgradeV5103(){
  try{
    const c=CacheService.getScriptCache();
    c.remove('QUESTION_COUNTS_V5101');
  }catch(e){}
  return 'V5.10.3 教室連線診斷版完成';
}

function setupOrUpgradeV5101(){
  try{
    const c=CacheService.getScriptCache();
    c.remove('QUESTION_COUNTS_V5101');
    ['國語','數學','英文','自然','社會'].forEach(s=>{
      c.remove('QUESTION_SUBJECT_V5100:'+s);
      c.remove('QUESTION_SUBJECT_V5961:'+s);
    });
  }catch(e){}
  return 'V5.10.1 教室多人效能版完成';
}

// V6.0 第一階段：沿用學生道具表，新增可去重的永久技能強化紀錄。
const ATTRIBUTE_STONES_V600 = [
  ['LIGHT','光'],['EARTH','地'],['DARK','暗'],['GRASS','草'],['WATER','水'],['POISON','毒'],
  ['FIRE','火'],['ELECTRIC','電'],['ICE','冰'],['WIND','風'],['STEEL','鋼'],['CHAOS','混沌']
].map(([code,attribute])=>({itemId:'STONE_'+code,name:attribute+'之石',attribute,increment:'5'}));
const SKILL_ENHANCEMENT_HEADERS_V600 = ['學號','請求ID','寵物ID','技能ID','屬性','道具ID','傷害加成','使用時間','狀態','道具原數量','道具新數量','道具列號'];

function attributeStoneV600_(itemId){return ATTRIBUTE_STONES_V600.find(x=>x.itemId===String(itemId))||null;}
function createStudentSessionV600_(studentId){
  const token=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('STUDENT_SESSION_V600:'+token,String(studentId).trim(),21600);
  return token;
}
function verifyStudentSessionV600_(studentId,token){
  if(!token || CacheService.getScriptCache().get('STUDENT_SESSION_V600:'+String(token))!==String(studentId).trim())throw new Error('登入已過期，請重新登入後再試。');
}
function setupOrUpgradeV600(){
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const ss=SpreadsheetApp.getActive(),items=ss.getSheetByName(SHEETS.ITEM_CONFIG);
    if(!items)throw new Error('請先建立 V5.10.6 的道具設定工作表');
    const rows=readRowsWithPositionV600_(items),repairs=[];
    const isMissing=value=>value==null||(typeof value==='string'&&value.trim()==='');
    const defaultsFor=stone=>({'道具ID':stone.itemId,'名稱':stone.name,'類型':'屬性石','效果值':Number(stone.increment),'圖片':'','說明':'同屬性寵物的一個已解鎖技能永久增加 '+stone.increment+' 傷害。','是否開放':true});
    ATTRIBUTE_STONES_V600.forEach(stone=>{
      const matches=rows.filter(x=>String(x['道具ID']).trim()===stone.itemId);
      matches.forEach(existing=>{
        const name=String(existing['名稱']||'').trim(),type=String(existing['類型']||'').trim();
        const namesAnotherStone=ATTRIBUTE_STONES_V600.some(other=>other.itemId!==stone.itemId&&other.name===name);
        // 固定 ID 配合同石名稱／屬性石類型識別；僅留下 ID 的中斷列也可補齊。
        // 效果值缺漏不是占用衝突，已填值（包含 0、false、自訂文字）一律保留。
        const sameStone=!namesAnotherStone&&(name===stone.name||type==='屬性石'||(!name&&!type));
        if(!sameStone)throw new Error('道具 ID 已被其他設定使用：'+stone.itemId);
        Object.entries(defaultsFor(stone)).forEach(([key,value])=>{
          if(key!=='道具ID'&&!isMissing(value)&&isMissing(existing[key]))repairs.push({row:existing._row,key,value});
        });
      });
    });
    ensureSheet_(SHEETS.ITEM_CONFIG,['道具ID','名稱','類型','效果值','圖片','說明','是否開放']);
    ensureSheet_(SHEETS.SKILL_ENHANCEMENTS,SKILL_ENHANCEMENT_HEADERS_V600);
    ensureSheet_(SHEETS.REWARDS,['時間','學號','姓名','金幣變動','EXP變動','原因'].concat(CHALLENGE_BATCH_HEADERS_V600));
    ensureSheet_(SHEETS.MAILBOX,['信件ID','學號','時間','寄件者','標題','內容','附件類型','附件ID','附件數量','是否領取','領取交易']);
    const missing=ATTRIBUTE_STONES_V600.filter(s=>!rows.some(x=>String(x['道具ID']).trim()===s.itemId));
    const types=[...new Set(rows.map(x=>String(x['類型']||'')).filter(Boolean).concat(['經驗型','寶物型','屬性石']))];
    const hm=headerMap_(items),maxRows=items.getMaxRows(),requiredRows=Math.max(2,items.getLastRow()+missing.length);
    // 先補足新石頭需要的列數，再覆蓋完整類型欄驗證，包含 C1001 等新增列。
    if(requiredRows>maxRows)items.insertRowsAfter(maxRows,requiredRows-maxRows);
    items.getRange(2,hm['類型'],items.getMaxRows()-1,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(types,true).setAllowInvalid(false).build());
    SpreadsheetApp.flush(); // 確認新規則先套用，才提交屬性石資料。
    repairs.forEach(repair=>{
      const cell=items.getRange(repair.row,hm[repair.key]);
      if(isMissing(cell.getValue())&&!cell.getFormula?.())cell.setValue(repair.value);
    });
    appendObjectsBatch_(items,missing.map(defaultsFor));
    clearAllGameConfigCacheV598_();
    return 'V6.0 升級完成：補齊屬性石設定、技能強化紀錄及信箱領取交易欄；未發放道具或重設學生資料';
  }finally{lock.releaseLock();}
}
function getSkillEnhancementsV600_(studentId){
  const id=String(studentId).trim(),c=CacheService.getScriptCache(),key='SKILL_BONUS_V600:'+id;
  const hit=c.get(key);if(hit){try{return JSON.parse(hit);}catch(e){}}
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.SKILL_ENHANCEMENTS);
  if(!sh)return {};
  const bonuses={};
  battleStudentRowsV610_(sh,id).filter(r=>r['狀態']==='DONE').forEach(r=>{
    const pet=String(r['寵物ID']),skill=String(r['技能ID']);
    bonuses[pet]=bonuses[pet]||{};
    bonuses[pet][skill]=(BigInt(bonuses[pet][skill]||'0')+BigInt(String(r['傷害加成']||'0'))).toString();
  });
  try{c.put(key,JSON.stringify(bonuses),300);}catch(e){}
  return bonuses;
}
function readRowsWithPositionV600_(sh){
  if(!sh||sh.getLastRow()<2)return [];
  const vals=sh.getDataRange().getValues(),headers=vals[0].map(h=>String(h).trim());
  return vals.slice(1).map((row,index)=>{
    const obj={_row:index+2};headers.forEach((h,i)=>obj[h]=row[i]);return obj;
  }).filter(obj=>headers.some(h=>obj[h]!==''&&obj[h]!=null));
}
function getUpgradeBundleV600(studentId,token){
  verifyStudentSessionV600_(studentId,token);
  const id=String(studentId).trim(),ss=SpreadsheetApp.getActive();
  const cfg=cachedMap_(SHEETS.PET_CONFIG,'寵物ID',300);
  const operations=studentRowsV610_(ss.getSheetByName(SHEETS.SKILL_ENHANCEMENTS),id);
  const pending=operations.find(r=>r['狀態']==='PENDING');
  const pendingOperation=pending?{petId:String(pending['寵物ID']),skillId:String(pending['技能ID']),itemId:String(pending['道具ID']),requestId:String(pending['請求ID']),...(pending['使用數量']?{quantity:pending['使用數量'],batch:true}:{})}:null;
  const itemCfg=cachedMap_(SHEETS.ITEM_CONFIG,'道具ID',300),bonuses={};
  operations.filter(r=>r['狀態']==='DONE').forEach(r=>{
    const pid=String(r['寵物ID']),sid=String(r['技能ID']);bonuses[pid]=bonuses[pid]||{};
    bonuses[pid][sid]=(BigInt(bonuses[pid][sid]||'0')+BigInt(String(r['傷害加成']||'0'))).toString();
  });
  return safeForClient_({ok:true,pets:studentRowsV610_(ss.getSheetByName(SHEETS.PETS),id).map(p=>decoratePet_(p,cfg[String(p['寵物ID'])]||{})),inventory:studentRowsV610_(ss.getSheetByName(SHEETS.STUDENT_ITEMS),id).filter(r=>Number(r['數量'])>0).map(r=>({itemId:String(r['道具ID']),quantity:Number(r['數量']),config:itemCfg[String(r['道具ID'])]||{}})),petBattleConfigs:getPetBattleConfigFast(),skillEnhancements:bonuses,stones:ATTRIBUTE_STONES_V600,ready:!!ss.getSheetByName(SHEETS.SKILL_ENHANCEMENTS),pendingOperation});
}
// 只掃學號索引欄，再讀該學生連續列；不取得整張資料表快照。
function studentRowsV610_(sh,studentId){
  if(!sh||sh.getLastRow()<2)return [];
  const hm=headerMap_(sh),count=sh.getLastRow()-1;
  const ids=sh.getRange(2,hm['學號'],count,1).getValues(),ranges=[];
  ids.forEach((r,i)=>{
    if(String(r[0]).trim()!==studentId)return;
    const last=ranges[ranges.length-1],row=i+2;
    if(last&&last.row+last.count===row)last.count++;else ranges.push({row,count:1});
  });
  const out=[];
  ranges.forEach(range=>sh.getRange(range.row,1,range.count,sh.getLastColumn()).getValues().forEach((r,i)=>{
    const obj={_row:range.row+i};Object.keys(hm).forEach(key=>obj[key]=r[hm[key]-1]);out.push(obj);
  }));
  return out;
}
function setupOrUpgradeV610(){
  setupOrUpgradeV600();
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    ensureSheet_(SHEETS.SKILL_ENHANCEMENTS,SKILL_ENHANCEMENT_HEADERS_V600.concat(['使用數量','強化結果']));
    return 'V6.1 批量強化欄位已補齊；保留所有既有資料';
  }finally{lock.releaseLock();}
}
// 基礎傷害對應既有前端技能表；專屬技能沿用共用設定快取。
function stoneSkillBaseV610_(id,pid,sid,stone,cfg,battle){
  const row=studentRowsV610_(SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS),id).find(r=>String(r['寵物ID'])===pid);
  if(!row)throw new Error('這不是你的寵物');
  const pet=decoratePet_(row,cfg[pid]||{}),attribute=String(battle.attribute||pet.attribute||'光');
  if(attribute!==stone.attribute)throw new Error('寵物只能使用相同屬性的石頭');
  const lv=Math.min(30,pet.level),attr=[[1,20],[5,30],[10,45],[15,60],[20,80],[25,105]],general=[[3,25],[7,35],[13,50],[17,65],[23,85],[27,110]];
  const a=attr.find(([l])=>l<=lv&&sid==='ATTR-'+attribute+'-'+l),g=general.find(([l])=>l<=lv&&sid==='GEN-'+l);
  if(a)return a[1];if(g)return g[1];
  if(lv>=30&&battle.specialName&&sid==='SPECIAL-'+pid)return Math.max(1,Number(battle.specialDamage||150));
  throw new Error('這個技能尚未解鎖或不存在');
}
function useAttributeStonesBatchV610(studentId,petId,skillId,itemId,quantity,requestId,token){
  verifyStudentSessionV600_(studentId,token);
  const id=String(studentId).trim(),pid=String(petId),sid=String(skillId),iid=String(itemId),rid=String(requestId);
  const mode=quantity==='ALL'?'ALL':Number(quantity);
  if(!/^[A-Za-z0-9-]{16,100}$/.test(rid)||!(mode==='ALL'||(Number.isSafeInteger(mode)&&mode>0)))return {ok:false,retryable:false,message:'請求編號或使用數量無效'};
  // 設定讀取不占用交易鎖；實際庫存、寵物等級與交易狀態仍在鎖內驗證。
  const cfg=cachedMap_(SHEETS.PET_CONFIG,'寵物ID',300),battle=getPetBattleConfigFast().find(p=>p.petId===pid)||{};
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const ss=SpreadsheetApp.getActive(),log=ss.getSheetByName(SHEETS.SKILL_ENHANCEMENTS),lh=log?headerMap_(log):{};
    if(!lh['使用數量']||!lh['強化結果'])return {ok:false,retryable:false,message:'請老師先執行 setupOrUpgradeV610()'};
    const operations=studentRowsV610_(log,id),existing=operations.find(r=>String(r['請求ID'])===rid);
    if(existing){
      if(String(existing['寵物ID'])!==pid||String(existing['技能ID'])!==sid||String(existing['道具ID'])!==iid||String(existing['使用數量'])!==String(mode))throw new Error('請求編號已用於其他強化');
      CacheService.getScriptCache().remove('SKILL_BONUS_V600:'+id);
      if(existing['狀態']==='DONE'){
        const result=JSON.parse(String(existing['強化結果']));
        // 重送不寫入；若另有後續強化／消耗，回傳目前值，避免 UI 倒退至舊庫存。
        const total=operations.filter(r=>r['狀態']==='DONE'&&String(r['寵物ID'])===pid&&String(r['技能ID'])===sid).reduce((n,r)=>n+BigInt(String(r['傷害加成']||'0')),BigInt(0));
        const inventory=studentRowsV610_(ss.getSheetByName(SHEETS.STUDENT_ITEMS),id).find(r=>String(r['道具ID'])===iid);
        return {...result,remainingStone:Number(inventory?.['數量']||0),totalBonus:total.toString(),finalDamage:(BigInt(result.finalDamage)-BigInt(result.totalBonus)+total).toString(),replayed:true};
      }
      // RPC 可能仍在執行；未確認時不能再次扣庫存或覆寫其他已完成交易。
      return {ok:false,retryable:true,message:'上一筆強化交易尚未確認；請稍後以相同請求重試，若持續未確認請老師檢查交易紀錄'};
    }
    let stone,base,items,ih,item,have,used;
    try{
      stone=attributeStoneV600_(iid);if(!stone)throw new Error('這不是屬性石');
      if(operations.some(r=>r['狀態']==='PENDING'))throw new Error('請先重試上一筆尚未完成的強化');
      base=stoneSkillBaseV610_(id,pid,sid,stone,cfg,battle);
      assertNoPendingStoneMailV600_(id,iid,undefined,studentRowsV610_(ss.getSheetByName(SHEETS.MAILBOX),id));
      items=ss.getSheetByName(SHEETS.STUDENT_ITEMS);ih=headerMap_(items);
      const matches=studentRowsV610_(items,id).filter(r=>String(r['道具ID'])===iid);
      if(matches.length>1)throw new Error('同一道具有重複庫存列，請老師確認');
      item=matches[0];have=Number(item?.['數量']||0);used=mode==='ALL'?have:mode;
      if(!Number.isSafeInteger(have)||!Number.isSafeInteger(used)||used<1||used>have)throw new Error('屬性石數量不足');
      requireMailSheetsServiceV600_();
    }catch(e){return {ok:false,retryable:false,message:e.message};}
    const added=BigInt(used)*BigInt(5);
    const before=operations.filter(r=>r['狀態']==='DONE'&&String(r['寵物ID'])===pid&&String(r['技能ID'])===sid).reduce((n,r)=>n+BigInt(String(r['傷害加成']||'0')),BigInt(0));
    const total=before+added,result={ok:true,requestId:rid,petId:pid,skillId:sid,itemId:iid,usedQuantity:used,remainingStone:have-used,addedDamage:added.toString(),totalBonus:total.toString(),finalDamage:(BigInt(base)+total).toString()};
    const row=log.getLastRow()+1;
    appendObject_(log,{'學號':id,'請求ID':rid,'寵物ID':pid,'技能ID':sid,'屬性':stone.attribute,'道具ID':iid,'傷害加成':added.toString(),'使用時間':new Date(),'狀態':'PENDING','道具原數量':have,'道具新數量':have-used,'道具列號':item._row,'使用數量':String(mode),'強化結果':JSON.stringify(result)});
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove('SKILL_BONUS_V600:'+id);
    // 同一原子請求提交扣庫存 + DONE；PENDING 絕不視為已獲得傷害加成。
    Sheets.Spreadsheets.batchUpdate({requests:[mailCellRequestV600_(items,item._row,ih['數量'],have-used),mailCellRequestV600_(log,row,lh['狀態'],'DONE')]},ss.getId());
    CacheService.getScriptCache().remove('SKILL_BONUS_V600:'+id);
    return {...result,replayed:false};
  }finally{lock.releaseLock();}
}
function validateStoneSkillV600_(studentId,petId,skillId,stone){
  const cfg=cachedMap_(SHEETS.PET_CONFIG,'寵物ID',300);
  const row=readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS)).find(p=>String(p['學號']).trim()===studentId && String(p['寵物ID'])===petId);
  if(!row)throw new Error('這不是你的寵物');
  const pet=decoratePet_(row,cfg[petId]||{}),battle=getPetBattleConfigFast().find(p=>p.petId===petId)||{};
  const attribute=String(battle.attribute||pet.attribute||'光');
  if(stone.attribute!==attribute)throw new Error('寵物只能使用相同屬性的石頭');
  const level=Math.min(30,pet.level);
  const attrLevels=[1,5,10,15,20,25],generalLevels=[3,7,13,17,23,27];
  const valid=attrLevels.some(l=>l<=level && skillId==='ATTR-'+attribute+'-'+l)
    ||generalLevels.some(l=>l<=level && skillId==='GEN-'+l)
    ||(level>=30 && battle.specialName && skillId==='SPECIAL-'+petId);
  if(!valid)throw new Error('這個技能尚未解鎖或不存在');
}
function useAttributeStoneV600(studentId,petId,skillId,itemId,requestId,token){
  verifyStudentSessionV600_(studentId,token);
  const id=String(studentId).trim(),pid=String(petId),sid=String(skillId),iid=String(itemId),rid=String(requestId);
  if(!/^[A-Za-z0-9-]{16,100}$/.test(rid))return {ok:false,message:'請求編號無效',retryable:false};
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const ss=SpreadsheetApp.getActive(),log=ss.getSheetByName(SHEETS.SKILL_ENHANCEMENTS);
    if(!log)return {ok:false,message:'請老師先執行 setupOrUpgradeV600()',retryable:false};
    const lh=headerMap_(log),rows=readRowsWithPositionV600_(log);
    let operation=rows.find(r=>String(r['學號']).trim()===id && String(r['請求ID'])===rid);
    let logRow=operation?operation._row:0;
    if(operation && (String(operation['寵物ID'])!==pid||String(operation['技能ID'])!==sid||String(operation['道具ID'])!==iid))throw new Error('請求編號已用於其他強化，請重新登入');
    // V6.1 原子提交的未確認交易不可套用 V6.0 數量恢復流程。
    if(operation?.['使用數量'] && operation['狀態']!=='DONE')return {ok:false,retryable:true,message:'請使用原批量請求重試確認；不可用單顆流程恢復批量交易'};
    if(operation?.['狀態']==='DONE'){
      CacheService.getScriptCache().remove('SKILL_BONUS_V600:'+id);
      return {...getUpgradeBundleV600(id,token),requestId:rid,replayed:true};
    }
    const items=ss.getSheetByName(SHEETS.STUDENT_ITEMS),ih=headerMap_(items);
    if(!operation){
      let stone,itemRow,have;
      try{
        stone=attributeStoneV600_(iid);if(!stone)throw new Error('這不是屬性石');
        validateStoneSkillV600_(id,pid,sid,stone);
        assertNoPendingStoneMailV600_(id,iid);
        if(rows.some(r=>String(r['學號']).trim()===id && r['狀態']==='PENDING'))throw new Error('請先重試上一筆尚未完成的強化');
        const vals=items.getDataRange().getValues();itemRow=vals.findIndex((r,i)=>i>0 && String(r[ih['學號']-1]).trim()===id && String(r[ih['道具ID']-1])===iid)+1;
        have=itemRow>1?Number(vals[itemRow-1][ih['數量']-1]):0;
        if(!Number.isSafeInteger(have)||have<1)throw new Error('屬性石數量不足');
      }catch(e){return {ok:false,message:e.message,retryable:false};}
      operation={'學號':id,'請求ID':rid,'寵物ID':pid,'技能ID':sid,'屬性':stone.attribute,'道具ID':iid,'傷害加成':stone.increment,'使用時間':new Date(),'狀態':'PENDING','道具原數量':have,'道具新數量':have-1,'道具列號':itemRow};
      logRow=log.getLastRow()+1;appendObject_(log,operation);SpreadsheetApp.flush();
    }
    const itemRow=Number(operation['道具列號']),values=items.getRange(itemRow,1,1,items.getLastColumn()).getValues()[0];
    if(String(values[ih['學號']-1]).trim()!==id||String(values[ih['道具ID']-1])!==iid)throw new Error('道具列已變動，請老師確認尚未完成的強化紀錄');
    const current=Number(values[ih['數量']-1]),before=Number(operation['道具原數量']),after=Number(operation['道具新數量']);
    if(current===before){items.getRange(itemRow,ih['數量']).setValue(after);SpreadsheetApp.flush();}
    else if(current!==after)throw new Error('道具數量已變動，請老師確認尚未完成的強化紀錄');
    log.getRange(logRow,lh['狀態']).setValue('DONE');SpreadsheetApp.flush();
    CacheService.getScriptCache().remove('SKILL_BONUS_V600:'+id);
    return {...getUpgradeBundleV600(id,token),requestId:rid,replayed:false};
  }finally{lock.releaseLock();}
}
// 老師既有發道具入口；與信箱領取、技能強化共用 ScriptLock。
function grantAttributeStonesV600_(studentIds,itemId,quantity,reason){
  const ids=[...new Set(studentIds.map(x=>String(x).trim()).filter(Boolean))],iid=String(itemId),qty=Number(quantity||1);
  if(!attributeStoneV600_(iid)||!ids.length||!Number.isSafeInteger(qty)||qty<1)throw new Error('屬性石發放資料無效');
  const lock=LockService.getScriptLock();lock.waitLock(12000);
  try{
    const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(SHEETS.STUDENT_ITEMS),hm=headerMap_(sh),rows=readRowsWithPositionV600_(sh),log=ss.getSheetByName(SHEETS.SKILL_ENHANCEMENTS);
    const operations=log?readObjects_(log):[];
    ids.forEach(id=>{
      if(!getStudent_(id))throw new Error('找不到學生：'+id);
      assertNoPendingStoneMailV600_(id,iid);
      if(operations.some(r=>String(r['學號']).trim()===id && r['狀態']==='PENDING'))throw new Error('學生有尚未完成的強化，請先重試完成');
    });
    const quantities={};
    ids.forEach(id=>{
      const r=rows.find(r=>String(r['學號']).trim()===id && String(r['道具ID'])===iid);
      const next=Number(r?.['數量']||0)+qty;
      if(!Number.isSafeInteger(next))throw new Error('道具數量超出可儲存範圍');
      quantities[id]=next;
    });
    ids.forEach(id=>{
      const index=rows.findIndex(r=>String(r['學號']).trim()===id && String(r['道具ID'])===iid);
      const next=quantities[id];
      if(index<0)appendObject_(sh,{'學號':id,'道具ID':iid,'數量':next});
      else sh.getRange(rows[index]._row,hm['數量']).setValue(next);
      appendObject_(ss.getSheetByName(SHEETS.REWARDS),{'時間':new Date(),'學號':id,'原因':(reason||'老師發放')+'：'+iid+' ×'+qty});
    });
    return {ok:true,updated:ids.length,itemId:iid,quantity:qty,quantities};
  }finally{lock.releaseLock();}
}

function diagnosticPingV5103(){
  return {
    ok:true,
    serverTime:Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Taipei','yyyy/MM/dd HH:mm:ss'),
    version:APP_VERSION
  };
}

function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : '';
    const req = raw ? JSON.parse(raw) : {};
    const action = String(req.action || '');
    const args = Array.isArray(req.args) ? req.args : [];

    const API = {
      login: login,
      loginBootstrap: loginBootstrap,
      loginCore: loginCoreV55,
      loginFastV596: loginFastV596,
      diagnosticPingV5103: diagnosticPingV5103,
      getStudentState: getStudentStateV55,
      getInventory: getInventory,
      getShop: getShop,
      getBackgroundCatalogFresh: getBackgroundCatalogFresh,
      getBackgroundCatalogFast: getBackgroundCatalogFast,
      getRuntimeBundleFast: getRuntimeBundleFast,
      getStaticCatalogBundleV597: getStaticCatalogBundleV597,
      getStaticCatalogBundleV598: getStaticCatalogBundleV598,
      adminRefreshGameConfigV598: adminRefreshGameConfigV598,
      getPostLoginBundleV596: getPostLoginBundleV596,
      getPostLoginBundleV5101: getPostLoginBundleV5101,
      getChallengeHomeBundleV5101: getChallengeHomeBundleV5101,
      getQuestionBankBundleFast: getQuestionBankBundleFast,
      getQuestionBankSubjectFast: getQuestionBankSubjectFast,
      getQuestionBatchV610: getQuestionBatchV610,
      adminRefreshQuestionBankV610: adminRefreshQuestionBankV610,
      getMonsterCatalogFresh: getMonsterCatalogCached_,
      getBattleBackgroundCatalogFast: getBattleBackgroundCatalogFast,
      getPetBattleConfigFast: getPetBattleConfigFast,
      setActiveLandFast: setActivePlotFastV55,
      buyLandFast: buyPlotFast,
      buyPlotFast: buyPlotFast,
      buyBackgroundFast: buyBackgroundFast,
      redeemBackgroundFast: redeemBackgroundFast,
      setPlotBackgroundFast: setPlotBackgroundFast,
      movePetToLand: movePetToLandV55,
      useExpItem: useExpItem,
      useExpItemsBatchV599: useExpItemsBatchV599,
      getUpgradeBundleV600: getUpgradeBundleV600,
      useAttributeStoneV600: useAttributeStoneV600,
      useAttributeStonesBatchV610: useAttributeStonesBatchV610,
      getFurnitureSeriesV610: getFurnitureSeriesV610,
      getFurnitureBySeriesV610: getFurnitureBySeriesV610,
      getMailbox: getMailbox,
      getMailboxFresh: getMailboxFresh,
      claimMail: claimMail,
      claimMailFast: claimMailFast,
      claimAllMailFast: claimAllMailFast,
      startChallengeBatch: startChallengeBatch,
      getChallengeQuestionBatch: getChallengeQuestionBatch,
      syncChallengeBatch: syncChallengeBatch,
      getBattleProgressV5105: getBattleProgressV5105,
      saveBattleProgressV5105: saveBattleProgressV5105,
      clearBattleProgressV5105: clearBattleProgressV5105,
      savePetPositionsBatch: savePetPositionsBatch,
      adminLogin: adminLogin,
      getAdminDataSecure: getAdminDataSecure,
      adminAddCoins: adminAddCoins,
      adminAddCoinsFastV599: adminAddCoinsFastV599,
      grantCoinsBatchV610: grantCoinsBatchV610,
      grantItemsBatchV610: grantItemsBatchV610,
      adminGrantItem: adminGrantItem,
      adminGrantItemFast: adminGrantItemFast,
      adminGrantItemsBatchV599: adminGrantItemsBatchV599,
      adminAssignPet: adminAssignPet
    };

    if (!Object.prototype.hasOwnProperty.call(API, action)) {
      throw new Error('不允許的 API 動作：' + action);
    }

    const result = API[action].apply(null, args);
    return apiJson_({ apiOk: true, result: sanitizeForApi_(result) });
  } catch (err) {
    return apiJson_({ apiOk: false, message: String(err && err.message ? err.message : err) });
  }
}

function apiJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeForApi_(value) {
  if (value === null || value === undefined) return value;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  if (Array.isArray(value)) return value.map(sanitizeForApi_);
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function(k) { out[k] = sanitizeForApi_(value[k]); });
    return out;
  }
  return value;
}

