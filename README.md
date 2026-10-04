# 505 班級寵物小屋 V5.4 — GitHub 固定資料版

這版已經直接幫你接好 `data/pets.json` 和 `data/lands.json`。

## 已改成直接從 GitHub 讀取
- 寵物名稱
- 寵物三階段圖片
- 寵物移動類型
- 寵物對話
- 土地名稱
- 土地價格
- 土地背景圖
- 土地尺寸

## Google Sheets 仍保留
- 哪位學生擁有哪些寵物
- 寵物等級 / EXP / 位置 / 所在土地
- 學生擁有土地
- 金幣
- 信箱
- 道具
- 挑戰紀錄

也就是「固定設定走 GitHub，學生動態存檔走 Google Sheets」。

## 這次怎麼更新
只需要更新 GitHub，不需要重新部署 Apps Script。

把以下內容覆蓋到 Repository：
- `index.html`
- `app.js`
- `data/pets.json`
- `data/lands.json`

`style.css`、`config.js` 可以沿用原本檔案；整包上傳也可以。

更新後開：
`https://bit111110.github.io/505-pet-house/?v=20261004-1605`

首頁應顯示 V5.4。

## 效能
土地商店現在也直接使用 `lands.json`，不需要為了顯示土地清單再呼叫 Apps Script。
寵物與地圖圖片直接由 GitHub Pages 載入。
