/**
 * admin.js
 * 後台管理邏輯：登入驗證、模板編輯器（拖曳式）
 */

(() => {
  // ── Config ─────────────────────────────────────
  const VERSION = '1.0.1'; // Force cache update
  // ⚠️  正式部署前請更換為環境變數或後端驗證
  const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin'
  };
  const SESSION_KEY = 'nurse_admin_session';

  // ── State ──────────────────────────────────────
  const adminState = {
    templates: [],
    activeTemplateId: null,
    selectedElId: null,
    isDragging: false,
    isResizing: false,
    dragOffset: { x: 0, y: 0 },
    // Editor canvas scale (DOM px per canvas px)
    scale: 1
  };

  // ── Editor canvas instance (獨立於使用者端 CanvasEngine) ──
  let _editorInst = null;

  // ── DOM refs ───────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Init ───────────────────────────────────────
  function init() {
    // Check session
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

    // Properties panel live update
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
    $('bgImageInput').addEventListener('change', e => {
      if (e.target.files[0]) _loadBgImage(e.target.files[0]);
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

      // Toggle button
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

  function _loadTemplate(id) {
    adminState.activeTemplateId = id;
    const tpl = adminState.templates.find(t => t.id === id);
    if (!tpl) return;

    // Update toolbar
    $('templateName').value  = tpl.name  || '';
    $('templateStyle').value = tpl.style || 'formal';
    $('bgColor').value = tpl.background || '#EBF4F8';

    // Update list active state
    document.querySelectorAll('#adminTemplateList li').forEach(li => {
      li.classList.toggle('active', li.dataset.id === id);
    });

    $('editorEmpty').style.display = 'none';
    adminState.selectedElId = null;
    _hideAllProps();

    _renderEditorCanvas(tpl);
    _renderOverlays(tpl);
    setTimeout(_fitEditorCanvas, 50);
  }

  // ── Editor Canvas ─────────────────────────────
  function _renderEditorCanvas(tpl) {
    const canvas = $('editorCanvas');
    // width set by createCanvasInstance
    // height set by createCanvasInstance
    _editorInst = createCanvasInstance(canvas);
    _editorInst.render(tpl, _placeholderData());
    _fitEditorCanvas();
  }

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
    return { unit: '單位名稱', name: '姓　名', title: '護理師', deed: '優良事蹟描述文字', date: '' };
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

    // Container must overlay the canvas
    container.style.position = 'absolute';
    container.style.left    = offsetX + 'px';
    container.style.top     = offsetY + 'px';
    container.style.width   = canvas.offsetWidth  + 'px';
    container.style.height  = canvas.offsetHeight + 'px';
    container.style.pointerEvents = 'all';

    // Text elements
    (tpl.elements || []).forEach(el => {
      const div = _createOverlayEl(el, scale);
      container.appendChild(div);
    });

    // Photo frame
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

    // Label
    const label = document.createElement('span');
    label.style.cssText = 'pointer-events:none;font-size:10px;color:#1a5c6b;padding:2px;opacity:.7';
    if (el.type === 'text' || !el.type) {
      label.textContent = el.bindField === 'custom' ? '自訂' : (el.bindField || '文字');
    } else {
      label.textContent = '相片';
    }
    div.appendChild(label);

    // Resize handle
    const handle = document.createElement('div');
    handle.className = 'el-handle';
    div.appendChild(handle);

    // Events
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

      // Dynamically populate bindField options from FieldManager
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
    // Ensure color is valid hex for <input type=color>
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

  function _loadBgImage(file) {
    const img = new Image();
    img.onload = () => {
      _editorInst && _editorInst.setBgImage(img);
      _reRenderCanvas();
    };
    img.src = URL.createObjectURL(file);
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
    // 重用現有實例；若尚未建立則先建立
    if (!_editorInst) _editorInst = createCanvasInstance($('editorCanvas'));
    _editorInst.render(tpl, _placeholderData());
  }

  function _placeholderData() {
    const data = {};
    FieldManager.load().forEach(f => { data[f.id] = f.label; });
    return data;
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

      // Label
      const labelEl = document.createElement('span');
      labelEl.className = 'fl-label';
      labelEl.textContent = f.label;
      li.appendChild(labelEl);

      // Type badge
      const typeEl = document.createElement('span');
      typeEl.className = 'fl-type';
      typeEl.textContent = f.type === 'textarea' ? '長文字' : f.type === 'date' ? '日期' : '文字';
      li.appendChild(typeEl);

      // Built-in badge
      if (isBuiltIn) {
        const badge = document.createElement('span');
        badge.className = 'fl-builtin';
        badge.textContent = '內建';
        li.appendChild(badge);
      }

      // Enable/disable toggle
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

      // Delete button (non built-in only)
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
          if (tpl) { _renderEditorCanvas(tpl); _renderOverlays(tpl); }
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
    // Sync in-memory state
    adminState.templates = templates;
    _renderTemplateList();
  }

  function _openAddFieldModal() {
    // Build modal
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
