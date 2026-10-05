# V5.9.4 題目圖片修正版

這版只針對「題目圖片沒有顯示」加強。

## 修正內容
1. 如果題庫有 `圖片路徑`，直接使用。
2. 如果只有 `圖片ID`，自動組成：
   `assets/math/圖片ID.png`
3. 對目前數學題庫的圖片題再加一層保險：
   - M001/M002 → IMG001
   - M004/M005 → IMG002
   - M009 → IMG003
   - M010 → IMG004
   - M025 → IMG005
   - M029 → IMG006
   - M032 → IMG007
   - M036 → IMG008
4. 題目圖片網址加上 build 參數，避免瀏覽器一直吃舊快取。
5. 圖片如果真的抓不到，不再偷偷消失，而會直接顯示「題目圖片載入失敗：...」方便找出路徑問題。

## 更新
GitHub：
- app.js
- index.html

Apps Script：
- apps-script/Code.gs

執行一次：
`setupOrUpgradeV594()`

然後重新部署 Apps Script，GitHub Commit / Push。

測試版本：
https://bit111110.github.io/505-pet-house/?v=20261005-1900
