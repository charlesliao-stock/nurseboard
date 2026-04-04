/**
 * app.js  v2
 * 主應用邏輯 — 整合 CropTool、修正縮圖獨立渲染
 */

(() => {
  // ── State ──────────────────────────────────────
  const state = {
    selectedTemplateId: null,
    templates: [],
    formData: { unit: '', name: '', title: '', deed: '', date: '' },
    photo: null,       // { img, cropState, shape }
  };

  // ── DOM refs ───────────────────────────────────
  const $ = id => document.getElementById(id);
  const els = {
    templateGrid:       $('templateGrid'),
    photoDrop:          $('photoDrop'),
    photoDropInner:     $('photoDropInner'),
    photoInput:         $('photoInput'),
    photoPreviewThumb:  $('photoPreviewThumb'),
    photoRemove:        $('photoRemove'),
    previewCanvas:      $('previewCanvas'),
    previewWrap:        $('previewWrap'),
    previewPlaceholder: $('previewPlaceholder'),
    btnDownload:        $('btnDownload'),
    btnUpload:          $('btnUpload'),
    uploadStatus:       $('uploadStatus'),
    toast:              $('toast')
  };

  // ── Init ───────────────────────────────────────
  function init() {
    state.templates = TemplateManager.loadEnabled();

    // Init main canvas FIRST
    CanvasEngine.init(els.previewCanvas);

    // Build form fields dynamically
    _buildFormFields();

    // Render thumbnails (isolated instances)
    _renderTemplateThumbs();

    // Auto-select first
    if (state.templates.length > 0) _selectTemplate(state.templates[0].id);

    _bindPhotoListeners();
    _bindActionListeners();
    _bindResize();

    // Set default date
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('field_date');
    if (dateEl) { dateEl.value = today; state.formData['date'] = today; }
  }

  // ── Template Thumbnails ───────────────────────
  function _renderTemplateThumbs() {
    els.templateGrid.innerHTML = '';
    state.templates.forEach((tpl, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'template-thumb';
      wrap.dataset.id = tpl.id;
      wrap.style.animationDelay = (i * 60) + 'ms';

      // Use isolated thumbnail renderer (no shared state)
      const img = document.createElement('img');
      img.alt  = tpl.name;
      img.src  = renderTemplateThumbnail(tpl);   // from canvas.js

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
    document.querySelectorAll('.template-thumb').forEach(el =>
      el.classList.toggle('active', el.dataset.id === id)
    );
    els.previewPlaceholder.style.display = 'none';
    _renderPreview();
  }

  // ── Dynamic Form Fields ───────────────────────
  function _buildFormFields() {
    const section = document.getElementById('dynamicFields');
    if (!section) return;
    section.innerHTML = '';
    const fields = FieldManager.load();

    fields.forEach(f => {
      const group = document.createElement('div');
      group.className = 'field-group';

      const label = document.createElement('label');
      label.className = 'field-label';
      label.setAttribute('for', 'field_' + f.id);
      label.textContent = f.label;
      group.appendChild(label);

      let input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'field-textarea';
        input.rows = 4;
        input.maxLength = 200;
        input.placeholder = f.label + '…';

        // char counter
        const counter = document.createElement('span');
        counter.className = 'char-count';
        counter.innerHTML = `<span id="count_${f.id}">0</span>/200`;
        input.addEventListener('input', () => {
          document.getElementById('count_' + f.id).textContent = input.value.length;
        });
        group.appendChild(input);
        group.appendChild(counter);
      } else if (f.type === 'date') {
        input = document.createElement('input');
        input.type = 'date';
        input.className = 'field-input';
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'field-input';
        input.maxLength = f.id === 'name' ? 10 : 30;
        input.placeholder = '例：' + f.label;
        if (f.id === 'name') input.classList.add('field-input--large');
      }

      input.id = 'field_' + f.id;
      input.addEventListener('input', () => {
        state.formData[f.id] = input.value;
        _renderPreview();
      });

      if (f.type !== 'textarea') group.appendChild(input);
      section.appendChild(group);
    });
  }

  // ── Form Listeners ────────────────────────────
  function _bindFormListeners() {
    // kept for compatibility but fields are bound in _buildFormFields
  }

  // ── Photo Listeners ───────────────────────────
  function _bindPhotoListeners() {
    els.photoDrop.addEventListener('click', e => {
      if (e.target === els.photoRemove) return;
      if (state.photo) return; // already has photo, click remove instead
      els.photoInput.click();
    });

    els.photoInput.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) _openCrop(f);
    });

    els.photoDrop.addEventListener('dragover', e => {
      e.preventDefault(); els.photoDrop.classList.add('drag-over');
    });
    els.photoDrop.addEventListener('dragleave', () => {
      els.photoDrop.classList.remove('drag-over');
    });
    els.photoDrop.addEventListener('drop', e => {
      e.preventDefault(); els.photoDrop.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith('image/')) _openCrop(f);
    });

    els.photoRemove.addEventListener('click', e => {
      e.stopPropagation();
      _clearPhoto();
    });
  }

  function _openCrop(file) {
    // Determine shape from selected template's photoFrame
    const tpl = state.selectedTemplateId
      ? TemplateManager.getById(state.selectedTemplateId)
      : null;
    const shape = tpl?.photoFrame?.shape || 'circle';

    CropTool.open({
      file,
      shape,
      onConfirm: (result) => {
        state.photo = result;

        // Convert normalized cropState → canvas-space cropState
        // result.cropState: { scale (image widths), offsetX/Y (fractions of frame) }
        // canvas.js _drawCroppedPhoto expects: { scale (img scale factor), offsetX/Y (px in frame) }
        const pf = tpl?.photoFrame;
        if (pf && result.cropState) {
          const fw = pf.width, fh = pf.height;
          const iw = result.img.naturalWidth;
          const scaleFactor = result.cropState.scale * fw / iw;
          state.photo.cropState = {
            scale:   scaleFactor,
            offsetX: result.cropState.offsetX * fw,
            offsetY: result.cropState.offsetY * fh
          };
        }

        CanvasEngine.setUserPhoto(result.img, state.photo.cropState);

        // Thumbnail preview
        _showPhotoThumb(result.img);
        _renderPreview();
        els.photoInput.value = '';
      },
      onCancel: () => {
        els.photoInput.value = '';
      }
    });
  }

  function _showPhotoThumb(img) {
    // Draw 60×60 thumbnail
    const tc = document.createElement('canvas');
    tc.width = tc.height = 120;
    const tctx = tc.getContext('2d');
    const s = Math.max(120 / img.naturalWidth, 120 / img.naturalHeight);
    tctx.drawImage(img, (120-img.naturalWidth*s)/2, (120-img.naturalHeight*s)/2, img.naturalWidth*s, img.naturalHeight*s);

    els.photoPreviewThumb.src    = tc.toDataURL();
    els.photoPreviewThumb.hidden = false;
    els.photoRemove.hidden       = false;
    els.photoDropInner.hidden    = true;
  }

  function _clearPhoto() {
    state.photo = null;
    CanvasEngine.clearUserPhoto();
    els.photoPreviewThumb.hidden = true;
    els.photoRemove.hidden       = true;
    els.photoDropInner.hidden    = false;
    els.photoInput.value         = '';
    _renderPreview();
  }

  // ── Actions ───────────────────────────────────
  function _bindActionListeners() {
    els.btnDownload.addEventListener('click', _download);
    els.btnUpload.addEventListener('click', _uploadToDrive);
  }

  function _download() {
    if (!state.selectedTemplateId) { _toast('請先選擇模板'); return; }
    const tpl = TemplateManager.getById(state.selectedTemplateId);
    if (!tpl) return;
    CanvasEngine.render(tpl, state.formData);
    const filename = `優良護理師_${state.formData.unit||'單位'}_${state.formData.name||'護理師'}.png`;
    CanvasEngine.exportPNG(filename);
    _toast('✓ 已下載 PNG');
  }

  async function _uploadToDrive() {
    if (!state.selectedTemplateId) { _toast('請先選擇模板'); return; }
    if (typeof GDrive === 'undefined') { _toast('Google Drive 模組未載入'); return; }

    const tpl = TemplateManager.getById(state.selectedTemplateId);
    if (!tpl) return;

    els.btnUpload.disabled = true;
    els.uploadStatus.textContent = '連接 Google 帳號…';

    CanvasEngine.render(tpl, state.formData);

    CanvasEngine.getBlob(async (blob) => {
      const unit = state.formData.unit || '單位';
      const name = state.formData.name || '護理師';
      const filename = `優良護理師_${unit}_${name}.png`;

      const result = await GDrive.upload(blob, filename, unit, msg => {
        els.uploadStatus.textContent = msg;
      });

      els.btnUpload.disabled = false;

      if (result.success) {
        els.uploadStatus.textContent = '✓ 已上傳至 Google Drive';
        _toast('✓ 成功上傳 Google Drive');
      } else {
        els.uploadStatus.textContent = `✗ 上傳失敗：${result.error}`;
        _toast('✗ 上傳失敗，請重試');
      }
    });
  }

  // ── Preview ───────────────────────────────────
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
      raf = requestAnimationFrame(() => CanvasEngine.fitToContainer(els.previewWrap));
    });
    setTimeout(() => CanvasEngine.fitToContainer(els.previewWrap), 120);
  }

  // ── Toast ─────────────────────────────────────
  let _toastTimer;
  function _toast(msg) {
    const t = els.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
