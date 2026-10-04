# V5.9.1 CSS 緊急修正版

問題原因：
上一個 V5.9.1 壓縮檔內的 `style.css` 只有新增的屬性圖示樣式，
如果拿它覆蓋 GitHub 原本完整 `style.css`，整個網站就會變成幾乎沒有排版的 HTML。

這個修正版已把完整原始 CSS 恢復，並保留：
- V5.9 / V5.9.1 功能
- 怪物圖片樣式
- 屬性 spritesheet 小圖示樣式

## 最快修復
如果你目前 V5.9.1 已經更新完：
只要把這個壓縮檔裡的 `style.css` 覆蓋 GitHub 現在的 style.css，
再把 `index.html` 和 `app.js` 一併覆蓋以更新快取版本即可。

Apps Script 不用動、不用重新執行 setup。
