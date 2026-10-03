# 505 班級寵物小屋 V5.2 — Cache Bust 修正版

這次不是再改信箱邏輯，而是修正 GitHub Pages 仍可能載到舊版 `app.js` 的問題。

前一版 `index.html` 雖然已經是 V5.1，但引用仍然是：

- `style.css?v=5.0.0`
- `config.js?v=5.0.0`
- `app.js?v=5.0.0`

因此瀏覽器 / GitHub CDN 可能繼續使用舊 JS，造成你明明上傳 V5.1，點信箱卻還是執行舊的「每次即時 fetch」流程。

V5.2 已改成唯一版本：
- `style.css?v=20261004-0052`
- `config.js?v=20261004-0052`
- `app.js?v=20261004-0052`

登入頁標題也會顯示「班級寵物小屋 V5.2」，登入後上方會顯示：
`前端 20261004-0052`

如果看不到這個版本字樣，就代表瀏覽器還沒有載到新檔。

## 更新

GitHub 請至少覆蓋：
- index.html
- app.js
- config.js
- style.css

Apps Script 請覆蓋：
- apps-script/Code.gs

之後：
1. GitHub Commit
2. 等 GitHub Pages 部署完成
3. Apps Script 建立新版本重新部署
4. 網站網址最後加 `?v=20261004-0052` 開啟一次
5. 確認首頁看到「V5.2」

這版沿用 V5.1 的即時信箱快取：
- 登入時先載信箱
- 點信箱不 fetch
- 只在背景更新
