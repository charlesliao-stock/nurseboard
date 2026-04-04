/**
 * gdrive.js
 * Google Drive API 整合
 *
 * 設定步驟（GitHub Pages 部署前）：
 * 1. 前往 https://console.cloud.google.com
 * 2. 建立專案 → 啟用 Google Drive API
 * 3. 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式）
 * 4. 授權的 JavaScript 來源：填入你的 GitHub Pages 網址
 * 5. 將 CLIENT_ID 填入下方
 */

const GDrive = (() => {

  // ── ⚙️  請填入你的 Google OAuth Client ID ──────
  const CLIENT_ID = '807521931394-s3cf0nogol04fpdc4634thug2o0qa6bl.apps.googleusercontent.com';
  const SCOPES    = 'https://www.googleapis.com/auth/drive.file';
  // ────────────────────────────────────────────────

  // 上傳目標：Drive 根目錄下的「優良護理師表揚」資料夾
  const ROOT_FOLDER_NAME = '優良護理師表揚';

  let _tokenClient  = null;
  let _accessToken  = null;
  let _initialized  = false;
  let _folderCache  = {};   // { folderName: folderId }

  // ── Load GIS script dynamically ───────────────
  function init() {
    return new Promise((resolve, reject) => {
      if (_initialized) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        _tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp.error) return;
            _accessToken = resp.access_token;
          }
        });
        _initialized = true;
        resolve();
      };
      script.onerror = () => reject(new Error('無法載入 Google 授權元件'));
      document.head.appendChild(script);
    });
  }

  // ── Request token (shows Google consent popup) ─
  function authorize() {
    return new Promise((resolve, reject) => {
      if (_accessToken) { resolve(_accessToken); return; }
      if (!_initialized) { reject(new Error('尚未初始化')); return; }
      const original = _tokenClient.callback;
      _tokenClient.callback = (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        _accessToken = resp.access_token;
        _tokenClient.callback = original;
        resolve(_accessToken);
      };
      _tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  // ── Ensure root folder exists ─────────────────
  async function _ensureFolder(folderName, parentId = null) {
    const key = (parentId || 'root') + '/' + folderName;
    if (_folderCache[key]) return _folderCache[key];

    // Search for existing folder
    let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    if (parentId) q += ` and '${parentId}' in parents`;
    else q += ` and 'root' in parents`;

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${_accessToken}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      const id = searchData.files[0].id;
      _folderCache[key] = id;
      return id;
    }

    // Create folder
    const meta = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : ['root']
    };
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meta)
    });
    const created = await createRes.json();
    _folderCache[key] = created.id;
    return created.id;
  }

  // ── Upload blob to Drive ───────────────────────
  // unitName: 用於建立子資料夾（e.g. "內科加護病房"）
  async function upload(blob, filename, unitName, onProgress) {
    try {
      await init();
      await authorize();

      if (onProgress) onProgress('正在確認雲端資料夾…');

      // Root folder: 優良護理師表揚/
      const rootId = await _ensureFolder(ROOT_FOLDER_NAME);

      // Sub-folder by unit name
      let targetId = rootId;
      if (unitName && unitName.trim()) {
        targetId = await _ensureFolder(unitName.trim(), rootId);
      }

      if (onProgress) onProgress('正在上傳檔案…');

      // Multipart upload
      const metadata = {
        name: filename,
        parents: [targetId]
      };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob, filename);

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${_accessToken}` },
          body: form
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || '上傳失敗');
      }

      const file = await res.json();
      return { success: true, id: file.id, name: file.name, link: file.webViewLink };

    } catch (err) {
      console.error('[GDrive] upload error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── Sign out ───────────────────────────────────
  function signOut() {
    if (_accessToken) {
      google.accounts.oauth2.revoke(_accessToken, () => {});
    }
    _accessToken = null;
    _folderCache = {};
  }

  function isAuthorized() { return !!_accessToken; }

  return { init, authorize, upload, signOut, isAuthorized };
})();
