# V5.9.7 半靜態高速版

這版可以直接從 V5.9.6.2 更新。

## 這次真正改的架構

### GitHub 直接讀
既有：
- data/pets.json
- data/lands.json

新增：
- data/battle-backgrounds.json
- data/monsters.json
- data/items.json
- data/pet-battle.json

目前已幫你寫好：
- BATTLE001 小巨人領地

其他三個 JSON 先放空陣列 `[]`，不會覆蓋你的現有設定。
網站會自動使用：
1. GitHub JSON
2. 瀏覽器 localStorage 快取
3. Apps Script 靜態設定 API
依序 fallback。

所以不會因為 JSON 尚未填完整就把你的怪物、道具或技能弄掉。

## 第二次登入會更快
共用設定會存在瀏覽器 30 分鐘：
- 怪物
- 對戰背景
- 寵物戰鬥設定
- 道具設定
- 土地背景設定

下次登入先直接使用本機快取，不等 Google Sheet。

## Apps Script 登入後 payload 也縮小
`getPostLoginBundleV596` 不再每次夾帶：
- 怪物
- 背景
- 對戰背景
- 寵物戰鬥設定

只保留學生個人資料：
- 信箱
- 未讀數
- 背包

共用設定另外背景更新，一次快取 30 分鐘。

## 更新方式

GitHub：
- app.js
- index.html
- data/battle-backgrounds.json
- data/monsters.json
- data/items.json
- data/pet-battle.json

注意：你原本 repo 裡的 `data/pets.json`、`data/lands.json` 不要刪。

Apps Script：
- apps-script/Code.gs

執行一次：
`setupOrUpgradeV597()`

然後建立新版本重新部署 Apps Script。

測試：
https://bit111110.github.io/505-pet-house/?v=20261005-2215

更新成功後左上應顯示：
V5.9.7 前端 20261005-2215
