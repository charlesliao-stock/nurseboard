/**
 * app.js
 * 主應用邏輯 — 狀態管理、UI 互動、預覽更新
 */

(() => {
  // ── State ──────────────────────────────────────
  const state = {
    selectedTemplateId: null,
    templates: [],
    formData: { unit: '', name: '', title: '', deed: '', date: '' },
    photoFile: null,
    photoImg: null
  };

  // ── DOM refs ───────────────────────────────────
  const $ = id => document.getElementById(id);
  const els = {
    templateGrid:    $('templateGrid'),
    unitField:       $('unitField'),
    nameField:       $('nameField'),
    titleField:      $('titleField'),
    deedField:       $('deedField'),
    deedCount:       $('deedCount'),
    dateField:       $('dateField'),
    photoDrop:       $('photoDrop'),
    photoDropInner:  $('photoDropInner'),
    photoInput:      $('photoInput'),
    photoPreview:    $('photoPreviewThumb'),
    photoRemove:     $('photoRemove'),
    previewCanvas:   $('previewCanvas'),
    previewWrap:     $('previewWrap'),
    previewPlaceholder: $('previewPlaceholder'),
    btnDownload:     $('btnDownload'),
    btnUpload:       $('btnUpload'),
    uploadStatus:    $('uploadStatus'),
    cropModal:       $('cropModal'),
    cropImg:         $('cropImg'),
    cropZoom:        $('cropZoom'),
    cropCancel:      $('cropCancel'),
    cropConfirm:     $('cropConfirm'),
    toast:           $('toast')
  };

  // ── Init ───────────────────────────────────────
  function init() {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    els.dateField.value = today;
    state.formData.date = today;

    // Load templates & render thumbnails
    state.templates = TemplateManager.load();
    _renderTemplateThumbs();

    // Auto-select first template
    if (state.templates.length > 0) {
      _selectTemplate(state.templates[0].id);
    }

    // Init Canvas
    CanvasEngine.init(els.previewCanvas);

    // Event listeners
    _bindFormListeners();
    _bindPhotoListeners();
    _bindActionListeners();
    _bindResize();
  }

  // ── Template Thumbnails ───────────────────────
  function _renderTemplateThumbs() {
    els.templateGrid.innerHTML = '';
    state.templates.forEach(tpl => {
      const wrap = document.createElement('div');
      wrap.className = 'template-thumb';
      wrap.dataset.id = tpl.id;

      // Mini canvas as thumbnail
      const mc = document.createElement('canvas');
      mc.width = 320; mc.height = 180;
      CanvasEngine.init(mc);
      CanvasEngine.render(tpl, {});
      CanvasEngine.init(els.previewCanvas); // restore main canvas

      const img = document.createElement('img');
      img.src = mc.toDataURL();
      img.alt = tpl.name;

      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = tpl.name;

      wrap.appendChild(img);
      wrap.appendChild(label);
      wrap.addEventListener('click', () => _selectTemplate(tpl.id));
      els.templateGrid.appendChild(wrap);
    });
  }

  function _selectTemplate(id) {
    state.selectedTemplateId = id;
    // Update active state
    document.querySelectorAll('.template-thumb').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
    // Hide placeholder
    els.previewPlaceholder.style.display = 'none';
    _renderPreview();
  }

  // ── Form Listeners ────────────────────────────
  function _bindFormListeners() {
    const textFields = ['unit', 'name', 'title', 'deed', 'date'];
    textFields.forEach(key => {
      const el = {
        unit:  els.unitField,
        name:  els.nameField,
        title: els.titleField,
        deed:  els.deedField,
        date:  els.dateField
      }[key];
      if (!el) return;
      el.addEventListener('input', () => {
        state.formData[key] = el.value;
        if (key === 'deed') els.deedCount.textContent = el.value.length;
        _renderPreview();
      });
    });
  }

  // ── Photo Listeners ───────────────────────────
  function _bindPhotoListeners() {
    // Click to open file dialog
    els.photoDrop.addEventListener('click', e => {
      if (e.target === els.photoRemove) return;
      els.photoInput.click();
    });

    // File selected
    els.photoInput.addEventListener('change', e => {
      if (e.target.files[0]) _loadPhoto(e.target.files[0]);
    });

    // Drag & drop
    els.photoDrop.addEventListener('dragover', e => {
      e.preventDefault();
      els.photoDrop.classList.add('drag-over');
    });
    els.photoDrop.addEventListener('dragleave', () => {
      els.photoDrop.classList.remove('drag-over');
    });
    els.photoDrop.addEventListener('drop', e => {
      e.preventDefault();
      els.photoDrop.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) _loadPhoto(file);
    });

    // Remove photo
    els.photoRemove.addEventListener('click', e => {
      e.stopPropagation();
      state.photoFile = null;
      state.photoImg  = null;
      CanvasEngine.clearUserPhoto();
      els.photoPreview.hidden = true;
      els.photoRemove.hidden  = true;
      els.photoDropInner.hidden = false;
      els.photoInput.value = '';
      _renderPreview();
    });

    // Crop modal
    els.cropCancel.addEventListener('click', () => {
      els.cropModal.hidden = true;
    });
    els.cropConfirm.addEventListener('click', _confirmCrop);
  }

  function _loadPhoto(file) {
    state.photoFile = file;
    const url = URL.createObjectURL(file);

    // Show crop modal
    els.cropImg.src = url;
    els.cropZoom.value = 100;
    els.cropModal.hidden = false;
  }

  function _confirmCrop() {
    // Simple crop: use the image as-is for now (full crop UI is phase 2)
    // For now, just load into canvas engine
    const img = new Image();
    img.onload = () => {
      state.photoImg = img;
      CanvasEngine.setUserPhoto(img);

      // Show thumbnail
      els.photoPreview.src = img.src;
      els.photoPreview.hidden = false;
      els.photoRemove.hidden  = false;
      els.photoDropInner.hidden = true;

      els.cropModal.hidden = true;
      _renderPreview();
      URL.revokeObjectURL(els.cropImg.src);
    };
    img.src = els.cropImg.src;
  }

  // ── Actions ───────────────────────────────────
  function _bindActionListeners() {
    els.btnDownload.addEventListener('click', _download);
    els.btnUpload.addEventListener('click', _uploadToDrive);
  }

  function _download() {
    if (!state.selectedTemplateId) {
      _showToast('請先選擇模板');
      return;
    }
    const tpl = TemplateManager.getById(state.selectedTemplateId);
    if (!tpl) return;

    // Final high-res render
    CanvasEngine.render(tpl, state.formData);

    const name = state.formData.name || '護理師';
    const unit = state.formData.unit || '單位';
    const filename = `優良護理師_${unit}_${name}.png`;
    CanvasEngine.exportPNG(filename);
    _showToast('✓ 已下載 PNG');
  }

  async function _uploadToDrive() {
    if (!state.selectedTemplateId) {
      _showToast('請先選擇模板');
      return;
    }

    const tpl = TemplateManager.getById(state.selectedTemplateId);
    if (!tpl) return;

    // Check CLIENT_ID configured
    if (typeof GDrive === 'undefined') {
      _showToast('Google Drive 模組未載入');
      return;
    }

    els.btnUpload.disabled = true;
    els.uploadStatus.textContent = '連接 Google 帳號…';

    // Final render
    CanvasEngine.render(tpl, state.formData);

    CanvasEngine.getBlob(async (blob) => {
      const name = state.formData.name || '護理師';
      const unit = state.formData.unit || '單位';
      const filename = `優良護理師_${unit}_${name}.png`;

      const result = await GDrive.upload(blob, filename, unit, (msg) => {
        els.uploadStatus.textContent = msg;
      });

      els.btnUpload.disabled = false;

      if (result.success) {
        els.uploadStatus.textContent = `✓ 已上傳至 Google Drive`;
        _showToast('✓ 成功上傳 Google Drive');
      } else {
        els.uploadStatus.textContent = `✗ 上傳失敗：${result.error}`;
        _showToast('✗ 上傳失敗，請重試');
      }
    });
  }

  // ── Render Preview ────────────────────────────
  function _renderPreview() {
    if (!state.selectedTemplateId) return;
    const tpl = TemplateManager.getById(state.selectedTemplateId);
    if (!tpl) return;
    CanvasEngine.render(tpl, state.formData);
    CanvasEngine.fitToContainer(els.previewWrap);
  }

  // ── Resize ────────────────────────────────────
  function _bindResize() {
    let raf;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        CanvasEngine.fitToContainer(els.previewWrap);
      });
    });
    // Initial fit
    setTimeout(() => CanvasEngine.fitToContainer(els.previewWrap), 100);
  }

  // ── Toast ─────────────────────────────────────
  let _toastTimer;
  function _showToast(msg) {
    const t = els.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ── Boot ──────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
