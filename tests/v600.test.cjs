const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID,createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');
const frontend = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const tables = new Map(), cache = new Map(), writes = [];
let locked = false, fault = null;
const clone = rows => rows.map(row => row.slice());
function makeSheet(name, values = []) {
  const sh = { name, values: clone(values), validations: [],
    getLastRow: () => sh.values.length, getLastColumn: () => sh.values[0]?.length || 0, getName:()=>name,
    getMaxRows: () => Math.max(1000, sh.values.length), getSheetId: () => [...tables.keys()].indexOf(name) + 1,
    getDataRange: () => ({ getValues: () => clone(sh.values), getDisplayValues: () => sh.values.map(row => row.map(String)) }),
    setFrozenRows() {},
    getRange(r, c, n = 1, m = 1) {
      const write = (rows) => {
        const event = { name, r, c, n, m, rows };
        if (fault) fault(event, 'before');
        rows.forEach((row, i) => row.forEach((value, j) => { sh.values[r + i - 1] ||= []; sh.values[r + i - 1][c + j - 1] = value; }));
        writes.push(event);
        if (fault) fault(event, 'after');
      };
      return { getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => sh.values[r + i - 1]?.[c + j - 1] ?? '')),
        getValue: () => sh.values[r - 1]?.[c - 1] ?? '', setValue: value => write([[value]]), setValues: write,
        setDataValidation: rule => sh.validations.push(rule) };
    },
    appendRow(row) { sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]); }
  };
  tables.set(name, sh); return sh;
}
const ss = { getId:()=> 'memory-spreadsheet', getSheetByName: name => tables.get(name), insertSheet: name => makeSheet(name) };
const context = vm.createContext({ console, Date, Math, JSON, BigInt, Set, Map, Number, String, Object, Array, Error,
  SpreadsheetApp: { getActive: () => ss, getActiveSpreadsheet: () => ss, flush() {},
    newDataValidation: () => ({ requireValueInList(types) { this.types = types; return this; }, setAllowInvalid() { return this; }, build() { return { types: this.types }; } }) },
  Sheets:{Spreadsheets:{get:()=>({spreadsheetId:'memory-spreadsheet'}),batchUpdate({requests}){
    assert.equal(locked,true,'atomic mail commit holds shared lock');
    const events=requests.filter(r=>r.updateCells).map(({updateCells:u})=>{
      const sh=[...tables.values()].find(s=>s.getSheetId()===u.start.sheetId);
      assert.ok(sh);assert.equal(u.fields,'userEnteredValue');
      const rows=u.rows.map(row=>row.values.map(c=>{const v=c.userEnteredValue;return v.numberValue??v.boolValue??v.stringValue;}));
      return {name:sh.name,r:u.start.rowIndex+1,c:u.start.columnIndex+1,n:rows.length,m:rows[0].length,rows,atomic:true};
    });
    // All before hooks run before any subrequest is applied: a failure rejects the entire batch.
    events.forEach(e=>{if(fault)fault(e,'before');});
    events.forEach(e=>{const sh=tables.get(e.name);e.rows.forEach((r,i)=>r.forEach((v,j)=>{sh.values[e.r+i-1]||=[];sh.values[e.r+i-1][e.c+j-1]=v;}));writes.push(e);});
    // A lost response is injected only after ALL inventory/receipt/mail updates have committed.
    events.forEach(e=>{if(fault)fault(e,'after');});return {};
  }}},
  Utilities: { getUuid: randomUUID,DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_algorithm,value)=>[...createHash('sha256').update(value).digest()],formatDate:(date,tz,format)=>{
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
    const tokens={yyyy:parts.year,MM:parts.month,dd:parts.day,HH:parts.hour,mm:parts.minute,ss:parts.second};return format.replace(/yyyy|MM|dd|HH|mm|ss/g,token=>tokens[token]);
  } },
  CacheService: { getScriptCache: () => ({ get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) },
  LockService: { getScriptLock: () => ({ hasLock:()=>locked, waitLock() { assert.equal(locked, false); locked = true; }, releaseLock() { locked = false; } }) }
});
vm.runInContext(backend, context);
const call = (name, ...args) => context[name](...args);
makeSheet('學生資料', [['學號','姓名','生日','金幣'], ['50501','測試學生','01/01',1234], ['50502','另一位學生','02/02',200]]);
makeSheet('學生寵物', [['學號','寵物ID','等級','EXP'], ['50501','PET001',30,0], ['50501','PET003',1,0], ['50502','PET002',30,0]]);
makeSheet('寵物設定', [['寵物ID','名稱','屬性','第二階需求等級','第三階需求等級','第一階圖片','第二階圖片','第三階圖片'], ['PET001','測試草寵','草',10,25,'p1.png','p2.png','p3.png'], ['PET003','小草寵','草',10,25,'p1.png','p2.png','p3.png'], ['PET002','測試火寵','火',10,25,'p1.png','p2.png','p3.png']]);
makeSheet('寵物戰鬥設定', [['寵物代碼','屬性','專屬技能','專屬技能傷害'], ['PET001','草','永恆森林',150], ['PET003','草','永恆森林',150], ['PET002','火','火焰',150]]);
makeSheet('道具設定', [['道具ID','名稱','類型','效果值','圖片','說明','是否開放'], ['EXP010','小糖果','經驗型',10,'','','TRUE']]);
makeSheet('學生道具', [['學號','道具ID','數量'], ['50501','STONE_GRASS',300], ['', '', ''], ['50502','STONE_FIRE',12], ['50501','EXP010',7]]);
makeSheet('獎勵紀錄', [['時間','學號','姓名','金幣變動','EXP變動','原因']]);
const studentsBefore = JSON.stringify(tables.get('學生資料').values);
const petsBefore = JSON.stringify(tables.get('學生寵物').values);
const inventoryBefore = JSON.stringify(tables.get('學生道具').values);
call('setupOrUpgradeV600');
const itemsAfterSetup = JSON.stringify(tables.get('道具設定').values);
call('setupOrUpgradeV600');
assert.equal(JSON.stringify(tables.get('道具設定').values), itemsAfterSetup, 'setup is idempotent');
assert.equal(tables.get('道具設定').values.length, 14, '12 new stones');
assert.equal(JSON.stringify(tables.get('學生資料').values), studentsBefore);
assert.equal(JSON.stringify(tables.get('學生寵物').values), petsBefore);
assert.equal(JSON.stringify(tables.get('學生道具').values), inventoryBefore, 'setup does not grant/reset inventory');
const token = call('createStudentSessionV600_', '50501');
const stone = (pet, skill, item, rid = randomUUID(), auth = token) => call('useAttributeStoneV600', '50501', pet, skill, item, rid, auth);
assert.throws(() => stone('PET001','GEN-3','STONE_GRASS',randomUUID(),'bad'), /登入已過期/);
const writeCount = writes.length;
assert.equal(stone('PET002','GEN-3','STONE_FIRE').ok, false, 'ownership');
assert.equal(stone('PET001','GEN-3','STONE_FIRE').ok, false, 'attribute mismatch');
assert.equal(stone('PET003','GEN-3','STONE_GRASS').ok, false, 'locked skill');
assert.equal(stone('PET001','GEN-999','STONE_GRASS').ok, false, 'forged skill');
assert.equal(writes.length, writeCount, 'rejected requests write nothing');
const rid = randomUUID();
let result = stone('PET001','ATTR-草-25','STONE_GRASS',rid);
assert.equal(result.skillEnhancements.PET001['ATTR-草-25'], '5');
assert.equal(tables.get('學生道具').values[1][2], 299);
result = stone('PET001','ATTR-草-25','STONE_GRASS',rid);
assert.equal(result.replayed, true);
assert.equal(tables.get('學生道具').values[1][2], 299, 'replay never consumes twice');
assert.throws(() => stone('PET001','GEN-3','STONE_GRASS',rid), /請求編號/);
assert.equal(stone('PET001','GEN-3','STONE_GRASS').skillEnhancements.PET001['GEN-3'], '5');
assert.equal(stone('PET001','SPECIAL-PET001','STONE_GRASS').skillEnhancements.PET001['SPECIAL-PET001'], '5');
for (let i=0; i<40; i++) result = stone('PET001','ATTR-草-25','STONE_GRASS');
assert.equal(result.skillEnhancements.PET001['ATTR-草-25'], '205', 'no per-skill enhancement cap');
const log = tables.get('技能強化紀錄');
log.values.push(Array(log.values[0].length).fill('')); // blank rows must not shift operation positions
const statusCol = log.values[0].indexOf('狀態') + 1;
const retry = randomUUID(); let interrupted = false;
fault = (event, when) => {
  if (!interrupted && event.name === '學生道具' && when === 'after') { interrupted=true; throw new Error('simulated network failure'); }
};
const quantityBeforeRetry = tables.get('學生道具').values[1][2];
assert.throws(() => stone('PET001','GEN-3','STONE_GRASS',retry), /simulated/);
fault = null;
assert.equal(stone('PET001','GEN-3','STONE_GRASS').ok, false, 'pending operation blocks a new consumption');
context.verifyAdminPassword_ = password => assert.equal(password, 'test-only-password');
assert.throws(() => call('adminGrantItemFast','test-only-password','50501','STONE_GRASS',1), /尚未完成/);
assert.equal(call('getUpgradeBundleV600','50501',call('createStudentSessionV600_','50501')).pendingOperation.requestId,retry,'new device can recover pending operation ID');
result = stone('PET001','GEN-3','STONE_GRASS',retry);
assert.equal(tables.get('學生道具').values[1][2], quantityBeforeRetry-1, 'recover interrupted deduction exactly once');
assert.equal(result.skillEnhancements.PET001['GEN-3'], '10');
const commitRetry = randomUUID(); interrupted=false;
fault = (event, when) => { if (!interrupted && event.name==='技能強化紀錄' && event.c===statusCol && when==='after') { interrupted=true; throw new Error('commit response lost'); } };
assert.throws(() => stone('PET001','GEN-3','STONE_GRASS',commitRetry), /commit response lost/);
fault=null;
assert.equal(stone('PET001','GEN-3','STONE_GRASS',commitRetry).skillEnhancements.PET001['GEN-3'],'15', 'replay refreshes committed bonus cache');
const originalOtherStudent = tables.get('學生道具').values[3][2];
call('adminGrantItemsBatchV599','test-only-password',['50501'],'STONE_GRASS',2,'測試');
assert.equal(tables.get('學生道具').values[3][2],originalOtherStudent);
assert.ok(writes.filter(w=>w.name==='學生道具').every(w=>w.n===1&&w.m===1&&w.c===3), 'only affected quantities written');
// New login/device reads the persisted ledger, not browser storage.
cache.delete('SKILL_BONUS_V600:50501');
const newToken=call('createStudentSessionV600_','50501');
assert.equal(call('getUpgradeBundleV600','50501',newToken).skillEnhancements.PET001['ATTR-草-25'],'205');
call('appendObject_',log,{'學號':'50501','請求ID':randomUUID(),'寵物ID':'PET001','技能ID':'ATTR-草-25','傷害加成':'90071992547409930','狀態':'DONE'});
cache.delete('SKILL_BONUS_V600:50501');
const uiCache = new Map();
const ui = vm.createContext({ console, BigInt, localStorage:{getItem:key=>uiCache.get(key)||null,setItem:(key,value)=>uiCache.set(key,value),removeItem:key=>uiCache.delete(key)}, sessionStorage:{getItem:()=>null}, window:{}, crypto:{randomUUID} });
vm.runInContext(frontend,ui);
ui.bundle=call('getUpgradeBundleV600','50501',newToken);
vm.runInContext("state={pets:bundle.pets,skillEnhancements:bundle.skillEnhancements}; PET_BATTLE_CONFIGS=Object.fromEntries(bundle.petBattleConfigs.map(p=>[p.petId,p]));",ui);
const skills=vm.runInContext("getConfiguredPetSkills(state.pets.find(p=>p.petId==='PET001'))",ui);
const grass=skills.find(s=>s.id==='ATTR-草-25');
assert.equal(grass.baseDamage,105);assert.equal(grass.finalDamage,'90071992547410240', 'decimal strings preserve unlimited bonus precision');
assert.equal(skills.find(s=>s.id==='GEN-3').finalDamage,'40');
assert.equal(skills.find(s=>s.id==='SPECIAL-PET001').finalDamage,'155');
assert.equal(JSON.stringify(tables.get('學生資料').values),studentsBefore);
assert.equal(JSON.stringify(tables.get('學生寵物').values),petsBefore);
assert.equal(locked,false);
const previousBackend=execFileSync('git',['show','HEAD:apps-script/Code.gs'],{cwd:root,encoding:'utf8'});
const previousFrontend=execFileSync('git',['show','HEAD:app.js'],{cwd:root,encoding:'utf8'});
const previousUI=vm.createContext({localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},window:{}});
vm.runInContext(previousFrontend,previousUI);
const normalizeLines = text => text.replace(/\r\n/g,'\n');
for(const name of ['normAns','challengeLocalExp','getConfiguredPetSkills','getMonsterHp'])assert.equal(normalizeLines(ui[name].toString()),normalizeLines(previousUI[name].toString()),name+' game rule unchanged');
const extractAPI = source => new Map([...source.match(/const API = \{([\s\S]*?)\n    \};/)[1].matchAll(/^\s*(\w+)\s*:\s*(\w+)/gm)].map(m=>[m[1],m[2]]));
const api=extractAPI(backend);
for(const [action] of extractAPI(previousBackend))assert.ok(api.has(action),'preserved API '+action);
for(const match of frontend.matchAll(/\bgs(?:Raw)?\('([^']+)'/g))assert.equal(typeof context[api.get(match[1])],'function',match[1]);
const previousContext=vm.createContext({});vm.runInContext(previousBackend,previousContext);
assert.equal(normalizeLines(context.randomGift_.toString()),normalizeLines(previousContext.randomGift_.toString()),'mailbox drop probabilities unchanged');
// 共用記憶體 Sheets 測試環境，第二階段測試不碰線上資料。
module.exports={context,call,tables,cache,writes,makeSheet,frontend,backend,setFault:fn=>fault=fn,isLocked:()=>locked};
async function testUpgradeDOM() {
  const elements=new Map();
  const element=()=>({innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},prepend(){},remove(){}});
  for(const id of ['upgradeMain','upgradeNotice','stoneModeContent','upPetInfo'])elements.set(id,element());
  ui.document={getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],createElement:element};
  ui.upPet={value:'PET001',onchange:null};ui.upPetInfo=elements.get('upPetInfo');ui.panel=element();
  ui.alert=()=>{};
  ui.confirm=()=>true;
  ui.document.querySelector=()=>null;
  ui.fixture={...ui.bundle,skillEnhancements:{PET001:{'ATTR-草-25':'20'}}};
  let mutationCalls=0,release;
  ui.gs=async action=>{
    if(action==='getUpgradeBundleV600')return ui.fixture;
    if(action==='useAttributeStonesBatchV610'){mutationCalls++;return new Promise(resolve=>release=resolve);}
    throw new Error(action);
  };
  vm.runInContext("currentId='50501';STUDENT_TOKEN_V600='test';currentTab='upgrade';",ui);
  await vm.runInContext('renderUpgrade()',ui);
  assert.ok(elements.get('upgradeMain').innerHTML.includes('讓夥伴變得更強'));
  assert.ok(elements.get('upgradeMain').innerHTML.includes('exp-batch-check'), 'existing batch candy controls retained');
  vm.runInContext("UPGRADE_MODE_V600='stone';",ui);await vm.runInContext('renderUpgrade()',ui);
  assert.ok(elements.get('stoneModeContent').innerHTML.includes('>20</span> = <strong'));
  const first=vm.runInContext("useStoneV600('ATTR-草-25')",ui);
  const saved=JSON.parse(uiCache.get('petHouseStonePendingV600:50501'));
  assert.equal(saved.skillId,'ATTR-草-25');
  await vm.runInContext("useStoneV600('GEN-3')",ui);
  assert.equal(mutationCalls,1,'duplicate button clicks cannot create a second request');
  const originalMarkup=elements.get('upgradeMain').innerHTML;
  release({ok:true,petId:'PET001',skillId:'ATTR-草-25',itemId:'STONE_GRASS',remainingStone:250,totalBonus:'25',addedDamage:'5'});await first;
  assert.equal(uiCache.has('petHouseStonePendingV600:50501'),false);
  assert.equal(vm.runInContext('STONE_BUSY_V600',ui),false);
  assert.equal(vm.runInContext("getConfiguredPetSkills(state.pets[0]).find(s=>s.id==='ATTR-草-25').finalDamage",ui),'130');
  assert.equal(elements.get('upgradeMain').innerHTML,originalMarkup,'stone success does not rebuild the page');
  ui.gs=async()=>{throw new Error('connection timed out');};
  await vm.runInContext("useStoneV600('GEN-3')",ui);
  const pending=JSON.parse(uiCache.get('petHouseStonePendingV600:50501'));
  assert.ok(pending.requestId,'uncertain request is saved for retry');
  ui.gs=async(_action,_student,_pet,_skill,_item,_quantity,requestId)=>{
    assert.equal(requestId,pending.requestId,'retry uses the original operation ID');return {ok:true,petId:'PET001',skillId:'GEN-3',itemId:'STONE_GRASS',remainingStone:249,totalBonus:'5',addedDamage:'5'};
  };
  await vm.runInContext('useStoneV600()',ui);
  assert.equal(uiCache.has('petHouseStonePendingV600:50501'),false);
}
testUpgradeDOM().then(()=>console.log('PASS V6.0: additive/idempotent setup, 12 stones, authentication, ownership/attribute/unlock checks, all 3 skill kinds, exact stacking, retry/recovery with blank rows, targeted writes, cross-device persistence, large upgrade DOM/candy controls/formula display/double-click guard, preserved API/battle rules/mailbox drops.')).catch(error=>{console.error(error);process.exitCode=1;});
