# V5.10.3 教室連線診斷版

新增老師後台「📊 教室連線診斷」。

可測：
- API 基本回應
- 學生基本資料
- 挑戰首頁
- 最近 10 次 API 耗時

判讀：
- 0–2 秒：🟢 良好
- 2–5 秒：🟡 尚可
- 5–10 秒：🟠 偏慢
- 10 秒以上：🔴 很慢

診斷只存在瀏覽器記憶體，不寫 Google Sheet。

更新：
GitHub：app.js、index.html
Apps Script：apps-script/Code.gs
執行：setupOrUpgradeV5103()
測試：https://bit111110.github.io/505-pet-house/?v=20261006-1955
