# V5.9.2 簡化技能版

新表只需要：
`寵物代碼｜屬性｜專屬技能｜專屬技能傷害`

最高等級：30。

屬性技能固定解鎖：
Lv1、5、10、15、20、25。

一般技能固定解鎖：
Lv3、7、13、17、23、27。

Lv30：
從「寵物戰鬥設定」讀取專屬技能與傷害。

舊的「寵物技能設定」不刪除，但網站不再讀它。

更新：
- GitHub：app.js、index.html
- Apps Script：Code.gs
- 執行一次 setupOrUpgradeV592()
- 重新部署 Apps Script

測試：
https://bit111110.github.io/505-pet-house/?v=20261004-2320
