# V6.0 Blocker 1：永久信箱入帳交易

## 完成與去重依據

每封信交易 ID 是 MAIL_V600: 加上 [學號, 信件ID] 的 JSON 表示。相同信件重試永遠使用同一個 ID，不依賴前端產生 ID，也不使用目前庫存量推論有沒有入帳。

沿用「信箱／領取交易」欄，JSON version:2 包含 transactionId、itemId、quantity、status。COMMITTED 是永久入帳證明；SUBMITTED 表示已送出／結果未確認。舊版 before/after JSON 不會被清空或自動改寫成已完成。

單封 claimMail、claimMailFast 與全部 claimAllMailFast 共用 claimMailsLockedV600_。全部領取將本次全部道具與信件組成一次 batchUpdate；只更新受影響的列和儲存格，不整張寫回學生道具表。

流程：鎖內驗證信件／附件、準備加總與永久 ID → 存 SUBMITTED 並 flush → Google Sheets API spreadsheets.batchUpdate 一次原子提交道具數量、COMMITTED、是否領取=true。

**原子批次成功時才視為入帳完成。** 任一子請求失敗時整批不入帳；回應丟失時資料可能已全部完成，重試只讀永久完成紀錄，不再加道具。COMMITTED 即使信箱布林標記遺失，也只補標記，不讀庫存猜測或重發。

官方原子保證：https://developers.google.com/workspace/sheets/api/guides/batch

## Timeout 與不明結果

上次已 COMMITTED：直接回目前庫存與信箱狀態，不增加道具。學生先使用糖果／石頭再重試，也不重發。

仍 SUBMITTED：不重送入帳請求。原請求可能仍在 Google 伺服器完成中，重送會有風險。稍後若原請求完成，再試可讀到 COMMITTED；若長期停在 SUBMITTED，需老師核對，不保證自動恢復。

尚未確認時，同學生／同道具的糖果消耗、寶物兌換、老師發放及其他信件領取均暫停變更。相關入口使用同一把 ScriptLock；這是在 timeout 的舊 RPC 仍可能完成時，保護後續庫存更新，並非改變道具效果。COMMITTED 後即恢復正常。

鎖外取得回傳庫存與未讀數；全部領取共用一次庫存讀取與一次原子 RPC。未新增全域前端事件或新庫存。

## 舊交易相容

已領取的舊信件維持已領取，不補發。

沒有舊領取交易的未領信件可使用新核心。

仍有舊 before/after JSON 且未領取的信件：其資料不足以證明曾否入帳，系統保留紀錄並要求老師核對，不會再比較數量猜測。禁止清空「領取交易」後重試。確認已入帳才補已領取／完成紀錄；確認未入帳才依人工核對流程補發並保存原交易及核對紀錄。無法確認時不自動補發。核對前必須停止相關寫入並排除仍在執行的請求。

## 部署

- 不新增 API、工作表或欄位。沿用 V6.0 已有「領取交易」欄。
- 已執行最終 setupOrUpgradeV600() 者，不必重跑；只有尚缺該欄位時才執行它。
- Apps Script 左側「服務」新增 Google Sheets API，識別字 Sheets。若使用標準 Google Cloud 專案，亦須啟用該專案的 Google Sheets API。
- 在編輯器執行 checkMailTransactionServiceV600()，完成服務與試算表存取授權檢查；它只讀取 spreadsheetId，不改學生資料。
- 更新原 Web App 部署。前端 app.js／index.html／style.css 沒有修改，不需為本修正重新發布。
- Google Sheets API 未啟用時，在寫入 SUBMITTED 或庫存之前拒絕領取；不降級使用非原子的逐格寫入。

未修改掉落機率、技能強化資料結構、對戰 UI 或 syncChallengeBatch。答題同步 blocker 不在本修正範圍。

## 驗證

~~~powershell
Get-Content -Raw -Encoding UTF8 apps-script/Code.gs | node --check
node --check app.js
node tests/v600.test.cjs
node tests/v600-mail.test.cjs
node tests/v600-mail-idempotency.test.cjs
node tests/v600-battle-ui.test.cjs
~~~

最後一項使用 playwright 與 Chrome；NODE_PATH 可設為 Codex bundled Node packages 目錄。

冪等測試涵蓋正常／連點、原子提交後回應丟失、消耗後重試、單封／全部請求互斥、石頭／糖果／一般道具、批量一次 RPC、信箱子請求失敗全批不入帳、延後完成的 RPC、不明結果禁止重送與同道具變更、舊交易保留及服務缺失。服務是記憶體原子批次模型，Chrome 使用假資料，未操作正式 Sheets；部署後仍需測試 API 服務權限與正式環境的交易行為。

## 回復

保留所有交易 JSON、信件、庫存與學生資料。先完成／核對未確認交易，再回復上一版 Code.gs 與部署版本；前端維持原版。本修正前的版本具有已知重複入帳風險，不應在交易未確認時直接回復並開放領取。不要刪除交易欄或清空學生資料。
