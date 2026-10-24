# 環境設定與部署

## 全新重建

1. 將此包提交到自己的 GitHub 儲存庫。
2. 在 Vercel 匯入該儲存庫，選 Other；Build Command `npm run build`，Output Directory `public`，Node.js 24.x。保留專案內 `vercel.json`。
3. 為 Production、Preview、Development 分別建立或連接私人 Blob 儲存庫，將對應 token 僅提供給該環境。避免預覽分支取得正式資料存取權。
4. `npm ci` 後，分別執行 `npm run setup -- --environment=production` 及 `npm run setup -- --environment=preview`；本機設定依 README 執行。
5. 在 Vercel 的 Environment Variables 輸入新產生的 `SESSION_SECRET`、`ADMIN_PASSWORD_HASH`，以及對應 Blob token。這些值不應出現在 GitHub、公開前端或建置輸出。
6. Production 設定 `CONTENT_PREFIX=production`；Preview 留空，讓程式自動為分支／部署選擇前綴。Development 使用 `development`。
7. Production 的 `SITE_ORIGIN` 填寫自己的 HTTPS origin，例如 `https://your-domain.example`，不含路徑或 `#`。Preview 如需正確分享頁，可在該環境設定自己的 origin。
8. 部署完成後登入 `/admin`，設定網站名稱並加入內容。第一次公開讀取會初始化空 CMS。

## 環境變數

| 變數 | 必要性 | 說明 |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | 必要 | 對應環境的私人 Blob 憑證；只在伺服器 |
| `SESSION_SECRET` | 必要 | 新產生的隨機 Session 簽章值，至少32字元 |
| `ADMIN_PASSWORD_HASH` | 必要 | `scrypt:salt:hash` 格式；用設定腳本產生 |
| `CONTENT_PREFIX` | 本機必要、部署可選 | 明確分區；Preview 留空可自動區分分支 |
| `SITE_ORIGIN` | 分享頁／sitemap 必設 | 自己網站的絕對網址；未設時為 `https://example.com` 範本值 |

本機 `.env.local` 由 Node 的 `--env-file` 讀取，不會自動載入其他 Next.js 環境檔案。`.env.example` 所有憑證均為空白。

`setup-admin.mjs` 會在 `.local/` 產生該環境的登入 JSON 及 `.env` 設定；development 另填入 `.env.local`。production／preview 不會覆蓋本機開發設定；三次產生的密碼與簽章值各自獨立。腳本不會呼叫遠端 CLI。

## 已有專案的程式備份還原

這份副本沒有原專案綁定或任何正式設定。若要更新既有 Vercel 專案，先手動連接正確的帳號／專案，確認 Blob、前綴、環境變數及網域；不要重新初始化遠端內容或重設密碼。

目前 Blob 已有的 CMS 不會被 seed 覆蓋；但本副本的靜態個人介紹、社群入口與預設 fallback 已匿名化，請依需要重新設定。原本網頁圖仍需保留在原私人儲存庫。

## 本機與測試

```sh
npm ci
cp .env.example .env.local
npm run setup
# 在 .env.local 填入自己的 Development Blob token。
npm run dev
```

測試及建置不需要 Blob 憑證，也不連接正式環境：

```sh
npm test
npm run build
```

## 發布後檢查

確認首頁、空狀態／公開作品、管理登入、一次草稿保存及分享網址；檢查 `SITE_ORIGIN` 與 `/sitemap.xml`。只在開發或專用測試內容上測試刪除。新增或修改環境變數後需重新部署，單純後台內容更新不需重新部署。

`public/robots.txt` 已排除管理頁，但沒有寫死 sitemap 網域；可在正式網域確認後，加入自己的絕對 sitemap URL。
