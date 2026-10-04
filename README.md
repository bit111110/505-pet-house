# V5.5.2 背景名稱即時同步修正版

問題原因：
V5.5.1 的背景商店名稱、價格主要來自 GitHub 的 `data/lands.json`。
所以你在 Google 試算表修改「名稱」後，GitHub JSON 沒變，網頁自然仍顯示舊名稱。

V5.5.2 改成：
- 背景「圖片檔」繼續直接從 GitHub assets 載入（快）
- 背景「名稱 / 價格 / 是否開放」改從 Google 試算表即時讀取
- 登入後會在背景自動同步一次，不阻塞登入
- 背景商店增加「↻ 更新背景資料」按鈕，可手動立即同步
- 購買背景時價格也直接讀最新試算表，不再吃 5 分鐘舊快取
- 目前土地與已購買背景的名稱也會使用最新試算表資料

## 更新
GitHub：
- app.js
- index.html

Apps Script：
- apps-script/Code.gs

Apps Script 需建立新版本重新部署。
不需重新執行 setupOrUpgradeV55()。
