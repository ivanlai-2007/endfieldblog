# FIELD — 個人影像與計算機網站

以攝影作品為主，結合色彩實驗、少量博客、友鏈及個人介紹的網站。使用原生 HTML / CSS / JavaScript 與 Vercel Functions，內容保存在私人 Vercel Blob，單人管理後台位於 `/admin`。

這是 **6.3.3 的純架構備份**。保留前後台、樣式、互動、測試及部署設定；不包含任何正式照片、文章、友鏈、個人介紹、社群帳號、瀏覽紀錄、登入資料或既有 Vercel 專案綁定。執行時的初始內容為空，六組內建色彩預設屬於程式設定。

> 此包用來備份及重建網站程式，不是正式資料備份。直接替既有網站更新程式時，也請先確認個人介紹和社群入口：此副本的寫死內容已匿名化。

## 功能

- 攝影作品、分類與 EXIF：相機、鏡頭、焦距、光圈、快門、ISO。
- 大圖檢視、原尺寸、資訊覆蓋、手機橫滑、深色／中性灰觀看背景。
- 六組色彩預設與原圖對照。
- 作品 `/photos/:id`、文章 `/notes/:id` 獨立網址，含伺服器分享資訊及動態 sitemap。
- Markdown 博客、搜尋、友鏈、個人介紹、深淺主題與可略過的進入動畫。
- 後台上傳壓縮、多選整理、拖曳排序、草稿／發佈／封存、垃圾桶與永久刪除。
- 管理密碼、JSON 匯出／匯入、並行修訂保護；小型瀏覽次數統計。

## 快速開始

需要 Node.js **24.x**、npm，以及專供開發使用的 **私人 Vercel Blob** 儲存庫。完整動態網站不能只以靜態伺服器或 GitHub Pages 執行。

```sh
npm ci
cp .env.example .env.local
npm run setup
```

將 Development 私人 Blob 的 token 填入 `.env.local` 的 `BLOB_READ_WRITE_TOKEN`，再執行：

```sh
npm run dev
```

前台：`http://127.0.0.1:4175/`；後台：`http://127.0.0.1:4175/admin`。首次本機登入密碼保存在被 Git 忽略的 `.local/admin-development.json`，腳本不會把密碼輸出到終端。本機服務自動避免使用 `production` 內容前綴。

`npm run setup` 只產生本機設定，不連線 Vercel、不上傳內容、不重設遠端密碼；已有設定時會停止，避免覆蓋。

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm ci` | 依鎖定版本安裝依賴 |
| `npm run setup` | 產生開發環境的新登入設定 |
| `npm run setup -- --environment=production` | 產生獨立正式環境設定，僅存本機 `.local/` |
| `npm run setup -- --environment=preview` | 產生獨立預覽環境設定，僅存本機 `.local/` |
| `npm run dev` | 建置後啟動本機前後台 |
| `npm run build` | 產生 Markdown 清理器及瀏覽器 EXIF 模組 |
| `npm test` | 建置並執行無網路、無正式憑證的單元／整合測試 |

## 目錄

```text
api/router.js                Vercel Function 入口
client/exif-reader.js        上傳前 EXIF 讀取原始碼
data/seed.json               空的初始內容與內建色彩預設
public/                     前台、後台、樣式、自託管字體及 SVG
server/                     認證、內容、媒體、分享頁、統計與永久刪除
scripts/                    建置、本機服務及通用登入設定產生器
tests/                      合成資料測試，與執行用 seed 分離
docs/                       架構、部署、管理及備份說明
licenses/                   隨附第三方程式授權文件
.github/workflows/ci.yml     GitHub Actions 測試；不讀取部署憑證
.env.example                空白環境變數範本
vercel.json                 路由、建置及安全標頭
```

## 部署至 Vercel

先建立 GitHub 儲存庫，再由 Vercel 匯入；Framework Preset 選 **Other**，Build Command 為 `npm run build`，Output Directory 為 `public`，Node.js 為 24.x。連接新的私人 Blob，填入各環境的登入變數，並設定正式 `SITE_ORIGIN`。完整步驟見 [部署指南](docs/DEPLOYMENT.md)。

此包沒有 `.vercel/project.json`，不會自動連到任何既有帳號、專案或儲存庫。Production、Preview、Development 請使用獨立的儲存庫及認證值。

## 上傳 GitHub

解壓後，進入此專案目錄，建立一個空的 GitHub 儲存庫：

```sh
git init
git add .
git diff --cached --stat
git status --short
git commit -m "Backup FIELD website architecture"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

請先替換 `YOUR_ACCOUNT` 與 `YOUR_REPOSITORY`。使用 GitHub 網頁上傳時，也要保留 `.github/`、`.gitignore`、`.env.example` 等以點開頭的檔案。

## 文件

- [系統架構與資料流](docs/ARCHITECTURE.md)
- [環境設定與 Vercel 部署](docs/DEPLOYMENT.md)
- [照片、文章及個人頁管理](docs/CONTENT_MANAGEMENT.md)
- [此包範圍與資料還原](docs/BACKUP.md)
- [備份驗證紀錄](docs/VERIFICATION.md)
- [開發約定](CONTRIBUTING.md) · [安全說明](SECURITY.md)
- [第三方授權](THIRD_PARTY_NOTICES.md) · [專案授權狀態](LICENSE-NOTICE.md)
