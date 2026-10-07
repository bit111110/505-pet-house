# V5.10.6 效能急救版

針對「單人使用就出現背景同步逾時」：

- 登入後不再自動下載整包共用設定。
- 商店不再每次進入都同步 Google Sheet，改用瀏覽器快取。
- 只有第一次沒有背景資料或按「手動更新背景設定」時才連後端。
- 同步失敗但已有快取時，商店仍可使用，不會整頁卡死。
- 對戰的怪物、戰鬥背景、寵物戰鬥設定改成真正進入對戰時才用小型 API 載入。
- Apps Script 整包設定增加鎖定，降低多人同時命中空快取造成的尖峰。
- 不刪除、不重設任何學生資料。

更新：
GitHub：app.js、index.html
Apps Script：apps-script/Code.gs
執行一次：setupOrUpgradeV5106()
重新部署 Web App。

測試：
https://bit111110.github.io/505-pet-house/?v=20261007-0015