# V6.1 Phase 5：五科題庫與批次取題

基底為 `70b2658`。本階段不改題型、內容、傷害、EXP、三錯鎖定、batchId 原子交易或對戰存檔格式。

## 工作表與遷移

新增／沿用 `題庫_國語`、`題庫_數學`、`題庫_英文`、`題庫_自然`、`題庫_社會`。
統一欄位：題目ID、科目、題型、題目、選項A、選項B、選項C、選項D、答案、解析、是否啟用、單元、圖片ID、圖片路徑。
既有欄位的位置不改；缺少欄位加在末尾。總題庫的額外欄位也複製並保留。

執行 `setupOrMigrateSubjectQuestionBanksV610()`：保留原「挑戰題庫」，依科目補缺少題目；相同 ID 已存在者略過，不覆寫其內容。每科新增列用 Google Sheets API 的 stringValue 寫入，保留顯示文字，避免 2/3 再被轉成日期或文字被當成公式。若舊資料已變成日期，沿用其實際顯示值，不猜測原分數。
不刪學生、題庫、答題、EXP、交易或存檔資料。已完成科目與中途失敗都可安全重跑。
未遷移的科目暫時轉接舊總題庫；正式效能驗收必須先完成遷移。已有分科表（即使空表）不回退讀總題庫；科目欄空白時以分科表名稱補上記憶體中的科目值。

## API、快取與首頁

新增兩個 action，均有 doPost 白名單及實作：

- `getQuestionBatchV610(subject,batchSize,excludeIds)`：默认25題，限制20～30題；剩餘未見題不足時回少於20題或空陣列。回傳 subject、questions、total、remaining。
- `adminRefreshQuestionBankV610(password,subject)`：老師身分驗證後，只使指定科目失效。老師後台新增科目選擇及「更新此科題庫快取」按鈕。

全部58個原 action 保留。舊單科、全科、批次及單題判定 API 保持回傳／參數相容，讀取轉接分科快取。
新版前端不用舊完整題庫 API。登入與挑戰首頁完全不讀題庫；首頁題數來自已保存的 metadata，題庫編輯後在下次載入該科時更新，不為計數掃五科表。

每科 key 基底為 `question-bank:<科目>:v610:<revision>`；meta 記錄分塊 generation，正文每塊最多20000字元，以免撞上 CacheService 每 key 的100KB限制。
TTL為21600秒（6小時）。CacheService可能提前淘汰；任何分塊缺失都按科目重新讀取，不使用截斷資料。
冷載入／失效共用 ScriptLock，持鎖二次檢查 cache，避免全班同時重讀。cache miss 讀1次該科實際資料範圍；hit為0次題庫資料讀取。小型工作表 metadata 與 Script Properties 呼叫不計入此數據。

分科工作表的 onEdit 精準失效；程式／API匯入不會觸發 simple onEdit，匯入後要呼叫精準刷新。既有「更新遊戲設定」是全設定刷新，會有意清除五科；不與新增單科操作混淆。
參考：[Google Cache 文件](https://developers.google.com/apps-script/reference/cache/cache)。

## 前端批次與答案相容

第一批25題，只在點選科目後取得。初批保存在頁面記憶體，各科最多25題；request key 包含 FRONTEND_BUILD、科目、帳號與 view epoch。不讀寫舊的整科 localStorage cache。
戰鬥 queue 只保存尚未使用與新到的一批；正常門檻下最多約30題。cycleIds 保存本輪已取得／已看 ID，完整循環用盡才重置。存檔原有seen最多80個ID的格式不變，續戰優先排除這些ID。
剩5題背景预抓。相同 session 的預抓共用 promise；所有取題請求序列化，離開頁面後跳過排隊中的舊請求，已執行的晚回應丟棄。背景失败不鎖答題，批次用完時可重試；無新寫入或自動答題重送。
題目图片只在現有 question renderer 顯示時設定 src；批次與預抓都不下載圖片。

既有前端依賴 answer/explanation 立即判定、播放動畫並本地累加，再批次交給後端驗證。本階段保留「目前小批次」的答案／解析，避免增加每題API或重構規則。舊完整題庫API仍為相容性保留，所以本階段不宣稱取消所有可取得整科答案的舊介面。

## 量測及驗證

測試資料每科500題，1題停用，共2500題、15欄：

|項目|修改前|修改後|
|---|---|---|
|登入題庫讀取|0|0|
|挑戰首頁冷計數|1次總題庫|0|
|單科冷讀範圍|總表2501×15|該科501×15|
|傳回題目|整科499題|25題|
|JSON UTF-8大小|99220 bytes|約5030 bytes，約減95%|
|cache hit題庫讀取|依舊快取可容納性|0|

25次學生請求使用同一 ScriptCache 的後續請求不重讀 Sheet；這是記憶體模擬驗證，不是正式25台平板併發與網路延遲量測。
新測試涵蓋五科隔離、登入／首頁、分塊淘汰、單科刷新、圖片與分數、批次排除、25請求共享、遷移重跑與中斷修復、遷移後batchId/EXP、預抓非阻塞與去重、快速切科、循環及桌面／平板／手機。
歷史函式文字比對只正規化先前已部署的 BigInt 字面值修正和可見版本文字；不跳過交易邏輯比較。

## 檔案、部署與回復

執行期修改：app.js、index.html、apps-script/Code.gs。新增此文件及 tests/v610-question-batches.test.cjs、tests/v610-question-batches-ui.test.cjs。
回歸適配：tests/v600.test.cjs（display讀取與Properties mock）、tests/v600-battle-ui.test.cjs、tests/v610-battle-performance-ui.test.cjs（新批次API fixture）、tests/v610-admin-batch.test.cjs、tests/v610-catalogs.test.cjs（歷史語法／版本比對）、tests/v610-admin-ui.test.cjs（老師精準刷新）。style.css、家具和石頭素材未改。

1. 備份最新程式與資料，在試算表副本驗證。
2. 更新Code.gs，保留已啟用Google Sheets API及老師密碼的Script Properties。
3. 執行 setupOrMigrateSubjectQuestionBanksV610()；檢查五科題數、額外欄位、分數題及原表保留。
4. 更新原Apps Script網頁部署，保留API URL。
5. 發布app.js、index.html，重載登入，驗收預抓／三錯／EXP／存檔與精準刷新。

回復到本階段前 `70b2658` 的前後端程式並重新部署；保留全部學生資料、交易、五科新表與原總題庫。舊版從原總題庫讀取；若上線後只在新分科表新增或編輯題目，回復前須另行人工核對並安全同步這些題庫設定，不能用還原舊學生資料快照取代。無需清空任何資料。
本輪沒有操作正式Sheets、執行線上migration或部署；使用者原有未提交的石頭圖片修改保留。
