# V5.9.6 高速架構版

這版可以直接從 V5.9.4 更新，不需要先安裝 V5.9.5。

## 主要加速

### 1. 登入
以前登入會等小屋完整資料。
現在 `loginFastV596` 只驗證學號＋生日＋基本資料，成功後立即進畫面。
寵物、土地、背包、背景、怪物、技能、題庫再由 `getPostLoginBundleV596` 背景一次載入。

### 2. 題庫與技能
五科題庫登入後一次預載到瀏覽器。
開始對戰與點技能正常情況不再呼叫 Apps Script。
題庫快用完時直接從瀏覽器記憶體重新洗牌，不再卡著等 Google Sheet。

答案改成累積 8 題背景同步；3 次答錯與離開戰鬥才強制等待同步。

### 3. 怪物
開始戰鬥不再重複 `loadMonsterCatalog()`。
登入後背景載入一次即可。

### 4. 老師發道具
改用 `adminGrantItemFast`。
已找到過的「學生＋道具」資料列會快取 6 小時，後續直接定位更新。
也移除每次發放後多餘的學生資料讀取。

### 5. Setup
只執行：
`setupOrUpgradeV596()`

不會再連鎖跑 V593 / V59 / V57。

## 更新檔案

GitHub：
- app.js
- index.html

Apps Script：
- apps-script/Code.gs

步驟：
1. 覆蓋上述檔案
2. Apps Script 執行一次 `setupOrUpgradeV596()`
3. 建立新部署版本
4. GitHub Commit / Push
5. 測試：
   https://bit111110.github.io/505-pet-house/?v=20261005-2030

## 注意
登入成功後首頁會先立即出現，寵物與小屋資料可能再過短暫時間補上。
這是刻意的「兩階段登入」，目的是不要讓學生一直卡在登入畫面。
