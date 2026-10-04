# V5.7 怪物設定系統

已新增「怪物設定」工作表，之後新增怪物不需要再改程式。

## 怪物圖片放哪裡
GitHub 建議建立：

assets/monsters/

檔名例如：
- MON001.png
- MON002.png
- MON003.png

試算表「怪物設定」圖片欄填：
- assets/monsters/MON001.png

## 怪物設定欄位
- 怪物ID
- 名稱
- 圖片
- 基礎HP
- HP成長
- 出現科目
- 是否開放

範例：
MON001 | 訓練史萊姆 | assets/monsters/MON001.png | 100 | 25 | 全部 | TRUE

### 出現科目
已做下拉選單：
- 全部
- 國語
- 數學
- 英文
- 自然
- 社會

### 是否開放
已改成勾選框。

## 對戰規則
- 開始對戰時，依科目挑可出現的怪物。
- 多隻符合時會依序輪替。
- 怪物HP = 基礎HP + (怪物序號-1) × HP成長
- 圖片空白時仍會顯示 👾，方便還沒準備素材時使用。

## 更新方式

GitHub 覆蓋：
- index.html
- style.css
- app.js

Apps Script 覆蓋：
- apps-script/Code.gs

然後：
1. Apps Script 儲存
2. 手動執行一次 `setupOrUpgradeV57()`
3. 重新部署 Apps Script 新版本
4. GitHub Commit / Push

前端版本：20261004-2010
