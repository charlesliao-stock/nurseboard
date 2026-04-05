/**
 * admin.js
 * 後台管理邏輯：登入驗證、模板編輯器（拖曳式）
 * v1.1 — 背景圖片永久儲存至 Google Drive，以公開 URL 嵌入模板
 */

(() => {
  const VERSION = '1.1.0';

  // ⚠️  正式部署前請更換為環境變數或後端驗證
  const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin' };
  const SESSION_KEY = 'nurse_admin_session';

  // ── State ──────────────────────────────────────
  const adminState = {
    templates: [],
    activeTemplateId: null,
    selectedElId: null,
    isDragging: false,
    isResizing: false,
    dragOffset: { x: 0, y: 0 },
    scale: 1
  };

  let _editorInst = null;

  const $ = id => document.getElementById(id);

  // ── Init ───────────────────────────────────────
  function init() {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      _showAdmin();
    }

    $('loginBtn').addEventListener('click', _tryLogin);
    $('adminPass').addEventListener('keydown', e => {
      if (e.key === 'Enter') _tryLogin();
    });
    $('logoutBtn').addEventListener('click', _logout);
    $('btnNewTemplate').addEventListener('click', _newTemplate);
    $('btnSaveTemplate').addEventListener('click', _saveTemplate);
    $('btnDeleteTemplate').addEventListener('click', _deleteTemplate);
    $('btnAddText').addEventListener('click', () => _addElement('text'));
    $('btnAddPhoto').addEventListener('click', () => _addElement('photo'));
    $('propDeleteEl').addEventListener('click', _deleteSelectedEl);
    $('photoDeleteEl').addEventListener('click', _deleteSelectedEl);
    $('btnAddField').addEventListener('click', _openAddFieldModal);

    ['propX','propY','propW','propH','propFontSize','propFontWeight',
     'propColor','propBindField','propCustomText','propAlign',
     'photoX','photoY','photoW','photoH','photoShape'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('input', _updateElFromProps);
    });

    document.querySelectorAll('.align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _updateElFromProps();
      });
    });

    $('bgColor').addEventListener('input', _updateBgColor);

    // ── Background image upload (Drive-backed) ──
    $('bgImageInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) _uploadBgImageToDrive(file);
    });

    window.addEventListener('resize', _fitEditorCanvas);
  }

  // ── Auth ───────────────────────────────────────
  function _tryLogin() {
    const u = $('adminUser').value.trim();
    const p = $('adminPass').value;
    if (u === ADMIN_CREDENTIALS.username && p === ADMIN_CREDENTIALS.password) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      _showAdmin();
    } else {
      $('loginError').hidden = false;
      $('adminPass').value = '';
    }
  }
  function _logout() {
    sessionStorage.removeItem(SESSION_KEY);
    $('adminLayout').hidden = true;
    $('loginScreen').hidden = false;
  }
  function _showAdmin() {
    $('loginScreen').hidden = true;
    $('adminLayout').hidden = false;
    adminState.templates = TemplateManager.load();
    _renderTemplateList();
    _renderFieldList();
    if (adminState.templates.length > 0) {
      _loadTemplate(adminState.templates[0].id);
    }
  }

  // ── Template List ─────────────────────────────
  function _renderTemplateList() {
    const list = $('adminTemplateList');
    list.innerHTML = '';
    const enabledMap = TemplateManager.getEnabledMap();
    adminState.templates.forEach(tpl => {
      const enabled = enabledMap[tpl.id] !== false;
      const li = document.createElement('li');
      li.dataset.id = tpl.id;
      if (!enabled) li.classList.add('disabled');
      li.innerHTML = `<span class="tl-dot"></span><span class="tl-name">${tpl.name}</span>`;

      const tog = document.createElement('button');
      tog.className = 'tl-toggle' + (enabled ? ' on' : '');
      tog.title = enabled ? '停用' : '啟用';
      tog.addEventListener('click', e => {
        e.stopPropagation();
        const nowEnabled = tog.classList.toggle('on');
        li.classList.toggle('disabled', !nowEnabled);
        tog.title = nowEnabled ? '停用' : '啟用';
        TemplateManager.setEnabled(tpl.id, nowEnabled);
      });
      li.appendChild(tog);

      if (tpl.id === adminState.activeTemplateId) li.classList.add('active');
      li.addEventListener('click', () => _loadTemplate(tpl.id));
      list.appendChild(li);
    });
  }

  async function _loadTemplate(id) {
    adminState.activeTemplateId = id;
    const tpl = adminState.templates.find(t => t.id === id);
    if (!tpl) return;

    $('templateName').value  = tpl.name  || '';
    $('templateStyle').value = tpl.style || 'formal';
    $('bgColor').value = tpl.background || '#EBF4F8';

    // Show current bg image filename if set
    _updateBgImageStatus(tpl);

    document.querySelectorAll('#adminTemplateList li').forEach(li => {
      li.classList.toggle('active', li.dataset.id === id);
    });

    $('editorEmpty').style.display = 'none';
    adminState.selectedElId = null;
    _hideAllProps();

    // Create canvas instance first (sync)
    _editorInst = createCanvasInstance($('editorCanvas'));

    // If template has a Drive background URL, load it before rendering
    if (tpl.bgImageUrl) {
      _setBgStatusLoading('載入背景圖片…');
      await _editorInst.loadBgFromUrl(tpl.bgImageUrl);
      _setBgStatusLoading('');
    }

    _editorInst.render(tpl, _placeholderData());
    _renderOverlays(tpl);
    setTimeout(_fitEditorCanvas, 50);
  }

  // ── Show bg image status below file input ─────
  function _updateBgImageStatus(tpl) {
    let statusEl = $('bgImageStatus');
    if (!statusEl) {
      statusEl = document.createElement('p');
      statusEl.id = 'bgImageStatus';
      statusEl.style.cssText = 'font-size:11px;color:var(--teal-500);margin-top:5px;min-height:16px;';
      $('bgImageInput').insertAdjacentElement('afterend', statusEl);
    }
    if (tpl && tpl.bgImageUrl) {
      const name = tpl.bgImageName || '已套用背景圖片';
      statusEl.textContent = '✓ ' + name;
      statusEl.style.color = 'var(--success)';

      // Show remove button
      let removeBtn = $('bgImageRemove');
      if (!removeBtn) {
        removeBtn = document.createElement('button');
        removeBtn.id = 'bgImageRemove';
        removeBtn.className = 'btn btn--danger btn--sm';
        removeBtn.style.cssText = 'margin-top:6px;width:100%';
        removeBtn.textContent = '✕ 移除背景圖片';
        removeBtn.addEventListener('click', _removeBgImage);
        statusEl.insertAdjacentElement('afterend', removeBtn);
      }
      removeBtn.hidden = false;
    } else {
      statusEl.textContent = '';
      const removeBtn = $('bgImageRemove');
      if (removeBtn) removeBtn.hidden = true;
    }
  }

  function _setBgStatusLoading(msg) {
    let statusEl = $('bgImageStatus');
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = 'var(--ink-soft)';
  }

  // ── Upload background image to Drive ──────────
  async function _uploadBgImageToDrive(file) {
    const tpl = _getActiveTpl();
    if (!tpl) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      _showToast('請選擇圖片檔案');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      _showToast('圖片檔案請勿超過 5MB');
      return;
    }

    _setBgStatusLoading('正在上傳背景圖片…');
    _showToast('正在上傳背景圖片…');

    const filename = `bg_${tpl.id}_${Date.now()}.${file.name.split('.').pop()}`;

    const result = await GDrive.uploadBgImage(file, filename, (msg) => {
      _setBgStatusLoading(msg);
    });

    if (!result.success) {
      _setBgStatusLoading('');
      _showToast('上傳失敗：' + result.error);
      return;
    }

    // Store Drive public URL and filename in template
    tpl.bgImageUrl  = result.publicUrl;
    tpl.bgImageName = file.name;

    // Load image into editor canvas
    await _editorInst.loadBgFromUrl(tpl.bgImageUrl);

    // Re-render and update UI
    _editorInst.render(tpl, _placeholderData());
    _renderOverlays(tpl);
    _updateBgImageStatus(tpl);

    // Auto-save template so URL is persisted immediately
    TemplateManager.save(adminState.templates);
    _renderTemplateList();

    _showToast('✓ 背景圖片已上傳並套用');

    // Clear the file input so same file can be re-selected if needed
    $('bgImageInput').value = '';
  }

  // ── Remove background image ───────────────────
  function _removeBgImage() {
    const tpl = _getActiveTpl();
    if (!tpl) return;
    delete tpl.bgImageUrl;
    delete tpl.bgImageName;
    if (_editorInst) _editorInst.setBgImage(null);
    _reRenderCanvas();
    _updateBgImageStatus(tpl);
    TemplateManager.save(adminState.templates);
    _showToast('已移除背景圖片');
  }

  // ── Editor Canvas ─────────────────────────────
  function _fitEditorCanvas() {
    const wrap   = $('editorCanvasWrap');
    const canvas = $('editorCanvas');
    if (!canvas.width) return;
    const availW = wrap.clientWidth  - 48;
    const availH = wrap.clientHeight - 48;
    const scale  = Math.min(availW / 1280, availH / 720);
    adminState.scale = scale;
    canvas.style.width  = Math.floor(1280 * scale) + 'px';
    canvas.style.height = Math.floor(720 * scale) + 'px';
    _positionOverlays();
  }

  function _placeholderData() {
    const data = {};
    FieldManager.load().forEach(f => { data[f.id] = f.label; });
    return data;
  }

  // ── Drag Overlays ─────────────────────────────
  function _renderOverlays(tpl) {
    const container = $('editorOverlays');
    container.innerHTML = '';
    const canvas  = $('editorCanvas');
    const canvasR = canvas.getBoundingClientRect();
    const wrapR   = $('editorCanvasWrap').getBoundingClientRect();

    const offsetX = canvasR.left - wrapR.left;
    const offsetY = canvasR.top  - wrapR.top;
    const scale   = adminState.scale;

    container.style.position = 'absolute';
    container.style.left    = offsetX + 'px';
    container.style.top     = offsetY + 'px';
    container.style.width   = canvas.offsetWidth  + 'px';
    container.style.height  = canvas.offsetHeight + 'px';
    container.style.pointerEvents = 'all';

    (tpl.elements || []).forEach(el => {
      const div = _createOverlayEl(el, scale);
      container.appendChild(div);
    });

    if (tpl.photoFrame) {
      const div = _createOverlayEl(tpl.photoFrame, scale);
      div.dataset.eltype = 'photo';
      container.appendChild(div);
    }
  }

  function _positionOverlays() {
    const tpl = _getActiveTpl();
    if (tpl) _renderOverlays(tpl);
  }

  function _createOverlayEl(el, scale) {
    const div = document.createElement('div');
    div.className = 'editor-overlay-el';
    div.dataset.elid = el.id;
    div.dataset.eltype = el.type || 'text';

    _positionDiv(div, el, scale);

    const label = document.createElement('span');
    label.style.cssText = 'pointer-events:none;font-size:10px;color:#1a5c6b;padding:2px;opacity:.7';
    if (el.type === 'text' || !el.type) {
      label.textContent = el.bindField === 'custom' ? '自訂' : (el.bindField || '文字');
    } else {
      label.textContent = '相片';
    }
    div.appendChild(label);

    const handle = document.createElement('div');
    handle.className = 'el-handle';
    div.appendChild(handle);

    div.addEventListener('mousedown', e => _onElMousedown(e, div, el));
    handle.addEventListener('mousedown', e => {
      e.stopPropagation();
      _onResizeMousedown(e, div, el);
    });

    div.addEventListener('click', e => {
      e.stopPropagation();
      _selectEl(el.id);
    });

    return div;
  }

  function _positionDiv(div, el, scale) {
    div.style.left   = Math.round(el.x * scale) + 'px';
    div.style.top    = Math.round(el.y * scale) + 'px';
    div.style.width  = Math.round((el.width || el.fw || 100) * scale) + 'px';
    div.style.height = Math.round((el.height || el.fh || 60) * scale) + 'px';
  }

  // ── Drag ──────────────────────────────────────
  function _onElMousedown(e, div, el) {
    if (e.button !== 0) return;
    e.preventDefault();
    adminState.isDragging = true;
    adminState.dragOffset = {
      x: e.clientX - div.getBoundingClientRect().left,
      y: e.clientY - div.getBoundingClientRect().top
    };

    const containerR = $('editorOverlays').getBoundingClientRect();
    const scale = adminState.scale;

    function onMove(ev) {
      if (!adminState.isDragging) return;
      const nx = (ev.clientX - containerR.left - adminState.dragOffset.x) / scale;
      const ny = (ev.clientY - containerR.top  - adminState.dragOffset.y) / scale;
      el.x = Math.round(Math.max(0, nx));
      el.y = Math.round(Math.max(0, ny));
      _positionDiv(div, el, scale);
      _updatePropsPanel(el);
      _reRenderCanvas();
    }
    function onUp() {
      adminState.isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function _onResizeMousedown(e, div, el) {
    if (e.button !== 0) return;
    e.preventDefault();
    adminState.isResizing = true;
    const startX = e.clientX, startY = e.clientY;
    const startW = el.width || el.fw || 100;
    const startH = el.height || el.fh || 60;
    const scale  = adminState.scale;

    function onMove(ev) {
      if (!adminState.isResizing) return;
      const dw = (ev.clientX - startX) / scale;
      const dh = (ev.clientY - startY) / scale;
      if (el.type === 'text' || !el.type) {
        el.width  = Math.max(40, Math.round(startW + dw));
        el.height = Math.max(20, Math.round(startH + dh));
      } else {
        el.width  = Math.max(40, Math.round(startW + dw));
        el.height = Math.max(40, Math.round(startH + dh));
      }
      _positionDiv(div, el, scale);
      _updatePropsPanel(el);
      _reRenderCanvas();
    }
    function onUp() {
      adminState.isResizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Select Element ────────────────────────────
  function _selectEl(elId) {
    adminState.selectedElId = elId;
    document.querySelectorAll('.editor-overlay-el').forEach(d => {
      d.classList.toggle('selected', d.dataset.elid === elId);
    });

    const tpl = _getActiveTpl();
    if (!tpl) return;

    let el = (tpl.elements || []).find(e => e.id === elId);
    const isPhoto = !el && tpl.photoFrame && tpl.photoFrame.id === elId;
    if (isPhoto) el = tpl.photoFrame;

    _updatePropsPanel(el, isPhoto);
  }

  function _hideAllProps() {
    $('propsEmpty').hidden  = false;
    $('propsText').hidden   = true;
    $('propsPhoto').hidden  = true;
  }

  function _updatePropsPanel(el, isPhoto = false) {
    if (!el) { _hideAllProps(); return; }

    if (isPhoto || el.shape) {
      $('propsEmpty').hidden  = true;
      $('propsText').hidden   = true;
      $('propsPhoto').hidden  = false;
      $('photoX').value = el.x;
      $('photoY').value = el.y;
      $('photoW').value = el.width;
      $('photoH').value = el.height;
      $('photoShape').value = el.shape || 'circle';
    } else {
      $('propsEmpty').hidden  = true;
      $('propsText').hidden   = false;
      $('propsPhoto').hidden  = true;

      const sel = $('propBindField');
      sel.innerHTML = '';
      FieldManager.load().forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id; opt.textContent = f.label;
        sel.appendChild(opt);
      });
      const customOpt = document.createElement('option');
      customOpt.value = 'custom'; customOpt.textContent = '自訂文字';
      sel.appendChild(customOpt);

      sel.value = el.bindField || 'unit';
      $('propCustomText').value = el.customText || '';
      $('propX').value          = el.x;
      $('propY').value          = el.y;
      $('propW').value          = el.width;
      $('propH').value          = el.height;
      $('propFontSize').value   = el.fontSize || 16;
      $('propFontWeight').value = el.fontWeight || '400';
      $('propColor').value      = _hexColor(el.color || '#1a2126');

      document.querySelectorAll('.align-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.align === (el.align || 'left'));
      });
    }
  }

  function _hexColor(c) {
    if (c && c.startsWith('#') && (c.length === 4 || c.length === 7)) return c;
    return '#1a2126';
  }

  function _updateElFromProps() {
    const elId = adminState.selectedElId;
    if (!elId) return;
    const tpl = _getActiveTpl();
    if (!tpl) return;

    let el = (tpl.elements || []).find(e => e.id === elId);
    const isPhoto = !el && tpl.photoFrame && tpl.photoFrame.id === elId;
    if (isPhoto) el = tpl.photoFrame;
    if (!el) return;

    if (isPhoto || el.shape) {
      el.x      = parseInt($('photoX').value) || 0;
      el.y      = parseInt($('photoY').value) || 0;
      el.width  = parseInt($('photoW').value) || 100;
      el.height = parseInt($('photoH').value) || 100;
      el.shape  = $('photoShape').value;
    } else {
      el.bindField   = $('propBindField').value;
      el.customText  = $('propCustomText').value;
      el.x           = parseInt($('propX').value) || 0;
      el.y           = parseInt($('propY').value) || 0;
      el.width       = parseInt($('propW').value) || 100;
      el.height      = parseInt($('propH').value) || 60;
      el.fontSize    = parseInt($('propFontSize').value) || 16;
      el.fontWeight  = $('propFontWeight').value;
      el.color       = $('propColor').value;
      const activeAlign = document.querySelector('.align-btn.active');
      if (activeAlign) el.align = activeAlign.dataset.align;
    }

    _renderOverlays(tpl);
    _selectEl(elId);
    _reRenderCanvas();
  }

  function _updateBgColor() {
    const tpl = _getActiveTpl();
    if (!tpl) return;
    tpl.background = $('bgColor').value;
    _reRenderCanvas();
  }

  // ── Add/Delete Elements ───────────────────────
  function _addElement(type) {
    const tpl = _getActiveTpl();
    if (!tpl) return;
    const id = 'el_' + Date.now();
    if (type === 'text') {
      tpl.elements = tpl.elements || [];
      tpl.elements.push({
        id, type: 'text', bindField: 'unit',
        x: 80, y: 80, width: 300, height: 40,
        fontSize: 18, fontWeight: '400',
        color: '#1a2126', align: 'left'
      });
    } else {
      tpl.photoFrame = {
        id, type: 'photo',
        x: 860, y: 80, width: 280, height: 280,
        shape: 'circle', borderColor: '#2a8fa6', borderWidth: 3, shadow: true
      };
    }
    _renderOverlays(tpl);
    _reRenderCanvas();
    _selectEl(id);
  }

  function _deleteSelectedEl() {
    const elId = adminState.selectedElId;
    if (!elId) return;
    const tpl = _getActiveTpl();
    if (!tpl) return;

    if (tpl.photoFrame && tpl.photoFrame.id === elId) {
      tpl.photoFrame = null;
    } else {
      tpl.elements = (tpl.elements || []).filter(e => e.id !== elId);
    }
    adminState.selectedElId = null;
    _hideAllProps();
    _renderOverlays(tpl);
    _reRenderCanvas();
  }

  // ── Save/New/Delete Template ──────────────────
  function _saveTemplate() {
    const tpl = _getActiveTpl();
    if (!tpl) return;
    tpl.name  = $('templateName').value  || tpl.name;
    tpl.style = $('templateStyle').value || tpl.style;
    TemplateManager.save(adminState.templates);
    _renderTemplateList();
    _showToast('✓ 模板已儲存');
  }

  function _newTemplate() {
    const id = 'tpl_' + Date.now();
    const newTpl = {
      id, name: '新模板', style: 'formal',
      background: '#EBF4F8', bgPattern: 'none',
      elements: [
        {
          id: 'el_name_' + Date.now(), type: 'text', bindField: 'name',
          x: 80, y: 200, width: 560, height: 88,
          fontSize: 64, fontWeight: '700', color: '#0d2d35', align: 'left', serif: true
        }
      ],
      photoFrame: {
        id: 'photo_' + Date.now(),
        x: 860, y: 80, width: 320, height: 320,
        shape: 'circle', borderColor: '#2a8fa6', borderWidth: 4, shadow: true
      },
      decorations: []
    };
    adminState.templates.push(newTpl);
    adminState.activeTemplateId = id;
    TemplateManager.save(adminState.templates);
    _renderTemplateList();
    _loadTemplate(id);
    _showToast('✓ 已新增模板');
  }

  function _deleteTemplate() {
    const id = adminState.activeTemplateId;
    if (!id) return;
    if (!confirm('確定要刪除此模板？')) return;
    adminState.templates = adminState.templates.filter(t => t.id !== id);
    TemplateManager.save(adminState.templates);
    adminState.activeTemplateId = null;
    _renderTemplateList();
    $('editorEmpty').style.display = '';
    _editorInst = null;
    $('editorOverlays').innerHTML = '';
    _hideAllProps();
    _showToast('已刪除模板');
  }

  // ── Helpers ───────────────────────────────────
  function _getActiveTpl() {
    return adminState.templates.find(t => t.id === adminState.activeTemplateId) || null;
  }

  function _reRenderCanvas() {
    const tpl = _getActiveTpl();
    if (!tpl) return;
    if (!_editorInst) _editorInst = createCanvasInstance($('editorCanvas'));
    _editorInst.render(tpl, _placeholderData());
  }

  // ── Field Manager ─────────────────────────────
  function _renderFieldList() {
    const list = $('fieldList');
    if (!list) return;
    list.innerHTML = '';
    const enabledMap = FieldManager.getEnabledMap();

    FieldManager.load().forEach(f => {
      const isBuiltIn = FieldManager.isBuiltIn(f.id);
      const enabled   = enabledMap[f.id] !== false;

      const li = document.createElement('li');
      if (!enabled) li.classList.add('disabled');

      const labelEl = document.createElement('span');
      labelEl.className = 'fl-label';
      labelEl.textContent = f.label;
      li.appendChild(labelEl);

      const typeEl = document.createElement('span');
      typeEl.className = 'fl-type';
      typeEl.textContent = f.type === 'textarea' ? '長文字' : f.type === 'date' ? '日期' : '文字';
      li.appendChild(typeEl);

      if (isBuiltIn) {
        const badge = document.createElement('span');
        badge.className = 'fl-builtin';
        badge.textContent = '內建';
        li.appendChild(badge);
      }

      const tog = document.createElement('button');
      tog.className = 'tl-toggle' + (enabled ? ' on' : '');
      tog.title = enabled ? '停用' : '啟用';
      tog.addEventListener('click', () => {
        const nowEnabled = tog.classList.toggle('on');
        li.classList.toggle('disabled', !nowEnabled);
        tog.title = nowEnabled ? '停用' : '啟用';
        FieldManager.setFieldEnabled(f.id, nowEnabled);
        _showToast(`欄位「${f.label}」已${nowEnabled ? '啟用' : '停用'}`);
      });
      li.appendChild(tog);

      if (!isBuiltIn) {
        const delBtn = document.createElement('button');
        delBtn.className = 'fl-del';
        delBtn.title = '刪除';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', () => {
          if (!confirm(`確定刪除欄位「${f.label}」？\n各模板中綁定此欄位的文字框也會一併移除。`)) return;
          _removeFieldFromTemplates(f.id);
          FieldManager.removeField(f.id);
          _renderFieldList();
          const tpl = _getActiveTpl();
          if (tpl) { _reRenderCanvas(); _renderOverlays(tpl); }
          _showToast(`已刪除欄位「${f.label}」`);
        });
        li.appendChild(delBtn);
      }

      list.appendChild(li);
    });
  }

  function _removeFieldFromTemplates(fieldId) {
    const templates = TemplateManager.load();
    templates.forEach(tpl => {
      if (Array.isArray(tpl.elements)) {
        tpl.elements = tpl.elements.filter(el => el.bindField !== fieldId);
      }
    });
    TemplateManager.save(templates);
    adminState.templates = templates;
    _renderTemplateList();
  }

  function _openAddFieldModal() {
    let modal = $('addFieldModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'addFieldModal';
      modal.className = 'add-field-modal';
      modal.innerHTML = `
        <div class="add-field-box">
          <h3>新增欄位</h3>
          <div class="field-group">
            <label class="field-label">欄位名稱</label>
            <input type="text" id="newFieldLabel" class="field-input" placeholder="例：員工編號" maxlength="20">
          </div>
          <div class="field-group">
            <label class="field-label">輸入類型</label>
            <select id="newFieldType" class="field-input">
              <option value="text">單行文字</option>
              <option value="textarea">多行文字</option>
              <option value="date">日期</option>
            </select>
          </div>
          <div class="add-field-actions">
            <button class="btn btn--outline btn--sm" id="btnCancelField">取消</button>
            <button class="btn btn--primary btn--sm" id="btnConfirmField">新增</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      $('btnCancelField').addEventListener('click', () => { modal.hidden = true; });
      $('btnConfirmField').addEventListener('click', () => {
        const label = $('newFieldLabel').value.trim();
        if (!label) { $('newFieldLabel').focus(); return; }
        FieldManager.addField(label, $('newFieldType').value);
        modal.hidden = true;
        _renderFieldList();
        _showToast(`已新增欄位「${label}」`);
      });
    }
    $('newFieldLabel').value = '';
    $('newFieldType').value = 'text';
    modal.hidden = false;
    setTimeout(() => $('newFieldLabel').focus(), 50);
  }

  // ── Toast ─────────────────────────────────────
  let _toastTimer;
  function _showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ── Boot ──────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
