// Phase 4 intentionally optimizes sync/renderer I/O; behavior remains covered by battle and idempotency suites.
const assert=require('node:assert/strict'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {context,call,tables,cache,makeSheet,setFault,frontend,backend}=require('./v600.test.cjs');
const previous=vm.createContext({});vm.runInContext(execFileSync('git',['show','5e08c48:apps-script/Code.gs'],{encoding:'utf8'}),previous);
for(const name of ['setupOrUpgradeV600','setupOrUpgradeV610','setupAdminBatchV610','grantCoinsBatchV610','grantItemsBatchV610','useAttributeStoneV600','useAttributeStonesBatchV610','randomGift_','hourlyPetGiftV600_','claimMailsLockedV600_','saveBattleProgressV5105'])assert.equal(context[name].toString().replace(/\r\n/g,'\n'),previous[name].toString().replace(/\r\n/g,'\n'),name+' core preserved');
makeSheet('家具設定',[
 ['家具ID','名稱','價格','圖片','類型','是否開放'],
 ['OLD001','既有樹樁',20,'assets/furniture/old.png','舊地面',true]
]);
makeSheet('學生家具',[['學號','家具ID','數量','土地ID','X','Y','縮放','旋轉'],['50501','OLD001',2,'SLOT001',20,30,1,0]]);
const protectedTables=['學生資料','學生寵物','學生道具','學生家具','技能強化紀錄','信箱','獎勵紀錄'];
const before=new Map(protectedTables.map(name=>[name,JSON.stringify(tables.get(name)?.values)]));
let interrupted=false;
setFault((e,phase)=>{if(!interrupted&&e.name==='家具設定'&&e.r===1&&e.c===7&&phase==='after'){interrupted=true;throw Error('partial Phase 3 setup');}});
assert.throws(()=>call('setupOrUpgradeV610Phase3'),/partial Phase 3 setup/);setFault(null);
call('setupOrUpgradeV610Phase3');
const furniture=tables.get('家具設定'),series=tables.get('家具系列'),items=tables.get('道具設定');
assert.deepEqual(furniture.values[1].slice(0,6),['OLD001','既有樹樁',20,'assets/furniture/old.png','舊地面',true]);
assert.equal(furniture.values[1][6],undefined,'existing blank series not rewritten');
assert.ok(furniture.validations.at(-1).types.includes('舊地面'));
assert.ok(furniture.validations.at(-1).types.includes('浮空型'));
assert.deepEqual(series.values[0],['系列ID','系列名稱','預覽圖片','排序','是否啟用']);
const spriteColumn=items.values[0].indexOf('圖片');
const stoneRows=items.values.filter(r=>String(r[0]).startsWith('STONE_'));
assert.equal(stoneRows.length,12);assert.equal(new Set(stoneRows.map(r=>r[spriteColumn])).size,1);
assert.equal(stoneRows[0][spriteColumn],'assets/items/stones/attribute-stones.png');
const setupSnapshot=JSON.stringify([...tables].map(([name,sh])=>[name,sh.values]));
call('setupOrUpgradeV610Phase3');assert.equal(JSON.stringify([...tables].map(([name,sh])=>[name,sh.values])),setupSnapshot,'safe repeat setup');
for(const [name,snapshot] of before)assert.equal(JSON.stringify(tables.get(name)?.values),snapshot,name+' untouched');
series.appendRow(['FOREST','森林系列','assets/furniture/forest-preview.webp',1,true]);
series.appendRow(['OCEAN','海洋系列','assets/furniture/ocean-preview.webp',2,true]);
series.appendRow(['OFF','停用系列','',3,false]);
furniture.appendRow(['F1','森林床',100,'assets/furniture/f1.png','地面型',true,'FOREST','assets/furniture/f1.webp',1]);
furniture.appendRow(['F2','森林桌',50,'assets/furniture/f2.png','浮空型',true,'FOREST','assets/furniture/f2.webp',2]);
furniture.appendRow(['O1','海洋燈',50,'assets/furniture/o1.png','浮空型',true,'OCEAN','assets/furniture/o1.webp',1]);
furniture.appendRow(['F3','未開放',50,'assets/furniture/f3.png','地面型',false,'FOREST','',3]);
call('clearFurnitureCacheV610_');cache.delete('CFG_家具設定');
let reads=[];for(const sh of [series,furniture]){
 sh.getDataRange=()=>{throw Error('catalog must avoid getDataRange');};
 const range=sh.getRange.bind(sh);sh.getRange=(r,c,n=1,m=1)=>{reads.push({name:sh.name,r,c,n,m});return range(r,c,n,m);};
}
let home=call('getFurnitureSeriesV610');assert.deepEqual(JSON.parse(JSON.stringify(home.series.map(s=>[s.seriesId,s.itemCount]))),[['FOREST',2],['OCEAN',1],['LEGACY',1]]);
assert.ok(home.series.every(s=>!('items' in s)&&!('image' in s)&&!('thumbnail' in s)));
assert.ok(reads.filter(r=>r.name==='家具設定'&&r.r>1).every(r=>r.m===1&&[1,6,7].includes(r.c)),'home does not load item metadata/images');
const count=reads.length;call('getFurnitureSeriesV610');assert.equal(reads.length,count,'server metadata cache');
reads=[];let forest=call('getFurnitureBySeriesV610','FOREST');assert.deepEqual(Array.from(forest.items,x=>x.furnitureId),['F1','F2']);
assert.ok(reads.filter(r=>r.name==='家具設定'&&r.r>1&&r.m>1).every(r=>!(r.r<=5&&r.r+r.n>5)),'no ocean row metadata read');
const count2=reads.length;call('getFurnitureBySeriesV610','FOREST');assert.equal(reads.length,count2);
assert.deepEqual(Array.from(call('getFurnitureBySeriesV610','OCEAN').items,x=>x.furnitureId),['O1']);
assert.equal(call('getFurnitureBySeriesV610','LEGACY').items[0].thumbnail,'','legacy full image not used as thumbnail');
assert.throws(()=>call('getFurnitureBySeriesV610','OFF'),/系列不存在/);
furniture.getRange(3,2).setValue('新版森林床');call('clearAllGameConfigCacheV598_');
assert.equal(call('getFurnitureBySeriesV610','FOREST').items[0].name,'新版森林床','admin catalog refresh invalidates furniture cache');
assert.equal(call('furnitureImagePathV610_','data:image/png;base64,abc'),'');
assert.equal(call('furnitureImagePathV610_','javascript:alert(1)'),'');
// Current post-login bundle must never touch either furniture sheet.
const getter=context.SpreadsheetApp.getActive().getSheetByName;
context.SpreadsheetApp.getActive().getSheetByName=name=>{assert.ok(!['家具設定','家具系列','學生家具'].includes(name),'login furniture read '+name);return getter(name);};
context.ensureStudentReadyFast_=()=>{};context.getStudent_=()=>({id:'50501'});context.cachedObjects_=()=>[];
context.getSkillEnhancementsV600_=()=>({});context.getInventory=()=>[];context.getAllChallengeStatusFastV596=()=>({});
context.readObjects_=()=>[];
assert.deepEqual(Array.from(call('getPostLoginBundleV5101','50501').core.furniture),[]);
context.SpreadsheetApp.getActive().getSheetByName=getter;
const ui=vm.createContext({localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},window:{}});vm.runInContext(frontend,ui);
const codes=['LIGHT','EARTH','DARK','GRASS','WATER','POISON','FIRE','ELECTRIC','ICE','WIND','STEEL','CHAOS'];
codes.forEach((code,i)=>{assert.ok(ui.itemImageHtmlV610('STONE_'+code,{},40).includes(`data-stone-sprite="${i}"`));});
assert.ok(ui.itemImageHtmlV610('STONE_GRASS',{},40).includes('💎'),'fallback in initial HTML');
for(const action of ['getFurnitureSeriesV610','getFurnitureBySeriesV610'])assert.ok(backend.includes(action+': '+action));
console.log('PASS Phase 3 catalogs: 12 sprite mappings, one asset config, additive/idempotent setup, owned data preserved, login zero furniture reads, series counts without furniture metadata, selected-series ranges, server cache/invalidation, legacy compatibility, unchanged transaction/battle cores.');
