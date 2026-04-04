/**
 * crop.js
 * 互動式相片裁切工具
 * 支援：縮放（滑桿 + 滾輪）、拖曳平移、形狀預覽（圓/方/圓角）
 */

const CropTool = (() => {
  // ── State ─────────────────────────────────────
  const s = {
    img: null,
    frameW: 320, frameH: 320,  // 裁切框顯示尺寸（px）
    frameShape: 'circle',
    scale: 1,       // 圖片縮放倍率（相對於 cover-fit）
    minScale: 1,    // cover-fit 比例（最小值）
    maxScale: 4,
    offsetX: 0, offsetY: 0,   // 圖片左上角在 frame 內的偏移（px）
    dragging: false,
    lastMX: 0, lastMY: 0,
    // callbacks
    onConfirm: null,
    onCancel:  null
  };

  let _canvas = null, _ctx = null;
  let _container = null;

  // ── Build DOM ────────────────────────────────
  function _buildUI() {
    // Prevent double-build
    if (document.getElementById('cropToolModal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'cropToolModal';
    overlay.innerHTML = `
<div class="ct-box">
  <h3 class="ct-title">裁切相片</h3>
  <div class="ct-frame-wrap" id="ctFrameWrap">
    <canvas id="ctCanvas"></canvas>
    <div class="ct-mask" id="ctMask"></div>
    <div class="ct-hint" id="ctHint">拖曳移動　滾輪縮放</div>
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
    _container = document.getElementById('ctFrameWrap');

    // Events
    document.getElementById('ctCancel').addEventListener('click', _cancel);
    document.getElementById('ctConfirm').addEventListener('click', _confirm);
    document.getElementById('ctZoom').addEventListener('input', _onZoomSlider);
    _canvas.addEventListener('mousedown', _onMouseDown);
    _canvas.addEventListener('mousemove', _onMouseMove);
    _canvas.addEventListener('mouseup',   _onMouseUp);
    _canvas.addEventListener('mouseleave',_onMouseUp);
    _canvas.addEventListener('wheel', _onWheel, { passive: false });
    _canvas.addEventListener('touchstart', _onTouchStart, { passive: false });
    _canvas.addEventListener('touchmove',  _onTouchMove,  { passive: false });
    _canvas.addEventListener('touchend',   _onMouseUp);

    document.querySelectorAll('.ct-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ct-shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        s.frameShape = btn.dataset.shape;
        _draw();
      });
    });
  }

  // ── Open ─────────────────────────────────────
  function open({ file, shape, onConfirm, onCancel }) {
    _buildUI();
    s.onConfirm  = onConfirm;
    s.onCancel   = onCancel;
    s.frameShape = shape || 'circle';

    // Sync shape button
    document.querySelectorAll('.ct-shape-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.shape === s.frameShape);
    });

    const modal = document.getElementById('cropToolModal');
    modal.style.display = 'flex';
    document.getElementById('ctHint').style.opacity = '1';
    setTimeout(() => { document.getElementById('ctHint').style.opacity = '0'; }, 2400);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      s.img = img;

      // Canvas display size = 320×320 (square frame)
      const DISPLAY = 320;
      s.frameW = DISPLAY; s.frameH = DISPLAY;
      _canvas.width  = DISPLAY;
      _canvas.height = DISPLAY;
      _canvas.style.width  = DISPLAY + 'px';
      _canvas.style.height = DISPLAY + 'px';

      // Cover-fit scale as minimum
      const iw = img.naturalWidth, ih = img.naturalHeight;
      s.minScale = Math.max(DISPLAY / iw, DISPLAY / ih);
      s.scale = s.minScale;

      // Center
      s.offsetX = (DISPLAY - iw * s.scale) / 2;
      s.offsetY = (DISPLAY - ih * s.scale) / 2;

      document.getElementById('ctZoom').value = 100;
      document.getElementById('ctZoomVal').textContent = '100%';

      _draw();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ── Draw ─────────────────────────────────────
  function _draw() {
    if (!_ctx || !s.img) return;
    const ctx = _ctx;
    const W = s.frameW, H = s.frameH;

    ctx.clearRect(0, 0, W, H);

    // Checkerboard background
    _drawChecker(ctx, W, H);

    // Image
    const iw = s.img.naturalWidth, ih = s.img.naturalHeight;
    ctx.drawImage(s.img, s.offsetX, s.offsetY, iw * s.scale, ih * s.scale);

    // Dim outside mask
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 0, W, H);

    // Cut out shape
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    _shapePath(ctx, W, H);
    ctx.fill();
    ctx.restore();

    // Shape border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    _shapePath(ctx, W, H);
    ctx.stroke();
    ctx.restore();

    // Rule-of-thirds grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 0.5;
    [W/3, 2*W/3].forEach(x => { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); });
    [H/3, 2*H/3].forEach(y => { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); });
    ctx.restore();
  }

  function _drawChecker(ctx, W, H) {
    const size = 12;
    for (let x = 0; x < W; x += size)
      for (let y = 0; y < H; y += size) {
        ctx.fillStyle = ((x/size + y/size) % 2 === 0) ? '#ccc' : '#aaa';
        ctx.fillRect(x, y, size, size);
      }
  }

  function _shapePath(ctx, W, H) {
    const pad = 4;
    if (s.frameShape === 'circle') {
      ctx.arc(W/2, H/2, W/2 - pad, 0, Math.PI*2);
    } else if (s.frameShape === 'rounded') {
      const r = (W - pad*2) * 0.1;
      const x = pad, y = pad, w = W - pad*2, h = H - pad*2;
      ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
      ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
    } else {
      ctx.rect(pad, pad, W-pad*2, H-pad*2);
    }
  }

  // ── Zoom ─────────────────────────────────────
  function _setZoom(pct, pivotX, pivotY) {
    const targetScale = s.minScale * (pct / 100);
    const newScale    = Math.max(s.minScale, Math.min(s.maxScale * s.minScale, targetScale));
    const ratio       = newScale / s.scale;
    const px = pivotX ?? s.frameW / 2;
    const py = pivotY ?? s.frameH / 2;
    s.offsetX = px - ratio * (px - s.offsetX);
    s.offsetY = py - ratio * (py - s.offsetY);
    s.scale   = newScale;
    _clampOffset();
    _draw();
    const pctActual = Math.round(s.scale / s.minScale * 100);
    document.getElementById('ctZoom').value    = pctActual;
    document.getElementById('ctZoomVal').textContent = pctActual + '%';
  }

  function _onZoomSlider(e) { _setZoom(+e.target.value); }

  function _onWheel(e) {
    e.preventDefault();
    const rect = _canvas.getBoundingClientRect();
    const px   = e.clientX - rect.left;
    const py   = e.clientY - rect.top;
    const pct  = Math.round(s.scale / s.minScale * 100);
    _setZoom(pct - e.deltaY * 0.08, px, py);
  }

  // ── Drag ─────────────────────────────────────
  function _onMouseDown(e) {
    s.dragging = true;
    s.lastMX = e.clientX; s.lastMY = e.clientY;
    _canvas.style.cursor = 'grabbing';
  }
  function _onMouseMove(e) {
    if (!s.dragging) return;
    s.offsetX += e.clientX - s.lastMX;
    s.offsetY += e.clientY - s.lastMY;
    s.lastMX = e.clientX; s.lastMY = e.clientY;
    _clampOffset(); _draw();
  }
  function _onMouseUp() {
    s.dragging = false;
    _canvas.style.cursor = 'grab';
  }

  // ── Touch ─────────────────────────────────────
  let _lastPinchDist = 0;
  function _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      s.dragging = true;
      s.lastMX = e.touches[0].clientX;
      s.lastMY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      _lastPinchDist = _pinchDist(e);
    }
  }
  function _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && s.dragging) {
      s.offsetX += e.touches[0].clientX - s.lastMX;
      s.offsetY += e.touches[0].clientY - s.lastMY;
      s.lastMX = e.touches[0].clientX;
      s.lastMY = e.touches[0].clientY;
      _clampOffset(); _draw();
    } else if (e.touches.length === 2) {
      const dist  = _pinchDist(e);
      const ratio = dist / _lastPinchDist;
      _lastPinchDist = dist;
      const pct = Math.round(s.scale / s.minScale * 100 * ratio);
      _setZoom(pct);
    }
  }
  function _pinchDist(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  // ── Clamp offset (prevent showing outside) ────
  function _clampOffset() {
    const iw = s.img.naturalWidth  * s.scale;
    const ih = s.img.naturalHeight * s.scale;
    s.offsetX = Math.min(0, Math.max(s.frameW - iw, s.offsetX));
    s.offsetY = Math.min(0, Math.max(s.frameH - ih, s.offsetY));
  }

  // ── Confirm ───────────────────────────────────
  function _confirm() {
    if (!s.img) return;
    // Compute crop state scaled to full canvas (1280×720 space)
    // The photo frame in canvas coords is provided via template
    // We just return the scale & offset relative to the 320px display frame,
    // and the canvas engine will apply them relative to the actual frame.
    const displayScale   = s.frameW; // display size
    const result = {
      img: s.img,
      // Normalized values (0..1 relative to frame size)
      cropState: {
        // scale: how many frame-widths tall/wide the image is
        scale:   s.scale / displayScale * s.img.naturalWidth,
        // offsetX/Y: fraction of frame size
        offsetX: s.offsetX / displayScale,
        offsetY: s.offsetY / displayScale
      },
      shape: s.frameShape
    };
    _close();
    s.onConfirm?.(result);
  }

  function _cancel() { _close(); s.onCancel?.(); }

  function _close() {
    const m = document.getElementById('cropToolModal');
    if (m) m.style.display = 'none';
  }

  return { open };
})();
