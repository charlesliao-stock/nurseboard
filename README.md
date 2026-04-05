# 優良護理師表揚模板產生器

一套純 HTML + JavaScript 的網頁應用，供醫療機構快速製作優良護理師表揚圖卡，支援 Google Drive 雲端上傳。

---

## 檔案結構

```
/
├── index.html          # 使用者介面（一般護理師，無需登入）
├── admin.html          # 管理員後台（需登入）
├── css/
│   └── style.css       # 共用樣式
├── js/
│   ├── templates.js    # 模板定義與 localStorage 管理
│   ├── canvas.js       # Canvas 合成引擎（1280×720）
│   ├── gdrive.js       # Google Drive API 整合
│   ├── app.js          # 使用者介面主邏輯
│   └── admin.js        # 後台管理邏輯
└── assets/
    └── thumbs/         # 模板縮圖（選用）
```

---

## 部署到 GitHub Pages

1. 建立 GitHub repository（例如：`nurse-award-system`）
2. 將所有檔案推送到 `main` 分支
3. 進入 repository Settings → Pages → Source 選 `main` branch
4. 幾分鐘後可透過 `https://你的帳號.github.io/nurse-award-system/` 存取

---

## 設定 Google Drive 上傳

### 步驟一：建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 建立新專案（Project name 自訂，例如 `NurseAwardSystem`）
3. 左側選單 → API & Services → Library
4. 搜尋 **Google Drive API** → 啟用

### 步驟二：建立 OAuth 2.0 憑證

1. API & Services → Credentials → Create Credentials → **OAuth client ID**
2. Application type 選 **Web application**
3. Name 自訂
4. **Authorized JavaScript origins** 填入：
   - `https://你的帳號.github.io`（正式環境）
   - `http://localhost:8080`（本地開發用）
5. 點 Create → 複製 **Client ID**

### 步驟三：填入 Client ID

開啟 `js/gdrive.js`，將第 16 行的 `YOUR_GOOGLE_CLIENT_ID_HERE` 替換為你的 Client ID：

```javascript
const CLIENT_ID = '123456789-abcdefg.apps.googleusercontent.com';
```

---

## 後台管理員帳號

預設帳密（請修改後再部署）：

| 帳號 | 密碼 |
|------|------|
| admin | admin |

修改位置：`js/admin.js` 第 12–14 行

```javascript
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'nurse2024'   // ← 改這裡
};
```

> **注意**：此為前端驗證，密碼以明文存在 JS 中。若需更高安全性，請搭配後端 API。

---

## 使用說明

### 一般護理師（index.html）

1. **選擇模板**：點選左上角的模板縮圖
2. **填寫內容**：輸入單位、姓名、職稱、優良事蹟、日期
3. **上傳相片**：拖曳或點擊上傳區域，支援裁切
4. **下載 / 上傳**：
   - 「下載 PNG」：存到本機（1280×720 高解析）
   - 「上傳 Google Drive」：需授權 Google 帳號，自動依單位名稱建立資料夾

### 管理員（admin.html）

1. 以帳號密碼登入
2. 左側選擇模板，或點「＋ 新增」建立新模板
3. 畫布上可**拖曳**文字框與相片框調整位置，**拖曳右下角圓點**調整大小
4. 右側屬性面板可設定字型、顏色、綁定欄位、相片形狀等
5. 點「儲存模板」後，變更儲存於 localStorage，使用者介面即時生效

---

## 技術規格

- 輸出尺寸：**1280 × 720 px**（16:9）
- 輸出格式：PNG（無損）
- 模板儲存：localStorage（JSON 格式）
- 雲端：Google Drive API v3，OAuth 2.0（PKCE）
- 字型：Google Fonts — Noto Serif TC + Noto Sans TC
- 依賴套件：**零** — 純原生 HTML / CSS / JS

---

## 授權

MIT License — 自由使用、修改、分發。
