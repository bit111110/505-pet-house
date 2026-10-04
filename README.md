# V5.8 Apps Script 效能優化版

這版的目標不是加功能，而是減少 Google Apps Script / 試算表 I/O。

## 主要改善

1. 登入後原本會同時呼叫：
   - getMailboxFresh
   - getInventory
   - getBackgroundCatalogFresh
   - getMonsterCatalogFresh

   現在合併成一次：
   - getRuntimeBundleFast

   也就是 4 次 Apps Script 啟動成本 → 1 次。

2. 登入初始化不再重複跑兩次
   - 原本 loginV55 會 ensureStarterData + ensurePlotData
   - getStudentCoreStateV55 又再跑一次
   - 現在只會做一次，且同一學生 6 小時內用快取略過初始化檢查。

3. 信箱不再每次整張掃描
   - 顯示信箱時，從資料尾端分段往回找最近 100 封
   - 信箱累積到數千 / 數萬列時差異會很明顯。

4. 整點禮物批次寫入
   - 原本漏 20 個整點 = appendRow 20 次
   - 現在一次 setValues 寫入。

5. 一鍵收取改成批次處理
   - 道具一次整理
   - 信件領取狀態用 RangeList 一次更新
   - 不再一封信一個 setValue。

6. 背景 / 怪物設定加入短期快取
   - 背景：30 秒
   - 怪物：5 分鐘
   - 商店仍提供「強制同步」按鈕，按下去會讀最新試算表。

7. 表頭 headerMap 加 6 小時快取
   - Code.gs 很多函式原本每次都會再讀第一列。
   - 現在同一工作表不會一直重讀表頭。

## 更新方式

GitHub 覆蓋：
- app.js
- index.html

Apps Script 覆蓋：
- apps-script/Code.gs

然後：
1. 儲存 Apps Script
2. 不需要執行 setupOrUpgrade
3. 部署 → 管理部署作業 → 編輯 → 建立新版本 → 部署
4. GitHub Commit / Push

測試網址：
https://bit111110.github.io/505-pet-house/?v=20261004-2100

## 不會動到
- 學生資料
- 寵物資料
- 土地 / 背景
- 信箱
- 道具數量
- 題庫
- 怪物設定

只改讀寫方式，不重製資料表。
