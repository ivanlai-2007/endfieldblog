# 開發約定

1. 使用 Node.js 24 與 `npm ci`，保留 package-lock.json 的鎖定版本。
2. 憑證只放本機 `.env.local`、`.local/` 或 Vercel 對應環境，不放前端／測試／文件。
3. 修改資料流時維持同來源與管理 Session 驗證、公開過濾、CAS並行保護及私人媒體規則。
4. 新增測試請使用合成資料，勿用正式照片、私人匯出檔或實際儲存庫憑證。
5. 先執行 `npm test`；畫面調整另檢查桌面／手機、深淺主題與減少動態效果。小型文案修改不必新增鏡像測試。
6. 修改 API、環境變數、資料格式或還原流程時同步更新 docs。

`public/exif-reader.js` 與 `server/sanitizer.cjs` 為建置產物，不直接編輯；請修改 client/exif-reader.js、public/photo-meta.js 或 server/sanitizer-entry.cjs，再執行建置。

GitHub CI僅執行安裝與測試，不讀取正式憑證、不自動發布。Pull request 的描述應說明變更行為、驗證方式與資料相容性。
