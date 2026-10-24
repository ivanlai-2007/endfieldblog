# 安全說明

這份程式提供單人管理後台。公開站與 `/api/content` 只提供公開內容；管理寫入有 Origin／Session 檢查，密碼採帶鹽 scrypt。

- Production、Preview、Development 使用不同 Blob token、Session secret及密碼。
- 維持私人 Blob；不要將草稿媒體、內容匯出、認證狀態或歷史版本改放公開靜態目錄。
- 變更資料格式時保留刪除標記、共用媒體與文章參照保護。
- HTTP快取可能短暫保留曾公開的媒體；下架不等同撤回第三方已取得的副本。
- 發現漏洞時，透過儲存庫管理者提供的私人管道或啟用後的 GitHub Private Vulnerability Reporting 回報。不要公開貼上憑證或正式內容。

此包沒有既有憑證，也沒有自動連接既有專案的設定。若後續誤提交真實憑證，應立即撤銷／輪替，刪除檔案本身不能消除 Git 歷史中的外洩。
