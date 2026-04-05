/**
 * admin.js
 * 後台管理邏輯：修正背景圖片持久化儲存 (Base64 版本)
 */

(() => {
  // ── Config ─────────────────────────────────────
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
    
    // 背景圖片上傳監聽
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
    location.reload();
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
      tog.addEventListener('click', e => {
        e.stopPropagation();
        const nowEnabled = tog.classList.toggle('on');
        li.classList.toggle('disabled', !nowEnabled);
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

    $('templateName').value  = tpl.name  || '';
    $('templateStyle').value = tpl.style || 'formal';
    $('bgColor').value = tpl.background || '#EBF4F8';

    document.querySelectorAll('#adminTemplateList li').forEach(li => {
      li.classList.toggle('active', li.dataset.id === id);
    });

    $('editorEmpty').style.display = 'none';
    adminState.selectedElId = null;
    _hideAllProps();

    // 載入模板時，重置編輯器背景圖
    if (_editorInst) {
      if (tpl.customBgImage) {
        const img = new Image();
        img.onload = () => {
          _editorInst.setBgImage(img);
          _reRenderCanvas();
        };
        img.src = tpl.customBgImage;
      } else {
        _editorInst.setBgImage(null);
      }
    }

    _renderEditorCanvas(tpl);
    _renderOverlays(tpl);
    setTimeout(_fitEditorCanvas, 50);
  }

  // ── Editor Canvas ─────────────────────────────
  function _renderEditorCanvas(tpl) {
    const canvas = $('editorCanvas');
    if (!_editorInst) _editorInst = createCanvasInstance(canvas);
    _editorInst.render(tpl, _placeholderData());
    _fitEditorCanvas();
  }

  function _fitEditorCanvas() {
    const wrap   = $('editorCanvasWrap');
    const canvas = $('editorCanvas');
    if (!canvas.width) return;
    const scale  = Math.min((wrap.clientWidth - 48) / 1280, (wrap.clientHeight - 48) / 720);
    adminState.scale = scale;
    canvas.style.width  = Math.floor(1280 * scale) + 'px';
    canvas.style.height = Math.floor(720 * scale) + 'px';
    _positionOverlays();
  }

  function _renderOverlays(tpl) {
    const container = $('editorOverlays');
    container.innerHTML = '';
    const canvas  = $('editorCanvas');
    const canvasR = canvas.getBoundingClientRect();
    const wrapR   = $('editorCanvasWrap').getBoundingClientRect();
    const scale   = adminState.scale;

    container.style.left = (canvasR.left - wrapR.left) + 'px';
    container.style.top  = (canvasR.top  - wrapR.top) + 'px';
    container.style.width = canvas.offsetWidth  + 'px';
    container.style.height = canvas.offsetHeight + 'px';

    (tpl.elements || []).forEach(el => container.appendChild(_createOverlayEl(el, scale)));
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
    _positionDiv(div, el, scale);
    const label = document.createElement('span');
    label.style.cssText = 'pointer-events:none;font-size:10px;padding:2px;';
    label.textContent = el.bindField === 'custom' ? '自訂' : (el.bindField || '欄位');
    div.appendChild(label);
    const handle = document.createElement('div');
    handle.className = 'el-handle';
    div.appendChild(handle);
    div.addEventListener('mousedown', e => _onElMousedown(e, div, el));
    handle.addEventListener('mousedown', e => { e.stopPropagation(); _onResizeMousedown(e, div, el); });
    div.addEventListener('click', e => { e.stopPropagation(); _selectEl(el.id); });
    return div;
  }

  function _positionDiv(div, el, scale) {
    div.style.left = Math.round(el.x * scale) + 'px';
    div.style.top  = Math.round(el.y * scale) + 'px';
    div.style.width = Math.round((el.width || 100) * scale) + 'px';
    div.style.height = Math.round((el.height || 60) * scale) + 'px';
  }

  function _onElMousedown(e, div, el) {
    if (e.button !== 0) return;
    adminState.isDragging = true;
    adminState.dragOffset = { x: e.clientX - div.getBoundingClientRect().left, y: e.clientY - div.getBoundingClientRect().top };
    const containerR = $('editorOverlays').getBoundingClientRect();
    const scale = adminState.scale;
    const onMove = ev => {
      el.x = Math.round((ev.clientX - containerR.left - adminState.dragOffset.x) / scale);
      el.y = Math.round((ev.clientY - containerR.top  - adminState.dragOffset.y) / scale);
      _positionDiv(div, el, scale);
      _updatePropsPanel(el);
      _reRenderCanvas();
    };
    const onUp = () => { adminState.isDragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function _onResizeMousedown(e, div, el) {
    const startX = e.clientX, startY = e.clientY, startW = el.width || 100, startH = el.height || 60, scale = adminState.scale;
    const onMove = ev => {
      el.width = Math.max(40, Math.round(startW + (ev.clientX - startX) / scale));
      el.height = Math.max(20, Math.round(startH + (ev.clientY - startY) / scale));
      _positionDiv(div, el, scale);
      _updatePropsPanel(el);
      _reRenderCanvas();
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function _selectEl(elId) {
    adminState.selectedElId = elId;
    document.querySelectorAll('.editor-overlay-el').forEach(d => d.classList.toggle('selected', d.dataset.elid === elId));
    const tpl = _getActiveTpl();
    if (!tpl) return;
    let el = (tpl.elements || []).find(e => e.id === elId) || (tpl.photoFrame?.id === elId ? tpl.photoFrame : null);
    _updatePropsPanel(el, el === tpl.photoFrame);
  }

  function _hideAllProps() { $('propsEmpty').hidden = false; $('propsText').hidden = true; $('propsPhoto').hidden = true; }

  function _updatePropsPanel(el, isPhoto = false) {
    if (!el) { _hideAllProps(); return; }
    $('propsEmpty').hidden = true;
    if (isPhoto) {
      $('propsText').hidden = true; $('propsPhoto').hidden = false;
      ['photoX','photoY','photoW','photoH'].forEach(id => $(id).value = el[id.slice(5).toLowerCase()]);
      $('photoShape').value = el.shape || 'circle';
    } else {
      $('propsText').hidden = false; $('propsPhoto').hidden = true;
      const sel = $('propBindField'); sel.innerHTML = '';
      FieldManager.load().forEach(f => { const o = document.createElement('option'); o.value = f.id; o.textContent = f.label; sel.appendChild(o); });
      const co = document.createElement('option'); co.value = 'custom'; co.textContent = '自訂文字'; sel.appendChild(co);
      sel.value = el.bindField || 'unit';
      $('propCustomText').value = el.customText || '';
      ['propX','propY','propW','propH'].forEach(id => $(id).value = el[id.slice(4).toLowerCase()]);
      $('propFontSize').value = el.fontSize || 16;
      $('propFontWeight').value = el.fontWeight || '400';
      $('propColor').value = el.color || '#1a2126';
    }
  }

  function _updateElFromProps() {
    const elId = adminState.selectedElId;
    const tpl = _getActiveTpl();
    if (!elId || !tpl) return;
    let el = (tpl.elements || []).find(e => e.id === elId) || (tpl.photoFrame?.id === elId ? tpl.photoFrame : null);
    if (!el) return;
    if (el === tpl.photoFrame) {
      el.x = parseInt($('photoX').value); el.y = parseInt($('photoY').value);
      el.width = parseInt($('photoW').value); el.height = parseInt($('photoH').value);
      el.shape = $('photoShape').value;
    } else {
      el.bindField = $('propBindField').value; el.customText = $('propCustomText').value;
      el.x = parseInt($('propX').value); el.y = parseInt($('propY').value);
      el.width = parseInt($('propW').value); el.height = parseInt($('propH').value);
      el.fontSize = parseInt($('propFontSize').value); el.fontWeight = $('propFontWeight').value;
      el.color = $('propColor').value;
    }
    _renderOverlays(tpl); _reRenderCanvas();
  }

  function _updateBgColor() {
    const tpl = _getActiveTpl(); if (tpl) { tpl.background = $('bgColor').value; _reRenderCanvas(); }
  }

  // --- 關鍵修正：上傳背景圖片並轉為 Base64 持久化 ---
  function _loadBgImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      const tpl = _getActiveTpl();
      if (tpl) {
        tpl.customBgImage = base64Data; // 儲存至模板物件
        const img = new Image();
        img.onload = () => {
          if (_editorInst) {
            _editorInst.setBgImage(img);
            _reRenderCanvas();
          }
        };
        img.src = base64Data;
      }
    };
    reader.readAsDataURL(file);
  }

  function _addElement(type) {
    const tpl = _getActiveTpl(); if (!tpl) return;
    const id = 'el_' + Date.now();
    if (type === 'text') {
      tpl.elements = tpl.elements || [];
      tpl.elements.push({ id, type: 'text', bindField: 'unit', x: 80, y: 80, width: 300, height: 40, fontSize: 18, fontWeight: '400', color: '#1a2126', align: 'left' });
    } else {
      tpl.photoFrame = { id, type: 'photo', x: 860, y: 80, width: 280, height: 280, shape: 'circle', borderColor: '#2a8fa6', borderWidth: 3, shadow: true };
    }
    _renderOverlays(tpl); _reRenderCanvas(); _selectEl(id);
  }

  function _deleteSelectedEl() {
    const elId = adminState.selectedElId; const tpl = _getActiveTpl(); if (!elId || !tpl) return;
    if (tpl.photoFrame?.id === elId) tpl.photoFrame = null;
    else tpl.elements = (tpl.elements || []).filter(e => e.id !== elId);
    adminState.selectedElId = null; _hideAllProps(); _renderOverlays(tpl); _reRenderCanvas();
  }

  function _saveTemplate() {
    const tpl = _getActiveTpl(); if (!tpl) return;
    tpl.name = $('templateName').value; tpl.style = $('templateStyle').value;
    TemplateManager.save(adminState.templates);
    _renderTemplateList(); 
    _showToast('✓ 模板與背景已成功儲存');
  }

  function _newTemplate() {
    const id = 'tpl_' + Date.now();
    const newTpl = { id, name: '新模板', style: 'formal', background: '#EBF4F8', elements: [], photoFrame: { id: 'photo_'+Date.now(), x: 860, y: 80, width: 320, height: 320, shape: 'circle', borderColor: '#2a8fa6', borderWidth: 4, shadow: true } };
    adminState.templates.push(newTpl); 
    TemplateManager.save(adminState.templates); 
    _loadTemplate(id); 
    _renderTemplateList();
  }

  function _deleteTemplate() {
    if (!confirm('確定要刪除此模板？')) return;
    adminState.templates = adminState.templates.filter(t => t.id !== adminState.activeTemplateId);
    TemplateManager.save(adminState.templates); 
    location.reload();
  }

  function _getActiveTpl() { return adminState.templates.find(t => t.id === adminState.activeTemplateId); }

  function _reRenderCanvas() {
    const tpl = _getActiveTpl(); if (tpl && _editorInst) _editorInst.render(tpl, _placeholderData());
  }

  function _placeholderData() {
    const data = {}; FieldManager.load().forEach(f => { data[f.id] = f.label; }); return data;
  }

  function _renderFieldList() {
    const list = $('fieldList'); list.innerHTML = '';
    FieldManager.load().forEach(f => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="fl-label">${f.label}</span><span class="fl-type">${f.type}</span>`;
      list.appendChild(li);
    });
  }

  function _openAddFieldModal() {
    // 簡單實作新增欄位邏輯
    const label = prompt('請輸入欄位名稱：');
    if (label) {
      FieldManager.addField(label, 'text');
      _renderFieldList();
      _showToast('已新增欄位');
    }
  }

  function _showToast(msg) { 
    const t = $('toast'); 
    t.textContent = msg; 
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), 2600); 
  }

  document.addEventListener('DOMContentLoaded', init);
})();
