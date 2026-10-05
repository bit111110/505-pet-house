/**
 * 班級寵物小屋 V4
 * 地面/天空寵物、升級道具、信箱整點禮物、五科無限挑戰
 * Google Apps Script + Google 試算表
 */

const APP_VERSION='V5.9.6';
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
  STUDENT_FURNITURE: '學生家具',
  REWARDS: '獎勵紀錄',
  ITEM_CONFIG: '道具設定',
  STUDENT_ITEMS: '學生道具',
  MAILBOX: '信箱',
  QUESTIONS: '挑戰題庫',
  CHALLENGES: '挑戰紀錄',
  STUDENT_PLOTS: '學生土地格',
  STUDENT_BACKGROUNDS: '學生背景'
};

const VALID_SEATS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,22,23,24,25];

// 你原本的三階段圖片資料夾（保留）
const STAGE1_FOLDER_ID = '12J1m_ERknyuvTEYqtw2-tdpy2oU0wwFs';
const STAGE2_FOLDER_ID = '1OoOsmcvHpz3iDtyIpN7U7xNRAotuN9E2';
const STAGE3_FOLDER_ID = '14CO9SiK-VJO06B11VXBQUOgbWKxwyGYf';

function doGet(e) { return apiJson_({apiOk:true,message:'PetHouse API V5.5 is alive'}); }

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
    petId:String(p['寵物ID']),name:cfg['名稱']||p['寵物ID'],nickname:p['暱稱']||'',level,exp,expNeed:expNeeded_(level),stage,
    landId:String(p['土地ID']||'LAND001'),x:Number(p['X']||45),y:Number(p['Y']||70),image:image||'',
    movementType:String(cfg['移動類型']||'地面型'),
    attribute:String(cfg['屬性']||'光'),
    dialogs:[cfg['對話1']||'今天也一起努力吧！',cfg['對話2']||'我喜歡這裡～',cfg['對話3']||'一起變強吧！']
  };
}

function expNeeded_(level){ return 20 + (Number(level)-1)*5; }

function addPetExp_(studentId,petId,amount){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.PETS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]).trim()===String(studentId).trim() && String(vals[i][hm['寵物ID']-1])===String(petId)){
      let lv=Number(vals[i][hm['等級']-1]||1), exp=Number(vals[i][hm['EXP']-1]||0)+Number(amount||0);
      while(exp>=expNeeded_(lv)){ exp-=expNeeded_(lv); lv++; }
      if(exp<0) exp=0;
      sh.getRange(i+1,hm['等級']).setValue(lv);
      sh.getRange(i+1,hm['EXP']).setValue(exp);
      return {level:lv,exp,expNeed:expNeeded_(lv)};
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
  quantity=Math.max(1,Number(quantity||1));
  addItem_(String(studentId).trim(),String(itemId),quantity);
  const s=getStudent_(studentId);
  SpreadsheetApp.getActive().getSheetByName(SHEETS.REWARDS).appendRow([new Date(),studentId,s?s.name:'',0,0,(reason||'老師發放')+'：'+itemId+' ×'+quantity]);
  return true;
}

function addItem_(studentId,itemId,qty){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_ITEMS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]).trim()===studentId && String(vals[i][hm['道具ID']-1])===itemId){
      sh.getRange(i+1,hm['數量']).setValue(Number(vals[i][hm['數量']-1]||0)+qty); return;
    }
  }
  appendObject_(sh,{'學號':studentId,'道具ID':itemId,'數量':qty});
}

function useExpItem(studentId,itemId,petId,quantity){
  const id=String(studentId).trim(), qty=Math.max(1,Number(quantity||1));
  const cfg=cachedObjects_(SHEETS.ITEM_CONFIG,300).find(x=>String(x['道具ID'])===String(itemId));
  if(!cfg || String(cfg['類型'])!=='經驗型') throw new Error('這不是經驗型道具');
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENT_ITEMS), hm=headerMap_(sh), vals=sh.getDataRange().getValues();
  let row=-1, have=0;
  for(let i=1;i<vals.length;i++) if(String(vals[i][hm['學號']-1]).trim()===id && String(vals[i][hm['道具ID']-1])===String(itemId)){ row=i+1; have=Number(vals[i][hm['數量']-1]||0); break; }
  if(row<0 || have<qty) throw new Error('道具數量不足');
  sh.getRange(row,hm['數量']).setValue(have-qty);
  const gained=Number(cfg['效果值']||0)*qty;
  const pet=addPetExp_(id,petId,gained);
  return {ok:true,gained,...pet,inventory:getInventory(id)};
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
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX);
  const hm=headerMap_(sh);
  const vals=sh.getDataRange().getValues();
  const id=String(studentId).trim();

  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['信件ID']-1])===String(mailId) && String(vals[i][hm['學號']-1]).trim()===id){
      if(vals[i][hm['是否領取']-1]===true || String(vals[i][hm['是否領取']-1]).toUpperCase()==='TRUE') {
        // 前端可能已先樂觀更新，重複呼叫時直接回目前狀態。
        return {ok:true,inventory:getInventory(id),unreadMail:getUnreadMailCount_(id)};
      }
      const type=String(vals[i][hm['附件類型']-1]||'');
      const aid=String(vals[i][hm['附件ID']-1]||'');
      const qty=Number(vals[i][hm['附件數量']-1]||0);
      if(type==='道具' && aid && qty>0) addItem_(id,aid,qty);
      sh.getRange(i+1,hm['是否領取']).setValue(true);
      return {ok:true,inventory:getInventory(id),unreadMail:getUnreadMailCount_(id)};
    }
  }
  throw new Error('找不到信件');
}


