# V5.9.8 試算表唯一來源 + 一鍵更新快取

這版取代 V5.9.7 的「GitHub JSON 當主資料」做法。

## 以後你怎麼新增東西？

### 新增寵物
1. 圖片放 GitHub，例如：
   - assets/pets/PET025_1.png
   - assets/pets/PET025_2.png
   - assets/pets/PET025_3.png
2. 在 Google 試算表「寵物設定」新增 PET025。
3. 老師後台按「🔄 更新遊戲設定」。
4. 完成。

### 新增怪物 / 道具 / 戰鬥背景 / 土地背景 / 專屬技能
一樣：
1. 圖片素材放 GitHub。
2. 設定只改 Google 試算表。
3. 老師後台按「更新遊戲設定」。

不用再手動編 JSON。

## 快取
- Google Sheet 是唯一主資料。
- Apps Script 共用設定快取：最長 6 小時。
- 學生瀏覽器也會保存共用設定 6 小時。
- 老師按「更新遊戲設定」後，會：
  1. 清除舊 Apps Script 快取
  2. 重新讀取 Google Sheet
  3. 立即重建設定
  4. 老師自己的瀏覽器也立即更新

學生重新整理/再次登入後就會取得新設定。

## GitHub JSON
V5.9.7 建立的：
- data/monsters.json
- data/items.json
- data/battle-backgrounds.json
- data/pet-battle.json

可以留著，不會再作為主設定來源；V5.9.8 的 app.js 不再讀它們。

## 更新
GitHub：
- app.js
- index.html

Apps Script：
- apps-script/Code.gs

執行一次：
`setupOrUpgradeV598()`

建立新版本並重新部署 Apps Script。

測試：
https://bit111110.github.io/505-pet-house/?v=20261005-2315

更新成功後左上應看到：
V5.9.8 前端 20261005-2315
