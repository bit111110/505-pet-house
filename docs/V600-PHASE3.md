# V6.0 第三階段：對戰主畫面

## 修改範圍

只修改前端對戰佈局與視圖生命週期。Code.gs、信箱掉落常數、屬性石數量機率與升級資料結構均維持第二階段版本。遊戲資料仍使用同一個 challenge 物件及既有 API。

對戰模式將 studentLayout 切成單欄，隱藏右側資訊卡。原分頁按鈕移到上方，保持切頁入口。battleMain 上方是大型戰鬥舞台，下方 battleControls 包含技能、題目／圖片／選項、作答結果及儲存離開。題目沒有 modal；選擇題、填充題與是非題沿用原判定與格式化函式。

技能使用 getConfiguredPetSkills 的最終傷害，顯示「威力 125（強化 +20）」。一般、屬性、30 級專屬技能及永久加成維持不變。

手機、平板採單欄操作區，技能清單可捲動，題目與答案正常文件流顯示；選項和離開按鈕具有觸控高度，不鎖定整頁捲動。

## DOM 與動畫清理

cleanupBattleViewV600_ 集中處理：遞增視圖識別值、clearTimeout 所有對戰動畫／傷害字／儲存提示計時器、解除動畫等待 Promise、清空 battleMain。切回小屋、升級、道具、信箱、商店、挑戰首頁及登出都會走此清理。

事件沿用 DOM 的 inline onclick，沒有新增全域對戰事件監聽；DOM 移除時一併移除按鈕事件。每次進入只建立一組舞台和操作區。進入對戰也停止小屋漫遊 interval；只有小屋模式需要更新小屋畫面。

題庫、存檔查詢、續戰、開始戰鬥、存檔完成及動畫完成都檢查視圖／登入身分，避免晚到的回應將使用者拉回已離開的對戰。清理不丟棄尚待同步的答題；切換科目前先同步既有 pending。

作答過程防連點並停用操作。傷害與怪物進度先在 challenge 結算，舞台待動畫後重新顯示，避免動畫中切頁留下過時 HP。答題判定、EXP 計算、答錯 30% 傷害、3 次錯誤鎖定與同步 API 保留。

## V5.10.5 存檔相容

繼續使用 getBattleProgressV5105 / saveBattleProgressV5105 / clearBattleProgressV5105。

存檔仍是 subject、petId、monsterNo、monsterHp、monsterMaxHp、seen（沿用最多最近 80 題）。續戰恢復科目、寵物、怪物編號、已存最大 HP、目前 HP 及 seen；優先選未看題目，題庫用盡時維持原循環補題行為。存檔前先同步答案；新佈局不改後端資料格式。

## 檔案與部署

- app.js：大型對戰、固定答題區、視圖清理、非同步保護。
- index.html：主畫面容器、共用導覽及前端 build query 更新。
- style.css：戰鬥佈局與手機／平板響應式樣式。
- tests/v600.test.cjs：第一階段原本「UI 函式完全相同」斷言改為遊戲規則不變；第三階段另以實際瀏覽器測試 UI。
- tests/v600-battle-ui.test.cjs：Chrome 對戰 UI 與存檔流程測試。
- docs/V600-PHASE3.md：本說明。

新增 API／工作表／欄位：全部無。不需要再次執行 setupOrUpgradeV600()。Code.gs 未修改，不需要重新部署 Apps Script；僅發布 app.js、index.html、style.css。

## 驗證命令

~~~powershell
node --check app.js
Get-Content -Raw -Encoding UTF8 apps-script/Code.gs | node --check
node tests/v600-mail.test.cjs
node tests/v600-battle-ui.test.cjs
~~~

瀏覽器測試需要 Node 的 playwright 套件與已安裝 Chrome；也可用 BATTLE_BROWSER_CHANNEL=edge。若使用 Codex bundled dependencies，將 NODE_PATH 設為 load_workspace_dependencies 回傳的 Node packages 目錄。BATTLE_SCREENSHOT_DIR 可選，用來儲存桌面／平板／手機截圖。

測試攔截所有資源請求，以本機檔案及假資料執行，不呼叫正式 Apps Script。桌面 1440×1000、平板 768×1024、手機 390×844 皆驗證舞台上下順序、無橫向溢出、題型、圖片、125 強化傷害、EXP、作答防連點、三次錯誤、冷題庫載入、存檔續戰、已看題目與切頁清理。未驗證正式 Apps Script 網路與正式學生存檔；後端本階段未變更。

## 回復第二階段

重新發布 Commit 6bb6804 的 app.js、index.html、style.css。Apps Script 維持第二階段部署。學生資料、石頭庫存、強化紀錄、信箱及對戰存檔全部保留，不執行清空或重設。
