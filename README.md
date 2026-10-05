# V5.9.3 題目圖片支援版

這版是為了讓你剛剛那批數學題可以安全貼進「挑戰題庫」。

## 挑戰題庫新增欄位
- 單元
- 圖片ID
- 圖片路徑

例如：
IMG001 | assets/math/IMG001.png

圖片請放 GitHub：
assets/math/

注意路徑要用 `/`，不要用 Windows 的 `\`。

## 題目畫面
如果「圖片路徑」有值：
- 題目文字下方自動顯示圖片
- 再顯示選項
- 圖片最大高度已限制，不會把畫面撐爆

如果圖片讀不到，圖片區會自動隱藏，不會讓整題壞掉。

## 更新方式
GitHub：
- app.js
- index.html

Apps Script：
- apps-script/Code.gs

然後：
1. 執行一次 `setupOrUpgradeV593()`
2. 建立新版本重新部署 Apps Script
3. GitHub Commit / Push

之後再把題庫資料貼進試算表。

測試網址：
https://bit111110.github.io/505-pet-house/?v=20261005-1745
