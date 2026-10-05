# V5.9.6.1 題庫單科載入修正版

你截圖中的錯誤：
`API 回傳格式錯誤：<!DOCTYPE html>...`

這通常不是題目本身錯，而是 V5.9.6 一次把五科完整題庫塞進同一個 Apps Script 回傳。
資料量或執行時間一大，Google 可能直接回傳 HTML 錯誤頁，前端當 JSON 解析就會跳出這個訊息。

## 本版修正
- 不再登入後一次傳五科完整題庫
- 改成 `getQuestionBankSubjectFast(科目)`
- 開始數學對戰只抓「數學」
- 其他科目登入後一科一科背景預載
- 每科獨立快取 10 分鐘
- `getPostLoginBundleV596` 不再夾帶巨大 questionBank

## 你截圖還有一個重要線索
截圖左上是：
`V5.9.6 前端 20261005-1900`

但真正 V5.9.6 高速版應該是：
`20261005-2030`

表示你 GitHub 上的 index/app.js 曾經出現版本混用。
這版更新完成後，左上應看到：
`V5.9.6.1 前端 20261005-2100`

如果不是這個數字，就不要繼續測，代表 GitHub 還沒有完整更新。

## 更新
GitHub：
- app.js
- index.html

Apps Script：
- apps-script/Code.gs

執行一次：
`setupOrUpgradeV5961()`

然後建立「新的部署版本」，再 GitHub Commit / Push。

測試：
https://bit111110.github.io/505-pet-house/?v=20261005-2100