function claimMail(studentId,mailId){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX), hm=headerMap_(sh), vals=sh.getDataRange().getValues(), id=String(studentId).trim();
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][hm['信件ID']-1])===String(mailId) && String(vals[i][hm['學號']-1]).trim()===id){
      if(vals[i][hm['是否領取']-1]===true || String(vals[i][hm['是否領取']-1]).toUpperCase()==='TRUE') throw new Error('已領取');
      const type=String(vals[i][hm['附件類型']-1]||''), aid=String(vals[i][hm['附件ID']-1]||''), qty=Number(vals[i][hm['附件數量']-1]||0);
      if(type==='道具' && aid && qty>0) addItem_(id,aid,qty);
      sh.getRange(i+1,hm['是否領取']).setValue(true);
      return {ok:true,inventory:getInventory(id),unreadMail:getUnreadMailCount_(id)};
    }
  }
  throw new Error('找不到信件');
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

  const qrow=cachedObjects_(SHEETS.QUESTIONS,300).find(x=>String(x['題目ID'])===String(questionId));
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
  let q=cachedObjects_(SHEETS.QUESTIONS,300).filter(x=>String(x['科目'])===String(subject) && x['是否啟用']!==false && String(x['是否啟用']).toUpperCase()!=='FALSE');
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
  const f=findStudentRow_(studentId); if(!f) throw new Error('找不到學生');
  const now=Number(f.obj['金幣']||0); if(now<amount) throw new Error('金幣不足'); f.sheet.getRange(f.row,f.hm['金幣']).setValue(now-amount);
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
  let rows=cachedObjects_(SHEETS.QUESTIONS,300).filter(x=>String(x['科目'])===String(subject) && x['是否啟用']!==false && String(x['是否啟用']).toUpperCase()!=='FALSE');
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
function syncChallengeBatch(studentId,subject,petId,answers){
  const id=String(studentId).trim(); validatePetOwnership_(id,petId);
  const rec=getOrCreateChallenge_(id,subject,petId);
  let wrong=Number(rec.sheet.getRange(rec.row,rec.hm['錯誤數']).getValue()||0);
  let correct=Number(rec.sheet.getRange(rec.row,rec.hm['答對數']).getValue()||0);
  let totalExp=Number(rec.sheet.getRange(rec.row,rec.hm['總EXP']).getValue()||0);
  const qMap={}; cachedObjects_(SHEETS.QUESTIONS,300).forEach(x=>qMap[String(x['題目ID'])]=x);
  let gainedTotal=0, processed=0;
  for(const a of (answers||[])){
    if(wrong>=3) break;
    const q=qMap[String(a.questionId)]; if(!q || String(q['科目'])!==String(subject)) continue;
    const good=normalizeAnswer_(a.answer)===normalizeAnswer_(q['答案']);
    if(good){ correct++; const g=challengeExpForCorrectCount_(correct); totalExp+=g; gainedTotal+=g; }
    else wrong++;
    processed++;
  }
  if(gainedTotal>0) addPetExp_(id,petId,gainedTotal);
  rec.sheet.getRange(rec.row,rec.hm['答對數']).setValue(correct);
  rec.sheet.getRange(rec.row,rec.hm['錯誤數']).setValue(wrong);
  rec.sheet.getRange(rec.row,rec.hm['總EXP']).setValue(totalExp);
  rec.sheet.getRange(rec.row,rec.hm['寵物ID']).setValue(petId);
  rec.sheet.getRange(rec.row,rec.hm['最後更新']).setValue(new Date());
  return {ok:true,processed,gained:gainedTotal,status:{correct,wrong,exp:totalExp,locked:wrong>=3},locked:wrong>=3,resetAt:nextResetText_()};
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
  const f=findStudentRow_(studentId); if(!f) throw new Error('找不到學生');
  f.sheet.getRange(f.row,f.hm['金幣']).setValue(Number(f.obj['金幣']||0)+Number(amount||0));
  SpreadsheetApp.getActive().getSheetByName(SHEETS.REWARDS).appendRow([new Date(),studentId,f.obj['姓名'],Number(amount||0),0,reason||'老師發放']); return true;
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
function generateHourlyGiftsFast_(studentId){
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
  const mails=[];let made=0;
  while(cursor<=thisHour && made<48){
    const pet=pets[made%pets.length],gift=randomGift_();
    mails.push({
      '信件ID':'MAIL-'+Utilities.getUuid(),
      '學號':id,
      '時間':new Date(cursor),
      '寄件者':String(pet['寵物ID']),
      '標題':'整點小禮物',
      '內容':'寵物在整點時替你帶回了一份禮物！',
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
function getStudentCoreStateV55_(studentId){
  const id=String(studentId||'').trim();ensureStudentReadyFast_(id);const ss=SpreadsheetApp.getActive(),student=getStudent_(id);if(!student)return {ok:false,message:'找不到學生'};
  const petCfg=cachedObjects_(SHEETS.PET_CONFIG,300),cfgMap={};petCfg.forEach(x=>cfgMap[String(x['寵物ID'])]=x);const pets=readObjects_(ss.getSheetByName(SHEETS.PETS)).filter(x=>String(x['學號']).trim()===id).map(p=>decoratePet_(p,cfgMap[String(p['寵物ID'])]||{}));
  const bgCfg=cachedObjects_(SHEETS.LANDS,300),bgMap={};bgCfg.forEach(x=>bgMap[String(x['土地ID'])]=x);let plots=readObjects_(ss.getSheetByName(SHEETS.STUDENT_PLOTS)).filter(x=>String(x['學號']).trim()===id);const active=plots.find(x=>x['是否使用']===true||String(x['是否使用']).toUpperCase()==='TRUE')||plots[0];const activeLandId=active?String(active['土地格ID']):'SLOT001';const lands=plots.map(x=>({'學號':id,'土地ID':String(x['土地格ID']),'土地序號':Number(x['土地序號']||1),'背景ID':String(x['背景ID']||'LAND001'),'是否使用':x['是否使用'],config:bgMap[String(x['背景ID']||'LAND001')]||{}}));
  const backgrounds=readObjects_(ss.getSheetByName(SHEETS.STUDENT_BACKGROUNDS)).filter(x=>String(x['學號']).trim()===id&&x['是否擁有']!==false).map(x=>String(x['背景ID']));
  const fMap=cachedMap_(SHEETS.FURNITURE,'家具ID',300);const furniture=readObjects_(ss.getSheetByName(SHEETS.STUDENT_FURNITURE)).filter(x=>String(x['學號']).trim()===id&&String(x['土地ID']||'SLOT001')===activeLandId).map(x=>({...x,config:fMap[String(x['家具ID'])]||{}}));
  return safeForClient_({ok:true,version:APP_VERSION,student,pets,lands,backgrounds,activeLandId,furniture,unreadMail:0,challengeStatus:{}});
}
function getStudentStateV55(studentId){const s=getStudentCoreStateV55_(studentId);if(!s.ok)return s;s.mailbox=getMailbox(studentId);s.inventory=getInventory(studentId);return safeForClient_(s);}
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
      return {ok:true,alreadyOwned:true,coins:Number(s?.['金幣']||0),backgrounds:bgRows.filter(x=>String(x['學號']).trim()===id&&x['是否擁有']!==false).map(x=>String(x['背景ID']))};
    }

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
  const id=String(studentId).trim();
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.MAILBOX);
  const hm=headerMapFast_(sh);
  if(sh.getLastRow()<2)return {ok:true,mailbox:[],inventory:getInventory(id),unreadMail:0};

  const vals=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
  const gifts={},rowA1=[];
  for(let i=0;i<vals.length;i++){
    if(String(vals[i][hm['學號']-1]||'').trim()!==id)continue;
    const claimed=vals[i][hm['是否領取']-1]===true||String(vals[i][hm['是否領取']-1]).toUpperCase()==='TRUE';
    if(claimed)continue;
    const aid=String(vals[i][hm['附件ID']-1]||'');
    const qty=Number(vals[i][hm['附件數量']-1]||0);
    const type=String(vals[i][hm['附件類型']-1]||'');
    if(type==='道具'&&aid&&qty>0)gifts[aid]=(gifts[aid]||0)+qty;
    rowA1.push(sh.getRange(i+2,hm['是否領取']).getA1Notation());
  }
  addItemsBatch_(id,gifts);
  if(rowA1.length)sh.getRangeList(rowA1).setValue(true);
  return {ok:true,mailbox:getMailboxFast_(id),inventory:getInventory(id),unreadMail:0};
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

/** 快速登入：只驗證學生，不讀寵物/土地/信箱/題庫。 */
function loginFastV596(studentId,birthdayMD){
  const id=String(studentId||'').trim(), wanted=normalizeMonthDay_(birthdayMD);
  const c=CacheService.getScriptCache(), key='AUTH_STUDENTS_V596';
  let rows=null, hit=c.get(key);
  if(hit){try{rows=JSON.parse(hit);}catch(e){}}
  if(!rows){
    const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.STUDENTS),hm=headerMapFast_(sh),vals=sh.getDataRange().getValues();
    rows=[];
    for(let i=1;i<vals.length;i++){
      rows.push({
        id:String(vals[i][hm['學號']-1]||'').trim(),
        name:String(vals[i][hm['姓名']-1]||''),
        birthday:normalizeMonthDay_(vals[i][hm['生日']-1]),
        enabled:vals[i][hm['是否啟用']-1]!==false,
        coins:Number(vals[i][hm['金幣']-1]||0)
      });
    }
    try{c.put(key,JSON.stringify(rows),600);}catch(e){}
  }
  const s=rows.find(x=>x.id===id && x.birthday===wanted && x.enabled);
  if(!s)return {ok:false,message:'學號或生日（月/日）不正確'};
  return safeForClient_({
    ok:true,name:s.name,coins:s.coins,version:APP_VERSION,
    state:{ok:true,version:APP_VERSION,student:{id:id,name:s.name,coins:s.coins},pets:[],lands:[],backgrounds:[],activeLandId:'',furniture:[],unreadMail:0,challengeStatus:{}}
  });
}

/** 題庫一次轉成五科 JSON，CacheService 10 分鐘。 */
function getQuestionBankBundleFast(){
  const c=CacheService.getScriptCache(),key='QUESTION_BANK_V596';
  const hit=c.get(key);if(hit){try{return JSON.parse(hit);}catch(e){}}
  const out={'國語':[],'數學':[],'英文':[],'自然':[],'社會':[]};
  const rows=cachedObjects_(SHEETS.QUESTIONS,600)
    .filter(x=>x['是否啟用']!==false && String(x['是否啟用']).toUpperCase()!=='FALSE');
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
    inventory:getInventory(id),
    backgrounds:getBackgroundCatalogCached_(),
    monsters:getMonsterCatalogCached_(),
    battleBackgrounds:getBattleBackgroundCatalogFast(),
    petBattleConfigs:getPetBattleConfigFast()
  });
  return safeForClient_({
    core:core,
    runtime:runtime,
    questionBank:getQuestionBankBundleFast(),
    challengeStatus:getAllChallengeStatusFastV596(id)
  });
}

