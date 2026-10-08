# V6.1 Phase 1：升級效能與批量屬性石

開發分支：`feature/v6.1-performance`。正式 V6.0 基底：`32d722a80abe36328cf8bf39191e5c04efac0ad6`。

## 操作與 API

選定已解鎖技能，可使用 1 / 5 / 10 顆或全部；確認對話框顯示數量、技能、強化與最終傷害的前後值。每顆固定 +5，延用 BigInt 十進位字串，沒有傷害強化上限。一般、屬性、Lv30 專屬技能均支援。

新增 `useAttributeStonesBatchV610(studentId, petId, skillId, itemId, quantity, requestId, token)`，已加入 `doPost()` 白名單。quantity 為正整數或 `ALL`；`ALL` 使用鎖內的實際全部庫存。`useAttributeStoneV600` 保留原參數及完整 bundle 回傳，供旧前端及尚未完成的 V6.0 單顆交易使用。它不會以單顆恢復程序处理 V6.1 未確認批量交易。

新版前端一次操作只發送一次批量 API，成功時套用 `usedQuantity / remainingStone / addedDamage / totalBonus / finalDamage`，只修改庫存與技能的數字及按鈕狀態。原升級 DOM、選定寵物與頁面位置保留；沒有呼叫 `renderUpgrade()` 或再次取得完整 bundle。經驗糖果沿用既有流程。

## 永久冪等交易

延用「技能強化紀錄」，唯一鍵為學號 + requestId，並驗證寵物、技能、道具、使用數量一致；同一 ID 更換內容會拒絕。前端在送出前保存請求到既有 localStorage pending key，處理中停用按鈕，逾時保留原 ID 和數量。

鎖內驗證所有權、屬性、技能解鎖、庫存與未確認交易。一次新增 PENDING 紀錄，傷害加成保存為 N×5。Google Sheets API 的單次 `batchUpdate` 同時提交一個庫存數量儲存格及紀錄的 DONE 狀態。DONE 才算交易完成，也只有 DONE 才納入永久技能加成。

若回應遺失但原子提交成功，重送查到 DONE，不再扣款或增加傷害；保留原用量與本次加成，並以目前庫存／累積加成回覆，避免後續消耗後顯示過期數量。同帳號兩個分頁共用 ScriptLock，無法同時通過提交檢查。

若仍為 PENDING，不能從庫存推測結果、不能重新派送原子寫入，亦不能建立另一筆強化。稍後重試只查交易狀態；持續未確認需老師查核 Sheets 執行結果。這延用 V6.0 原子交易結果不確定時的保守策略；不要刪除 PENDING 來繞過保護。

## 效能比較

`tests/v610-performance.test.cjs` 用同一個記憶體 Sheets fixture 比較正式 V6.0 與新版，共用設定快取已暖、信箱有資料：

| 項目 | V6.0 單顆 | V6.1 使用 10 顆 |
|---|---|---|
| 前端 API 次數 | 1 | 1 |
| 後端重建完整 upgrade bundle | 是 | 否 |
| 全表資料讀取 | 8 次 | 0 次 |
| 全表讀取來源 | 強化紀錄 3、學生寵物 2、學生道具 2、信箱 1 | 僅各表學號索引欄 + 該學生連續資料列 |
| 庫存扣除 | 一個數量儲存格 | 一個數量儲存格 |
| 永久強化紀錄 | 一筆 | 一筆，保存 N×5 |
| 完成後頁面重建 | 多次 renderUpgrade | 不重建，局部更新 |

原先使用 10 顆需做 10 次單顆操作；新版不迴圈呼叫 API。舊單顆 API 的完整回傳仍保留給相容用途。

`getUpgradeBundleV600()` 首次／手動更新也改為讀取學號欄和該學生資料列，技能紀錄一次讀入同時產生 pending 與加成。設定表仍使用既有共用快取；快取未命中時讀設定表。學號索引掃描仍隨全班資料列數成長，零全表讀取不表示常數時間；此報告為讀取結構測量，未量測正式 Apps Script 的網路延遲。

## 檔案與結構

- `app.js`：數量按鈕、確認資訊、持久請求、防連點、局部更新。
- `index.html`：更新 app.js 的資源版本參數。
- `apps-script/Code.gs`：目標學生列讀取、精簡 batch API、白名單、setup 與舊交易相容保護。
- `tests/v610-stones.test.cjs`：數量、拒絕條件、冪等、鎖競爭、逾時、永久資料與舊 API。
- `tests/v610-upgrade-ui.test.cjs`：真實 Chrome 桌面／平板／手機、確認、DOM 保留、局部更新、單次 API 和重試。
- `tests/v610-performance.test.cjs`：與 V6.0 基底的讀取比較及舊交易核心相容檢查。
- `tests/v600.test.cjs`、`tests/v600-battle-ui.test.cjs`：配合新回傳、DOM 與交易安全保護更新測試；對戰規則、UI、信箱機率未修改。
- 本說明文件。

沒有新增工作表；「技能強化紀錄」末尾新增 `使用數量`、`強化結果` 兩欄。前者保存請求的數量／ALL，後者保存該交易的精簡結果。舊紀錄不填寫或改動這兩欄，既有傷害加成直接納入新累積值。

## 部署與回復

1. 備份正式試算表與 V6.0 Apps Script 程式；先在測試副本驗證。
2. 更新 Code.gs，保留已啟用的 Google Sheets API 服務。
3. 執行 `setupOrUpgradeV610()`；先呼叫安全、冪等的 V600 setup，再只補兩個技能紀錄欄位。不重設学生／庫存／技能紀錄，可重複執行。
4. 更新原 Apps Script 網頁部署，沿用原 URL。
5. 發布 app.js、index.html，重新載入登入，測試批量與逾時重送。

回復 V6.0：先停止新寫入，保存最新資料，確認全部 V6.1 PENDING 的實際結果；不得讓未知提交繼續執行時回退至舊數量恢復流程。將 app.js、index.html、Code.gs 回復到上述 V6.0 基底並重新部署。保留新增欄位及全部 DONE 紀錄；V6.0 已會加總每筆傷害加成，因此批量永久傷害不會遺失。不要把資料表回復舊備份或清空技能紀錄。

測試使用記憶體 Sheets 和真實 Chrome／模擬 API；沒有操作正式 Google Sheets、執行線上 setup 或部署。
