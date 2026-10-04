# V5.9.1 屬性圖集支援

這版是在 V5.9 上增加同一張 spritesheet 顯示屬性圖。

## 圖片放置
GitHub 建立：

`assets/attributes/attributes.png`

請維持 4欄 × 3列，順序固定：

第一列：
- 光
- 地
- 暗
- 草

第二列：
- 水
- 毒
- 火
- 電

第三列：
- 冰
- 風
- 鋼
- 混沌

## 顯示位置
- 寵物選擇畫面
- 對戰中的寵物名稱旁
- 技能按鈕

程式會自動從同一張 `attributes.png` 裁出對應格子。

## 更新方式

如果你還沒更新 V5.9：
直接使用這個 V5.9.1 覆蓋即可，不用先部署 V5.9。

GitHub：
- app.js
- index.html
- style.css
- assets/attributes/attributes.png

Apps Script：
- 使用 V5.9 的 Code.gs
- 執行一次 `setupOrUpgradeV59()`
- 建立新版本重新部署

測試網址：
https://bit111110.github.io/505-pet-house/?v=20261004-2230
