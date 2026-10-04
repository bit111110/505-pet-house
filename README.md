# V5.9

這版只先做你指定的三項。

## 1. 對戰背景設定
新增工作表：`對戰背景設定`

欄位：
- 背景ID
- 名稱
- 圖片
- 適用科目
- 是否開放

GitHub 建議放：
`assets/battle-backgrounds/BATTLE001.webp`

範例：
`BATTLE001 | 森林戰場 | assets/battle-backgrounds/BATTLE001.webp | 全部 | TRUE`

## 2. 寵物屬性與技能
我把你打的「第」視為「地」。

屬性下拉：
光 / 地 / 暗 / 草 / 水 / 毒 / 火 / 電 / 冰 / 風 / 鋼 / 混沌

`寵物設定` 會新增：
- 屬性

新增工作表：`寵物技能設定`

欄位：
- 技能ID
- 寵物ID
- 技能名稱
- 屬性
- 解鎖等級
- 基礎傷害
- 傷害成長
- 圖示
- 是否開放

目前傷害：
`基礎傷害 + (寵物等級 - 1) × 傷害成長`

答錯仍然只造成 30% 傷害。

## 3. 道具圖片顯示
「我的道具」與「寵物升級」現在會顯示 `道具設定` 的圖片欄。

例如：
`assets/items/EXP001.png`

## 更新
GitHub：
- app.js
- index.html

Apps Script：
- apps-script/Code.gs

更新 Apps Script 後：
1. 執行一次 `setupOrUpgradeV59()`
2. 建立新版本重新部署
3. GitHub Commit / Push

測試：
https://bit111110.github.io/505-pet-house/?v=20261004-2200

動畫這版完全沒做，先把系統骨架穩定好。
