/**
 * crop.js  v2
 * 互動式相片裁切工具
 * 修正：s.img null guard、open() 完整重置、事件只綁一次
 */

const CropTool = (() => {

  // ── State ─────────────────────────────────────
  const s = {
    img: null,
    frameW: 320, frameH: 320,
    frameShape: 'circle',
    scale: 1,
    minScale: 1,
    maxScale: 4,
    offsetX: 0, offsetY: 0,
    dragging: false,
    lastMX: 0, lastMY: 0,
    onConfirm: null,
    onCancel:  null,
    ready: false    // ← 圖片載入完成才允許互動
  };

  let _canvas = null, _ctx = null;
  let _built = false;   // DOM 只建一次

  // ── Build DOM + 綁事件（只執行一次）────────────
  function _buildUI() {
    if (_built) return;
    _built = true;

    const overlay = document.createElement('div');
    overlay.id = 'cropToolModal';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(13,45,53,.65);backdrop-filter:blur(6px);align-items:center;justify-content:center;z-index:400;';
    overlay.innerHTML = `
<div class="ct-box">
  <h3 class="ct-title">裁切相片</h3>
  <div class="ct-frame-wrap" id="ctFrameWrap">
    <canvas id="ctCanvas" style="display:block;cursor:grab;"></canvas>
    <div class="ct-loading" id="ctLoading">載入中…</div>
    <div class="ct-hint" id="ctHint" style="opacity:0">拖曳移動　滾輪縮放</div>
  </div>
  <div class="ct-controls">
    <div class="ct-zoom-row">
      <span class="ct-icon">🔍</span>
      <input type="range" id="ctZoom" min="100" max="400" value="100" step="1">
      <span class="ct-zoom-val" id="ctZoomVal">100%</span>
    </div>
    <div class="ct-shape-row">
      <span class="ct-label">形狀</span>
      <button class="ct-shape-btn active" data-shape="circle">圓形</button>
      <button class="ct-shape-btn" data-shape="rounded">圓角</button>
      <button class="ct-shape-btn" data-shape="rect">方形</button>
    </div>
  </div>
  <div class="ct-actions">
    <button class="btn btn--outline" id="ctCancel">取消</button>
    <button class="btn btn--primary" id="ctConfirm">確認裁切</button>
  </div>
</div>`;
    document.body.appendChild(overlay);

    _canvas = document.getElementById('ctCanvas');
    _ctx    = _canvas.getContext('2d');

    // ── 所有事件只在這裡綁定一次 ────────────────
    document.getElementById('ctCancel').addEventListener('click', _cancel);
    document.getElementById('ctConfirm').addEventListener('click', _confirm);

    document.getElementById('ctZoom').addEventListener('input', e => {
      if (!s.ready) return;   // ← guard
      _setZoom(+e.target.value);
    });

    _canvas.addEventListener('mousedown', e => {
      if (!s.ready) return;
      s.dragging = true;
      s.lastMX = e.clientX; s.lastMY = e.clientY;
      _canvas.style.cursor = 'grabbing';
    });
    _canvas.addEventListener('mousemove', e => {
      if (!s.ready || !s.dragging) return;
      s.offsetX += e.clientX - s.lastMX;
      s.offsetY += e.clientY - s.lastMY;
      s.lastMX = e.clientX; s.lastMY = e.clientY;
      _clampOffset(); _draw();
    });
    const _stopDrag = () => { s.dragging = false; if (_canvas) _canvas.style.cursor = 'grab'; };
    _canvas.addEventListener('mouseup',    _stopDrag);
    _canvas.addEventListener('mouseleave', _stopDrag);

    _canvas.addEventListener('wheel', e => {
      if (!s.ready) return;
      e.preventDefault();
      const rect = _canvas.getBoundingClientRect();
      const pct  = Math.round(s.scale / s.minScale * 100);
      _setZoom(pct - e.deltaY * 0.08, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    let _lastPinch = 0;
    _canvas.addEventListener('touchstart', e => {
      if (!s.ready) return;
      e.preventDefault();
      if (e.touches.length === 1) {
        s.dragging = true;
        s.lastMX = e.touches[0].clientX; s.lastMY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        _lastPinch = _pinchDist(e);
      }
    }, { passive: false });

    _canvas.addEventListener('touchmove', e => {
      if (!s.ready) return;
      e.preventDefault();
      if (e.touches.length === 1 && s.dragging) {
        s.offsetX += e.touches[0].clientX - s.lastMX;
        s.offsetY += e.touches[0].clientY - s.lastMY;
        s.lastMX = e.touches[0].clientX; s.lastMY = e.touches[0].clientY;
        _clampOffset(); _draw();
      } else if (e.touches.length === 2 && _lastPinch > 0) {
        const d = _pinchDist(e);
        const pct = Math.round(s.scale / s.minScale * 100 * d / _lastPinch);
        _lastPinch = d;
        _setZoom(pct);
      }
    }, { passive: false });

    _canvas.addEventListener('touchend', _stopDrag);

    document.querySelectorAll('.ct-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!s.ready) return;
        document.querySelectorAll('.ct-shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        s.frameShape = btn.dataset.shape;
        _draw();
      });
    });
  }

  // ── Open ──────────────────────────────────────
  function open({ file, shape, onConfirm, onCancel }) {
    _buildUI();

    // 每次開啟前完整重置狀態
    s.ready      = false;
    s.img        = null;
    s.dragging   = false;
    s.onConfirm  = onConfirm;
    s.onCancel   = onCancel;
    s.frameShape = shape || 'circle';

    // 同步形狀按鈕
    document.querySelectorAll('.ct-shape-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.shape === s.frameShape);
    });

    // 重置滑桿
    const zoomEl = document.getElementById('ctZoom');
    zoomEl.value = 100;
    document.getElementById('ctZoomVal').textContent = '100%';

    // 顯示 loading，隱藏 canvas 內容
    document.getElementById('ctLoading').style.display = 'flex';
    _canvas.style.opacity = '0';

    // 顯示 modal
    document.getElementById('cropToolModal').style.display = 'flex';

    // 非同步載入圖片
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      s.img = img;

      const DISPLAY = 320;
      s.frameW = DISPLAY; s.frameH = DISPLAY;
      _canvas.width  = DISPLAY;
      _canvas.height = DISPLAY;
      _canvas.style.width  = DISPLAY + 'px';
      _canvas.style.height = DISPLAY + 'px';

      const iw = img.naturalWidth, ih = img.naturalHeight;
      s.minScale = Math.max(DISPLAY / iw, DISPLAY / ih);
      s.scale    = s.minScale;
      s.offsetX  = (DISPLAY - iw * s.scale) / 2;
      s.offsetY  = (DISPLAY - ih * s.scale) / 2;

      // 圖片載入完成，允許互動
      s.ready = true;

      // 顯示 canvas，隱藏 loading
      document.getElementById('ctLoading').style.display = 'none';
      _canvas.style.opacity = '1';

      // 提示淡出
      const hint = document.getElementById('ctHint');
      hint.style.opacity = '1';
      setTimeout(() => { hint.style.opacity = '0'; }, 2400);

      _draw();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      _cancel();
    };
    img.src = url;
  }

  // ── Draw ──────────────────────────────────────
  function _draw() {
    if (!_ctx || !s.img || !s.ready) return;
    const ctx = _ctx;
    const W = s.frameW, H = s.frameH;

    ctx.clearRect(0, 0, W, H);
    _drawChecker(ctx, W, H);

    const iw = s.img.naturalWidth, ih = s.img.naturalHeight;
    ctx.drawImage(s.img, s.offsetX, s.offsetY, iw * s.scale, ih * s.scale);

    // 暗化遮罩
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); _shapePath(ctx, W, H); ctx.fill();
    ctx.restore();

    // 形狀邊框
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); _shapePath(ctx, W, H); ctx.stroke();
    ctx.restore();

    // 三等分格線
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 0.5;
    [W/3, 2*W/3].forEach(x => { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); });
    [H/3, 2*H/3].forEach(y => { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); });
    ctx.restore();
  }

  function _drawChecker(ctx, W, H) {
    const sz = 12;
    for (let x = 0; x < W; x += sz)
      for (let y = 0; y < H; y += sz) {
        ctx.fillStyle = ((x/sz + y/sz) % 2 === 0) ? '#ccc' : '#aaa';
        ctx.fillRect(x, y, sz, sz);
      }
  }

  function _shapePath(ctx, W, H) {
    const p = 4;
    if (s.frameShape === 'circle') {
      ctx.arc(W/2, H/2, W/2 - p, 0, Math.PI*2);
    } else if (s.frameShape === 'rounded') {
      const r = (W - p*2) * 0.1;
      const x = p, y = p, w = W-p*2, h = H-p*2;
      ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
      ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
    } else {
      ctx.rect(p, p, W-p*2, H-p*2);
    }
  }

  // ── Zoom ──────────────────────────────────────
  function _setZoom(pct, pivotX, pivotY) {
    if (!s.ready || !s.img) return;   // ← guard
    const newScale = Math.max(s.minScale, Math.min(s.maxScale * s.minScale, s.minScale * (pct / 100)));
    const ratio    = newScale / s.scale;
    const px = pivotX ?? s.frameW / 2;
    const py = pivotY ?? s.frameH / 2;
    s.offsetX = px - ratio * (px - s.offsetX);
    s.offsetY = py - ratio * (py - s.offsetY);
    s.scale   = newScale;
    _clampOffset();
    _draw();
    const actual = Math.round(s.scale / s.minScale * 100);
    document.getElementById('ctZoom').value = actual;
    document.getElementById('ctZoomVal').textContent = actual + '%';
  }

  // ── Clamp ─────────────────────────────────────
  function _clampOffset() {
    if (!s.img) return;   // ← guard
    const iw = s.img.naturalWidth  * s.scale;
    const ih = s.img.naturalHeight * s.scale;
    s.offsetX = Math.min(0, Math.max(s.frameW - iw, s.offsetX));
    s.offsetY = Math.min(0, Math.max(s.frameH - ih, s.offsetY));
  }

  // ── Touch helper ──────────────────────────────
  function _pinchDist(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  // ── Confirm / Cancel ──────────────────────────
  function _confirm() {
    if (!s.ready || !s.img) return;
    const fw = s.frameW;
    const result = {
      img: s.img,
      cropState: {
        scale:   s.scale / fw * s.img.naturalWidth,
        offsetX: s.offsetX / fw,
        offsetY: s.offsetY / fw
      },
      shape: s.frameShape
    };
    s.ready = false;
    _close();
    s.onConfirm?.(result);
  }

  function _cancel() {
    s.ready = false;
    _close();
    s.onCancel?.();
  }

  function _close() {
    const m = document.getElementById('cropToolModal');
    if (m) m.style.display = 'none';
  }

  return { open };
})();