/** 老師發道具：以 row cache 直接定位，不再每次額外讀學生資料。 */
function adminGrantItemFast(password,studentId,itemId,quantity,reason){
  verifyAdminPassword_(password);
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
function setupOrUpgradeV596(){
  const ss=SpreadsheetApp.getActive();
  const qsh=ss.getSheetByName(SHEETS.QUESTIONS);
  if(qsh)ensureHeaders_(qsh,['單元','圖片ID','圖片路徑']);
  try{
    const c=CacheService.getScriptCache();
    ['AUTH_STUDENTS_V596','QUESTION_BANK_V596','FAST_BG_CATALOG','FAST_MONSTER_CATALOG','FAST_BATTLE_BG','FAST_PET_BATTLE'].forEach(k=>c.remove(k));
  }catch(e){}
  try{clearGameConfigCache();}catch(e){}
  return 'V5.9.6 高速版升級完成';
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
      getStudentState: getStudentStateV55,
      getInventory: getInventory,
      getShop: getShop,
      getBackgroundCatalogFresh: getBackgroundCatalogFresh,
      getBackgroundCatalogFast: getBackgroundCatalogFast,
      getRuntimeBundleFast: getRuntimeBundleFast,
      getPostLoginBundleV596: getPostLoginBundleV596,
      getQuestionBankBundleFast: getQuestionBankBundleFast,
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
      getMailbox: getMailbox,
      getMailboxFresh: getMailboxFresh,
      claimMail: claimMail,
      claimMailFast: claimMailFast,
      claimAllMailFast: claimAllMailFast,
      startChallengeBatch: startChallengeBatch,
      getChallengeQuestionBatch: getChallengeQuestionBatch,
      syncChallengeBatch: syncChallengeBatch,
      savePetPositionsBatch: savePetPositionsBatch,
      adminLogin: adminLogin,
      getAdminDataSecure: getAdminDataSecure,
      adminAddCoins: adminAddCoins,
      adminGrantItem: adminGrantItem,
      adminGrantItemFast: adminGrantItemFast,
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

