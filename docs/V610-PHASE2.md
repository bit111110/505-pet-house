# V6.1 Phase 2：老師批次發金幣與道具

分支 `feature/v6.1-performance`。前一版 Phase 1 commit：`399dab7`。

## 老師操作

既有老師後台新增「批次發金幣／批次發道具」模式，依座號列出全班學號與個別數值。金幣可全班填入 100，道具可全班填入 1 或 5，均可清空；0／空白代表略過。

先顯示確認清單，再一次送出全班。送出期間鎖定操作，完成後顯示成功、失敗、略過人數與逐人結果。成功的輸入歸零，失敗的保留，方便處理失敗學生。原本不具 requestId 的同量批量按鈕由新模式取代；單人金幣、道具、寵物介面及所有舊 API 保留。

## 新 API 與欄位

- `grantCoinsBatchV610(password, entries, requestId, reason)`，entries 為 `{studentId, amount}` 陣列。
- `grantItemsBatchV610(password, itemId, entries, requestId, reason)`，entries 為 `{studentId, quantity}` 陣列。

兩支均加入 `doPost()` 白名單，管理員密碼沿用 Script Properties 驗證，無任何新硬編碼密碼。前端只把模式、道具、數值、原因、requestId 保存到 per-request localStorage key；不保存密碼到批次重試資料。驗證密碼之後才允許查詢或執行交易。

不新增工作表。在既有「獎勵紀錄」末尾追加四欄：`老師批次ID`、`老師批次內容`、`老師批次狀態`、`老師批次結果`。每批一列永久收據，另保留成功學生的既有六欄獎勵稽核紀錄。0／無效／不存在學生不寫入資產，結果保存在收據中。

## Sheet I/O 與效能

每批發金幣或道具均為 **1 次前端 API**，不對學生逐一呼叫 Apps Script。

以一次 `Sheets.Spreadsheets.Values.batchGet` 讀取必要欄位：

- 金幣：学生資料的學號、姓名、金幣。
- 道具：學生學號、姓名；庫存學號、道具 ID、數量；信箱必要的未確認交易欄位；屬性石另讀強化紀錄學號、狀態。
- 共用道具設定沿用快取，快取未命中才讀設定表。
- 收據查詢另讀一個批次 ID 索引欄，命中時才讀該收據列；未確認交易檢查有短期的「無未確認交易」快取提示，永久收據才是去重依據。

在記憶體比對、計算與逐人驗證，庫存與金幣都是加上既有值。相鄰有變更的列合併為連續單欄更新，未發放學生的儲存格不寫入；獎勵稽核列合併為一個區塊。**一次原子 `batchUpdate` 提交資產、稽核與 COMMITTED 收據狀態**。

前置準備會批次保存 SUBMITTED 收據和稽核占位列；新庫存列一次建立為數量 0，占位不代表發放。沒有逐位 `getRange/setValue`，也沒有整張學生資料或庫存讀取後寫回。25 人測試驗證資產資料一次 batchGet、入帳一次 batchUpdate。這不表示後端只有一次 Sheet I/O：包含固定的表頭／收據索引讀取及準備階段批次寫入。

## 交易安全

永久 requestId 在兩種 API 間共用唯一空間，綁定完整模式、道具、學生數值與原因。同 ID 不同內容拒絕，COMMITTED 重送直接回傳原逐人結果，不再次發放。0 計入 skippedCount，不計入 successCount；成功人數是實際發放人數。

學生／道具不存在、重複學號、數值非整數或超限、該學生有未確認信箱交易／強化等，會產生明確逐人失敗原因；其他合格學生仍一起提交。Sheet 服務失敗時，不能宣稱任何尚未確認學生成功，回報 unconfirmedCount 與 SUBMITTED。

批次與既有單人資產寫入共用 ScriptLock。單人金幣、一般道具及共用扣金幣入口補齊鎖／未確認批次保護；既有道具寫入的共用交易檢查也阻擋同資產的未知老師交易。沒有改動升級函式、信箱掉落率、對戰 UI 或家具流程。

逾時若實際已原子提交，原 requestId 重試找到 COMMITTED 即確認完成。若仍為 SUBMITTED，絕不推測庫存或重新派送原子寫入；相關學生的同一資產暫停寫入，新的老師批次亦須先等待確認。持續未確認需要查核執行紀錄，不得刪除收據來重新發放。

準備階段先保留新庫存列及稽核列，因此延遲提交不會覆蓋後續新增的庫存／獎勵列。測試另涵蓋未知 RPC 後另一筆不相關單人發放，再模擬延遲提交，確認後續資料完整。

回傳的 COMMITTED 重播结果是第一次交易結果；其中餘額代表當時結果。老師之後另有發放或學生消耗，按既有「重新整理」可查看最新後台資料，不會自動追加第二支 API。

鎖方法依據：[Apps Script Lock](https://developers.google.com/apps-script/reference/lock/lock)。釋放自行取得的鎖前先 flush；已持鎖的呼叫端保留外層鎖的擁有權。

## 檔案與驗證

- `app.js`：批次模式、確認、持久 requestId、防連點、原批次重試及逐人結果；學生升級／對戰函式不變。
- `apps-script/Code.gs`：兩支 API、交易核心、欄位 setup、資產共用鎖與未知交易防護。
- `index.html`：app.js 快取版本參數。
- `tests/v600.test.cjs`：共用模擬 Sheet 的 getName、Lock.hasLock 方法。
- `tests/v610-admin-batch.test.cjs`：25 人同額／不同額、零、無效學生／道具、批次去重、逾時、兩分頁鎖競爭、舊 API、部分失敗、延遲提交、ID／密碼安全及批次 I/O。
- `tests/v610-admin-ui.test.cjs`：真實 Chrome 桌面／平板／手機、全班列、快速填入、個別數值、清空、確認、防連點、單次 API、逐人結果、跨分頁重試及不持久保存密碼。
- 本文件。

同時執行全部 V6.0 和 V6.1 Phase 1 回歸及 app.js、Code.gs、所有測試檔語法檢查。後端使用記憶體 Sheets，瀏覽器使用模擬 API，沒有連線修改正式學生資料或部署。

## 部署／回復

1. 備份目前程式與正式資料，在試算表副本先做部署測試。
2. 更新 Code.gs，沿用已啟用的 Google Sheets API 服務與 ADMIN_PASSWORD 指令碼屬性。
3. 執行 `setupAdminBatchV610()`。只補獎勵紀錄四欄，可冪等重跑；Phase 1 已完成者不需要重新執行 `setupOrUpgradeV610()`。
4. 更新既有 Apps Script 網頁部署，保留 API URL。
5. 發布 app.js／index.html，重新載入老師後台，測試兩種批次與逾時重試。

回復 Phase 1：暫停資產寫入，先確認每筆 SUBMITTED 的實際結果，保存最新資料；再將前端与 Code.gs 回復至 `399dab7` 並重新部署。保留新增欄位、已入帳的金幣／庫存、全部收據和稽核紀錄，不還原舊資料備份、不清空或重設學生資料。未知交易仍可能延遲完成時不可移除防護或回退。
