# V6.0 答題批次冪等同步

## 唯一識別與永久結果

新版前端每批建立 UUID batchId，使用原 API 的第五參數：syncChallengeBatch(studentId, subject, petId, answers, batchId)。前四參數的順序及既有回傳欄位保持相容；亦支援第四參數為 {batchId, answers}。

以「學號＋batchId」為永久唯一識別，同 ID 必須使用相同科目、寵物及答案內容。完成後重送會讀取第一次的 JSON 結果，原樣回傳，不再次判定題目、累加統計或增加寵物 EXP。即使已有更新的批次或跨過重置時間，也回傳原結果而不修改目前統計。

一般四參數舊呼叫由後端為內容產生 SHA-256 的 LEGACY-* ID，避免舊頁面原封重送造成重複計分。此相容模式無法區分「內容完全相同但其實是新一批」；所以部署後必須重新載入前端，使用每批 UUID，才能正常區分題庫循環中的新批次。不得以新 ID 重試尚未確認的舊批次。

Digest API 依官方規格：https://developers.google.com/apps-script/reference/utilities/utilities

## 最小資料擴充

不新增工作表。setupOrUpgradeV600() 在既有「獎勵紀錄」末端補六欄：

- 答題批次ID
- 答題科目
- 答題寵物ID
- 答題內容
- 答題交易狀態
- 答題結果

每批一列。既有前六欄順序與歷史獎勵保留；學生資料、寵物資料、題庫、信箱欄位均不搬移或清空。重跑 setup 不重發道具或重設學生。

僅掃描學號、批次 ID 與交易狀態欄，再讀取目標／未確認交易列的完整內容，不逐列重讀所有已完成批次。

## 原子完成與 Timeout

使用同一把 ScriptLock。先驗證資料與身分並永久記錄 SUBMITTED，再透過已啟用的 Sheets API batchUpdate，原子提交答對數、錯誤數、總 EXP、寵物等級與 EXP，以及 COMMITTED／第一次結果。

原子批次成功才視為完成。任一子請求失敗時整批不套用，避免「分數成功但 EXP／去重紀錄失敗」。已成功但回應遺失，重送讀到 COMMITTED，回傳原結果。

若結果仍為 SUBMITTED，原 RPC 可能還在執行，不會盲目重新寫入。原請求稍後完成便可重試讀回結果；長期未完成須老師核對。期間阻止同學生新答題批次及同寵物的其他 EXP 寫入，避免晚到的 RPC 覆蓋新數值。舊 addPetExp_ 與糖果入口只新增此保護，不改 EXP 規則。

三次錯誤即停止該批剩餘題目；題目驗證沿用顯示值快取及 normalizeAnswer_。EXP 次數門檻、最高 30 級與保留既有超過上限資料的規則保持。

## 前端重試

每批送出前，將 batchId、學號、科目、寵物、答案與時間保存到獨立 localStorage key。收到成功才移除。timeout／重新載入後保留原 ID、原內容；新答案另建新批次，不合併到未確認批次。兩分頁採各批獨立 key，刪除某批不會覆蓋另一分頁的待送批次。儲存失敗時不送出，答案仍留在 pending。

維持既有 flushChallengeAnswers 的批次同步時機與儲存離開前強制同步。只處理已形成／待同步批次，不改對戰舞台、技能、傷害或存檔 API。index.html 僅更新 app.js cache query，避免載入舊版前端。

## 檔案與部署

修改 app.js、apps-script/Code.gs、index.html（只改快取版本）、tests/v600.test.cjs（日期／digest mock）、tests/v600-battle-ui.test.cjs（相容斷言、正確同步回傳及 HTTPS 測試）。新增 tests/v600-challenge-idempotency.test.cjs 與本文件。

新增 API：無，doPost 白名單保留 syncChallengeBatch 及其餘 action。信箱交易核心、石頭設定／機率、對戰 UI 與存檔 API 均保持原樣。

部署前暫停學生寫入並確認舊版沒有尚待確認的請求；舊版曾完成但沒有永久批次 ID 的歷史請求無法回溯去重。

1. 更新 Apps Script Code.gs。
2. 再執行一次 setupOrUpgradeV600()，補齊六欄。
3. 更新原 Web App 部署，沿用原 exec URL。已通過的 Google Sheets API 服務可直接沿用。
4. 發布 app.js、index.html，請學生重新載入／登入。
5. 用測試學生驗證正常批次、timeout 重試、EXP、三次錯誤與儲存續戰。

## 測試

~~~powershell
node --check app.js
Get-Content -Raw -Encoding UTF8 apps-script/Code.gs | node --check
node tests/v600.test.cjs
node tests/v600-mail.test.cjs
node tests/v600-mail-idempotency.test.cjs
node tests/v600-challenge-idempotency.test.cjs
node tests/v600-battle-ui.test.cjs
~~~

瀏覽器測試需要 playwright 與 Chrome，NODE_PATH 可指向 Codex bundled packages。

新增測試涵蓋正常、原樣重送、timeout、不同 ID、同帳號互斥、三次錯誤、EXP 一次、首次結果永久回傳、跨日、相同 ID 不同內容拒絕、舊參數／envelope、分數日期顯示值、EXP 曲線與滿級、原子失敗、前端持久重試／重新載入／新答案拆批與 storage 失敗。既有信箱與 UI 回歸一併執行。

單元測試使用記憶體 Sheets 原子模型，Chrome 使用假 API；未修改正式學生資料，正式環境的權限及網路行為仍需部署測試。

## 回復

回復前先完成／核對 SUBMITTED 交易與所有待同步前端批次，保留六欄及所有批次紀錄。再發布上一版 Commit 330ac12 的 app.js、index.html、Code.gs 並更新 Web App 部署；不清空或重設任何學生資料。上一版缺少答題提交去重，回復後會恢復已知風險，因此不能在未確認交易仍存在時直接開放學生寫入。
