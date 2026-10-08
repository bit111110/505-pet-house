# V6.1 Phase 3：共用石頭 sprite 與家具系列瀏覽

本階段沒有家具購買、發放、擺放或拖曳功能。沿用既有家具設定與學生家具；登入不讀家具設定、系列或擁有資料。既有單人／批次發放、強化交易、信箱交易、掉落機率、答題與對戰 API 核心不變。

## 屬性石

唯一執行期圖片：`assets/items/stones/attribute-stones.png`，512×384，4 欄 × 3 列，每格128×128。

|列|索引及屬性|
|---|---|
|1|0 光、1 地、2 暗、3 草|
|2|4 水、5 毒、6 火、7 電|
|3|8 冰、9 風、10 鋼、11 混沌|

`app.js` 的 `STONE_SPRITES_V610` 按既有 STONE_ ID 固定映射；`itemImageHtmlV610()` 是共同 renderer。`activateStoneSpritesV610()` 在實際顯示石頭時才開始單一 Image 請求，成功後套用相同 URL、CSS 400%×300% 與對應位置。失敗保留 💎，同一頁不反覆請求。升級頁、背包、信箱附件及老師批次發道具所選道具均使用此 renderer。

不新增道具欄位；setup 只把12個既有石頭設定的「圖片」設成共用路徑。其名稱、類型、效果值、庫存及永久強化紀錄不變。SVG 是可維護的素材來源，瀏覽器不下載 SVG。重建 PNG：

```powershell
$env:NODE_PATH='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tools/render-stone-sprite.cjs
```

## 家具資料與 API

新增 `家具系列`：`系列ID、系列名稱、預覽圖片、排序、是否啟用`。

沿用 `家具設定` 的 `家具ID、名稱、價格、圖片、類型、是否開放`，只補 `系列ID、縮圖路徑、排序`。「圖片」仍是原圖；不改成縮圖。`學生家具` 完全保留，不補欄、不寫入、不重設。

類型驗證包含「地面型、浮空型」及所有現存類型。既有未填系列的家具由 API 歸為 LEGACY／既有裝飾，setup 不改寫原家具列。已使用但沒有系列設定的系列ID會補一筆系列名稱，預覽圖片保持空白供老師自行填入。

不預先建立假的森林／海洋商品或虛構件數。空資料表會顯示空狀態；老師可在家具設定與家具系列中新增真實素材。系列 ID 需唯一，家具列的系列ID對應系列設定。圖片用 `assets/...` 或 HTTP(S) URL；Base64 不回傳。建議列表縮圖128×128 WebP、原圖透明PNG/WebP。沒有縮圖時顯示 🪑，不偷用原圖取代。

- `getFurnitureSeriesV610(forceRefresh=false)`：只回系列ID、名稱、預覽路徑、啟用家具件數及排序；不內嵌家具。件數只讀家具 ID／系列 ID／開放欄。
- `getFurnitureBySeriesV610(seriesId,forceRefresh=false)`：只讀指定系列的連續列範圍，回該系列家具 metadata。停用系列不可查；停用家具不列出。

兩支唯讀 API 都已加入 doPost 白名單；不移除任何舊 action。不新增學生家具資料來源。

前端「家具系列」頁才呼叫首頁API；點系列才呼叫家具API。系列 preview／縮圖使用 IntersectionObserver，元素進視窗才設定 src；沒有此API的瀏覽器用可視範圍檢查與可清理的 scroll/resize 監聽。原圖只有按「預覽原圖」才設定 src。缺少／載入失敗保留 fallback。

公開 metadata 快取存在記憶體與 localStorage，以 FRONTEND_BUILD 分版本；包括空清單與各系列清單。重複切換優先命中，不重打 API。重新整理按鈕清空前端並要求後端換快取 revision；老師既有設定刷新也使後端家具快取失效。後端快取600秒，過大回應不塞入 CacheService。切頁清除 DOM、observer、fallback 監聽；epoch 防止晚回應重建離開的畫面。重新整理前的請求不能覆寫新版快取。

現用 `getPostLoginBundleV5101` 在讀 core 時明確略過家具；`getStudentCoreStateV55_` 預設及舊 API 仍保留家具回傳相容性。家具瀏覽不購買，也不自動寫入擁有資料。

## Setup、發布與回復

1. 先在正式試算表副本驗證，保存目前前後端程式與資料備份。
2. 更新 `apps-script/Code.gs`，沿用已啟用的 Sheets API 與 Script Properties。
3. 執行 `setupOrUpgradeV610Phase3()`，只需一次，可安全重跑。內部先呼叫既有安全 V600 setup，再補家具系列／家具欄位／保留既有類型的驗證／12顆石頭共用圖片／設定快取。Phase 1、2 已部署者不需重跑其setup。
4. 重新部署既有 Apps Script 網頁版本，保留 API URL。
5. 發布 `app.js、index.html、style.css、assets/items/stones/attribute-stones.png`。SVG、工具、測試及此文件隨 Git 保留，非執行期依賴。確認快取版本更新。
6. 正式測試12種石頭、老師所選道具圖、家具系列資料與可視圖片，以及原圖預覽。

回復上一版 Phase 2：前端與 Code.gs 使用 `5e08c48` 的版本，重新發布前端與 Apps Script。舊背包 renderer 不支援石頭 sprite，因此只將12顆石頭設定的「圖片」回復升級前的設定備份；不改其 ID、效果值或學生庫存。保留新增工作表、家具欄位與全部學生資料，不還原舊學生資料快照、不清除任何交易／強化紀錄。不回退到缺少既有交易保護的版本；有未確認交易時先查核實際結果。

## 檔案與驗證

修改 app.js、index.html、style.css、Code.gs；新增共用 PNG／SVG、素材重建工具、`v610-catalogs.test.cjs`、`v610-catalogs-ui.test.cjs` 及本文件。Phase 2 的測試只放寬「renderStoneModeV600 完全不變」斷言，因該函式本階段需換圖；交易、傷害與對戰函式仍逐一比對。

執行 app.js、Code.gs、所有測試及工具語法檢查、全部 V6.0 與 V6.1 Phase 1／2 回歸，以及新增後端與 Chrome 桌面／平板／手機測試。後端使用記憶體 Sheets；瀏覽器使用本機HTTP靜態資源與模擬API，以驗證真實HTTP快取只下載一次。沒有連線操作正式 Sheets 或部署。
