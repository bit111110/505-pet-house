const assert=require('node:assert/strict'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {context,call,tables,cache,makeSheet}=require('./v600.test.cjs');
const standard=['道具ID','名稱','類型','效果值','圖片','說明','是否開放'];
const definitions=vm.runInContext('ATTRIBUTE_STONES_V600',context);
const students=JSON.stringify(tables.get('學生資料').values),pets=JSON.stringify(tables.get('學生寵物').values),inventory=JSON.stringify(tables.get('學生道具').values);
function fixture(capacity=1000,headers=standard,legacyCount=999,extraType){
 const typeColumn=()=>sh.values[0]?.indexOf('類型')+1;
 const original=[headers,...Array.from({length:legacyCount},(_,i)=>headers.map(header=>({'道具ID':'OLD'+i,'名稱':'原道具'+i,'類型':i===0&&extraType?extraType:i%2?'寶物型':'經驗型','效果值':10,'圖片':'','說明':'保留','是否開放':true})[header]))];
 const sh=makeSheet('道具設定',original),range=sh.getRange;
 let allowed=['經驗型','寶物型'],validatedEnd=capacity,gridRows=capacity,failPartial=false;
 const events=[];
 sh.getMaxRows=()=>gridRows;
 sh.insertRowsAfter=(after,count)=>{assert.equal(after,gridRows);assert.ok(count>0);events.push({kind:'grow',after,count});gridRows+=count;validatedEnd=gridRows;};
 sh.getRange=(r,c,n=1,m=1)=>{
   assert.ok(r+n-1<=gridRows,'range must fit preallocated rows');
   const base=range(r,c,n,m);
   return {...base,setDataValidation:rule=>{assert.equal(c,typeColumn());assert.equal(r,2);allowed=rule.types.slice();validatedEnd=r+n-1;events.push({kind:'validate',end:validatedEnd,allowed});return base.setDataValidation(rule);},setValues:values=>{
     for(let i=0;i<values.length;i++)for(let j=0;j<values[i].length;j++)if(c+j===typeColumn()&&r+i>=2&&r+i<=validatedEnd&&values[i][j]!==''&&!allowed.includes(String(values[i][j])))throw Error('C'+(r+i)+' violates legacy validation: 經驗型、寶物型');
     events.push({kind:'write',r,n});
     if(failPartial&&values.length>3){failPartial=false;range(r,c,3,m).setValues(values.slice(0,3));throw Error('simulated interrupted setup after three stones');}
     return base.setValues(values);
   }};
 };
 for(const key of cache.keys())if(key.startsWith('HDR_'+sh.getSheetId()+'_'))cache.delete(key);
 return {sh,events,original,allowed:()=>allowed,interrupt:()=>failPartial=true};
}
function verify(f){
 const h=f.sh.values[0],id=h.indexOf('道具ID'),type=h.indexOf('類型');
 assert.equal(JSON.stringify(f.sh.values.slice(0,f.original.length)),JSON.stringify(f.original),'all existing item rows/headers preserved');
 for(const stone of definitions){const matches=f.sh.values.filter(r=>r[id]===stone.itemId);assert.equal(matches.length,1,stone.itemId+' occurs exactly once');assert.equal(matches[0][type],'屬性石');}
 assert.ok(['經驗型','寶物型','屬性石'].every(t=>f.allowed().includes(t)));
 const validation=f.events.findIndex(e=>e.kind==='validate'),write=f.events.findIndex(e=>e.kind==='write'&&e.r>1);assert.ok(validation>=0&&validation<write,'validation applied before new item writes');
 const saved=JSON.stringify(f.sh.values);call('setupOrUpgradeV600');assert.equal(JSON.stringify(f.sh.values),saved,'repeat setup writes no duplicate/reset items');
}
// Exact old-rule failure at C1001, then rerun the fixed setup with the same data.
const oldSource=execFileSync('git',['show','1278421:apps-script/Code.gs'],{encoding:'utf8'}),oldContext=vm.createContext({});vm.runInContext(oldSource,oldContext);
const oldSetup=vm.runInContext('('+oldContext.setupOrUpgradeV600.toString()+')',context);
const old=fixture(1012);assert.throws(()=>oldSetup(),/C1001/);call('setupOrUpgradeV600');verify(old);
// Capacity grows before applying validation so newly required rows C1001..C1012 are covered.
const growing=fixture(1000);call('setupOrUpgradeV600');assert.equal(growing.sh.getMaxRows(),1012);assert.equal(growing.events[0].kind,'grow');verify(growing);
// Partial previous setup resumes by ID, preserving all previously written records.
const partial=fixture(1000);partial.interrupt();assert.throws(()=>call('setupOrUpgradeV600'),/interrupted setup/);
assert.equal(partial.sh.values.length,1003);call('setupOrUpgradeV600');verify(partial);
// Header-based positioning and custom existing item types are retained.
const moved=fixture(1000,['道具ID','名稱','效果值','圖片','類型','說明','是否開放'],1,'紀念型');call('setupOrUpgradeV600');verify(moved);assert.ok(moved.allowed().includes('紀念型'));

// Fresh empty sheet is initialized once, without recreating or resetting student sheets.
const empty=fixture(1000,standard,0);empty.sh.values=[];empty.original=[];call('setupOrUpgradeV600');verify(empty);
const setupStoneRow=(sh,stone,values={})=>sh.values[0].map(h=>Object.hasOwn(values,h)?values[h]:({'道具ID':stone.itemId,'名稱':stone.name,'類型':'屬性石','效果值':5,'圖片':'','說明':'既有說明','是否開放':true})[h]);
// Existing same-name rows with missing type/effect are the production false-conflict scenario.
const incomplete=fixture(1000,standard,1);
incomplete.sh.values.push(Array(7).fill('')); // preserve real sheet row positions despite blank rows
const light=definitions[0];incomplete.sh.values.push(setupStoneRow(incomplete.sh,light,{'類型':'','效果值':'','說明':'老師原說明','圖片':'teacher.png','是否開放':false}));
const originalPartial=incomplete.sh.values.map(r=>r.slice());
call('setupOrUpgradeV600');
const lightAfter=incomplete.sh.values[3];assert.equal(lightAfter[2],'屬性石');assert.equal(lightAfter[3],5);assert.equal(lightAfter[4],'teacher.png');assert.equal(lightAfter[5],'老師原說明');assert.equal(lightAfter[6],false);
assert.deepEqual(incomplete.sh.values[1],originalPartial[1]);assert.deepEqual(incomplete.sh.values[2],originalPartial[2]);
const repaired=JSON.stringify(incomplete.sh.values);call('setupOrUpgradeV600');assert.equal(JSON.stringify(incomplete.sh.values),repaired);
for(const stone of definitions)assert.equal(incomplete.sh.values.filter(r=>r[0]===stone.itemId).length,1);
// All 12 already present, including valid custom values: skip completed cells, never overwrite.
const full=fixture(1000,standard,1);definitions.forEach(stone=>full.sh.values.push(setupStoneRow(full.sh,stone,{'圖片':'custom.png','說明':'保留文字','是否開放':false,'效果值':0})));
const fullBefore=JSON.stringify(full.sh.values);call('setupOrUpgradeV600');call('setupOrUpgradeV600');assert.equal(JSON.stringify(full.sh.values),fullBefore);
// Some stones present, some missing; ID-only rows can be repaired, existing custom stone names are retained.
const mixed=fixture(1000,standard,1);
mixed.sh.values.push(setupStoneRow(mixed.sh,definitions[0],{'名稱':'','類型':'','效果值':'','說明':'','是否開放':''}));
mixed.sh.values.push(setupStoneRow(mixed.sh,definitions[1],{'名稱':'老師命名的地之石','說明':'原值'}));
call('setupOrUpgradeV600');assert.equal(mixed.sh.values.length,14);assert.equal(mixed.sh.values[2][1],'光之石');assert.equal(mixed.sh.values[2][3],5);assert.equal(mixed.sh.values[3][1],'老師命名的地之石');
for(const stone of definitions)assert.equal(mixed.sh.values.filter(r=>r[0]===stone.itemId).length,1);
const mixedBefore=JSON.stringify(mixed.sh.values);call('setupOrUpgradeV600');assert.equal(JSON.stringify(mixed.sh.values),mixedBefore);
// A failed repair can resume; filled cells and the ID/row are never recreated.
const halfway=fixture(1000,standard,1);halfway.sh.values.push(setupStoneRow(halfway.sh,light,{'名稱':'','類型':'','效果值':'','說明':'','是否開放':''}));
const originalRange=halfway.sh.getRange;let interrupted=false;
halfway.sh.getRange=(r,c,n=1,m=1)=>{const range=originalRange(r,c,n,m);return {...range,setValue:value=>{range.setValue(value);if(r===3&&c===3&&!interrupted){interrupted=true;throw Error('repair interrupted');}}};};
assert.throws(()=>call('setupOrUpgradeV600'),/repair interrupted/);call('setupOrUpgradeV600');assert.equal(halfway.sh.values[2][0],'STONE_LIGHT');assert.equal(halfway.sh.values[2][3],5);assert.equal(halfway.sh.values.filter(r=>r[0]==='STONE_LIGHT').length,1);
// Blank-looking formula cells still count as existing data and must not be replaced.
const formula=fixture(1000,standard,1);formula.sh.values.push(setupStoneRow(formula.sh,light,{'說明':''}));
const formulaRange=formula.sh.getRange;formula.sh.getRange=(r,c,n=1,m=1)=>({...formulaRange(r,c,n,m),getFormula:()=>r===3&&c===6?'=IF(A3="","","")':''});
call('setupOrUpgradeV600');assert.equal(formula.sh.values[2][5],'');
// Missing config headers are appended, never reordered, and missing stone values are repaired in those columns.
const headers=fixture(1000,['道具ID','名稱','類型'],0);headers.sh.values.push(['STONE_LIGHT','光之石','屬性石']);call('setupOrUpgradeV600');assert.deepEqual(headers.sh.values[0].slice(0,3),['道具ID','名稱','類型']);const effect=headers.sh.values[0].indexOf('效果值');assert.equal(headers.sh.values[1][effect],5);
// A truly different legacy item occupying the reserved ID must abort before ANY writes.
const collision=fixture(1000,standard,1);collision.sh.values.push(setupStoneRow(collision.sh,light,{'名稱':'原本經驗糖果','類型':'經驗型','效果值':30}));const collisionBefore=JSON.stringify(collision.sh.values);assert.throws(()=>call('setupOrUpgradeV600'),/道具 ID 已被其他設定使用：STONE_LIGHT/);assert.equal(JSON.stringify(collision.sh.values),collisionBefore);assert.equal(collision.events.length,0);

assert.equal(JSON.stringify(tables.get('學生資料').values),students);assert.equal(JSON.stringify(tables.get('學生寵物').values),pets);assert.equal(JSON.stringify(tables.get('學生道具').values),inventory);
console.log('PASS V6 setup validation: C1001 legacy-rule reproduction, rule-before-write, preallocated/validated new rows, partial retry without duplicate IDs, repeat idempotency, header-based type column, existing types/rows/student data preserved; empty/partial/all/mixed setups, missing values and headers, interrupted repair, custom values/formulas preserved, true ID collision rejected.');
