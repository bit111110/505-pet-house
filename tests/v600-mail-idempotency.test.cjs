const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const env=require('./v600.test.cjs');
const {context,call,tables,writes,setFault,isLocked}=env;
const mail=tables.get('信箱'),items=tables.get('學生道具'),pets=tables.get('學生寵物');
const mh=call('headerMap_',mail),ih=call('headerMap_',items);
const quantity=(id,item)=>Number(items.values.find((r,i)=>i>0&&String(r[ih['學號']-1])===id&&r[ih['道具ID']-1]===item)?.[ih['數量']-1]||0);
const mailRow=id=>mail.values.find(r=>r[mh['信件ID']-1]===id);
const receipt=id=>JSON.parse(String(mailRow(id)[mh['領取交易']-1]));
const make=(item='EXP010',qty=2,id='50501')=>call('createMail_',id,'PET001','測試','測試','道具',item,qty);
let rpcCalls=0;const originalRPC=context.Sheets.Spreadsheets.batchUpdate;
context.Sheets.Spreadsheets.batchUpdate=request=>{rpcCalls++;return originalRPC(request);};
// 1 / 2: normal claim and same-letter repeated clicks, stable permanent identity.
const normal=make(),b=quantity('50501','EXP010');call('claimMailFast','50501',normal);const tx=receipt(normal);
assert.equal(tx.version,2);assert.equal(tx.status,'COMMITTED');assert.equal(tx.transactionId,call('mailTransactionIdV600_','50501',normal));
assert.equal(quantity('50501','EXP010'),b+2);const callCount=rpcCalls;
call('claimMailFast','50501',normal);call('claimMail','50501',normal);assert.equal(quantity('50501','EXP010'),b+2);assert.equal(rpcCalls,callCount);
// 3: whole atomic commit succeeds, HTTP/Apps Script response then disappears.
const timeout=make(),tb=quantity('50501','EXP010');let injected=false;
setFault((e,when)=>{if(!injected&&e.atomic&&e.name==='學生道具'&&when==='after'){injected=true;throw Error('response timed out after atomic commit');}});
assert.throws(()=>call('claimMailFast','50501',timeout),/timed out/);setFault(null);
assert.equal(receipt(timeout).status,'COMMITTED');assert.equal(mailRow(timeout)[mh['是否領取']-1],true);assert.equal(quantity('50501','EXP010'),tb+2);
call('claimMailFast','50501',timeout);assert.equal(quantity('50501','EXP010'),tb+2);
// 4: reproduce the blocker exactly: consume the credited amount back to original quantity, retry never credits again.
pets.values[1][2]=1;pets.values[1][3]=0;
call('useExpItem','50501','EXP010','PET001',2);assert.equal(quantity('50501','EXP010'),tb);
call('claimMailFast','50501',timeout);assert.equal(quantity('50501','EXP010'),tb);
assert.equal(receipt(timeout).transactionId,call('mailTransactionIdV600_','50501',timeout));
// A durable COMMITTED receipt alone is sufficient, even if a cosmetic mail flag is missing.
mailRow(timeout)[mh['是否領取']-1]=false;
call('useExpItem','50501','EXP010','PET001',1);const afterUse=quantity('50501','EXP010');
call('claimMailFast','50501',timeout);assert.equal(quantity('50501','EXP010'),afterUse);assert.equal(mailRow(timeout)[mh['是否領取']-1],true);
// 5: contender at the atomic write boundary cannot enter another locked claim, then its retry is a no-op.
const simultaneous=make(),sb=quantity('50501','EXP010');injected=false;
setFault((e,when)=>{if(!injected&&e.atomic&&when==='before'){injected=true;assert.equal(isLocked(),true);assert.throws(()=>call('claimMailFast','50501',simultaneous));}});
call('claimMailFast','50501',simultaneous);setFault(null);call('claimMailFast','50501',simultaneous);assert.equal(quantity('50501','EXP010'),sb+2);
// 6: all versus single contention uses the same transaction core; all letters share ONE batch RPC.
const a=make(),c=make(),ab=quantity('50501','EXP010');injected=false;const beforeAllRPC=rpcCalls;
setFault((e,when)=>{if(!injected&&e.atomic&&when==='before'){injected=true;assert.throws(()=>call('claimMailFast','50501',a));}});
call('claimAllMailFast','50501');setFault(null);assert.equal(rpcCalls,beforeAllRPC+1);call('claimMailFast','50501',a);call('claimAllMailFast','50501');assert.equal(quantity('50501','EXP010'),ab+4);
assert.notEqual(receipt(a).transactionId,receipt(c).transactionId);
// 7: a stone can be used after commit/response loss; retry of the mail cannot undo consumption.
const stone=make('STONE_GRASS',2),gb=quantity('50501','STONE_GRASS');injected=false;
setFault((e,when)=>{if(!injected&&e.atomic&&e.name==='學生道具'&&when==='after'){injected=true;throw Error('stone response lost');}});
assert.throws(()=>call('claimMailFast','50501',stone),/response lost/);setFault(null);
const token=call('createStudentSessionV600_','50501');assert.equal(call('useAttributeStoneV600','50501','PET001','ATTR-草-1','STONE_GRASS',randomUUID(),token).ok,true);
call('claimMailFast','50501',stone);assert.equal(quantity('50501','STONE_GRASS'),gb+1);
// 8: generic items use exactly the same version/commit path and existing inventory table.
const treasure=make('TRE001',3);call('claimMailFast','50501',treasure);call('claimMailFast','50501',treasure);assert.equal(quantity('50501','TRE001'),3);assert.equal(receipt(treasure).status,'COMMITTED');
// Failure to update a mailbox cell rejects EVERY subrequest; there is never a partial inventory credit.
const rejected=make('STONE_FIRE',2,'50502'),fb=quantity('50502','STONE_FIRE');injected=false;
setFault((e,when)=>{if(!injected&&e.atomic&&e.name==='信箱'&&e.c===mh['是否領取']&&when==='before'){injected=true;throw Error('mail cell validation rejected');}});
assert.throws(()=>call('claimMailFast','50502',rejected),/rejected/);setFault(null);
assert.equal(quantity('50502','STONE_FIRE'),fb);assert.equal(receipt(rejected).status,'SUBMITTED');const unresolvedRPC=rpcCalls;
assert.throws(()=>call('claimMailFast','50502',rejected),/尚未確認/);assert.equal(rpcCalls,unresolvedRPC);
assert.throws(()=>call('adminGrantItemFast','test-only-password','50502','STONE_FIRE',1),/尚未完成/);
// A late server commit after client timeout is not reissued. Pending guards protect same-item writers until it arrives.
const delayed=make('EXP010',2),db=quantity('50501','EXP010');let delayedRequest;
context.Sheets.Spreadsheets.batchUpdate=request=>{rpcCalls++;delayedRequest=request;throw Error('server is still processing');};
assert.throws(()=>call('claimMailFast','50501',delayed),/still processing/);
assert.throws(()=>call('useExpItem','50501','EXP010','PET001',1),/尚未完成/);
assert.throws(()=>call('adminGrantItemFast','test-only-password','50501','EXP010',1),/尚未完成/);
assert.throws(()=>call('adminGrantItemsBatchV599','test-only-password',['50501'],'EXP010',1),/尚未完成/);
const unknownRPC=rpcCalls;assert.throws(()=>call('claimMailFast','50501',delayed),/尚未確認/);assert.equal(rpcCalls,unknownRPC);
// Simulated server-side atomic completion after the Apps Script lock has ended.
for(const {updateCells:u} of delayedRequest.requests){if(!u)continue;const sh=[...tables.values()].find(x=>x.getSheetId()===u.start.sheetId);u.rows.forEach((r,i)=>r.values.forEach((cell,j)=>{const v=cell.userEnteredValue;sh.values[u.start.rowIndex+i]||=[];sh.values[u.start.rowIndex+i][u.start.columnIndex+j]=v.numberValue??v.boolValue??v.stringValue;}));}
context.Sheets.Spreadsheets.batchUpdate=request=>{rpcCalls++;return originalRPC(request);};
assert.equal(receipt(delayed).status,'COMMITTED');call('useExpItem','50501','EXP010','PET001',2);call('claimMailFast','50501',delayed);assert.equal(quantity('50501','EXP010'),db);
// Old pending before/after receipts are preserved and never guessed from inventory quantities.
const legacy=make('TRE002',1);const legacyJSON=JSON.stringify({itemId:'TRE002',quantity:1,row:99,before:0,after:1});mailRow(legacy)[mh['領取交易']-1]=legacyJSON;
assert.throws(()=>call('claimMailFast','50501',legacy),/舊版未完成/);assert.equal(mailRow(legacy)[mh['領取交易']-1],legacyJSON);assert.equal(quantity('50501','TRE002'),0);
// Missing Sheets service fails before storing SUBMITTED or modifying any inventory.
const missing=make('STONE_WATER',1),services=context.Sheets;context.Sheets=undefined;
assert.throws(()=>call('claimMailFast','50501',missing),/啟用/);context.Sheets=services;
assert.equal(String(mailRow(missing)[mh['領取交易']-1]||''),'');assert.equal(quantity('50501','STONE_WATER'),0);
assert.equal(isLocked(),false);
assert.ok(writes.filter(w=>w.atomic&&w.name==='學生道具').every(w=>w.n===1&&w.m===1),'no whole inventory table write');
console.log('PASS mailbox idempotency: permanent identities, normal/repeated claims, post-commit timeout + consumption, same-letter/all-letter contention, stone/candy/generic items, one atomic bulk RPC, mailbox failure rolls back all credit, unresolved/delayed RPC never reissued, pending item guards, legacy receipt preservation, missing service fails before writes.');
