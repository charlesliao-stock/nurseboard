/**
 * canvas.js  v2
 * Canvas 合成引擎 — 多實例架構，修正縮圖渲染狀態汙染
 * 輸出尺寸：1280 × 720 px (16:9)
 */

// ── 單一實例 factory ─────────────────────────────
function createCanvasInstance(canvasEl) {
  const W = 1280, H = 720;
  canvasEl.width  = W;
  canvasEl.height = H;
  const ctx = canvasEl.getContext('2d');

  let _userPhoto = null;
  let _bgImage   = null;
  let _cropState = null; // { scale, offsetX, offsetY }

  function setUserPhoto(img, cropState) { _userPhoto = img; _cropState = cropState || null; }
  function clearUserPhoto() { _userPhoto = null; _cropState = null; }
  function setBgImage(img)  { _bgImage = img; }

  // ── Load background from URL (cross-origin safe) ──
  // Resolves with the Image object, or null on failure.
  // Uses crossOrigin='anonymous' so canvas stays exportable.
  function loadBgFromUrl(url) {
    return new Promise((resolve) => {
      if (!url) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => { _bgImage = img; resolve(img); };
      img.onerror = () => {
        console.warn('[Canvas] 背景圖片載入失敗，URL:', url);
        resolve(null);
      };
      // Append a cache-buster only for Drive thumbnail URLs to avoid stale 403s
      img.src = url.includes('drive.google.com') ? url + '&_cb=' + Date.now() : url;
    });
  }

  // ── Main render ──────────────────────────────
  function render(template, formData) {
    if (!ctx || !template) return;
    ctx.clearRect(0, 0, W, H);
    _drawBackground(ctx, template);
    (template.decorations || []).forEach(d => _drawDecoration(ctx, d));
    if (template.photoFrame) _drawPhotoFrame(ctx, template.photoFrame);
    (template.elements || []).forEach(el => _drawTextElement(ctx, el, _resolveText(el, formData)));
    return canvasEl;
  }

  // ── Background ───────────────────────────────
  function _drawBackground(ctx, tpl) {
    ctx.fillStyle = tpl.background || '#fff';
    ctx.fillRect(0, 0, W, H);
    if (_bgImage) {
      ctx.save();
      ctx.globalAlpha = tpl.bgImageOpacity || 1;
      ctx.drawImage(_bgImage, 0, 0, W, H);
      ctx.restore();
    }
    if (tpl.bgPattern === 'grid')  _drawGridPattern(ctx, tpl.bgPatternColor || 'rgba(0,0,0,.05)');
    if (tpl.bgPattern === 'dots')  _drawDotPattern(ctx, tpl.bgPatternColor || 'rgba(0,0,0,.05)');
  }

  function _drawGridPattern(ctx, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();
  }

  function _drawDotPattern(ctx, color) {
    ctx.save(); ctx.fillStyle = color;
    for (let x = 0; x <= W; x += 30)
      for (let y = 0; y <= H; y += 30) { ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }

  // ── Decorations ──────────────────────────────
  function _drawDecoration(ctx, d) {
    ctx.save();
    switch (d.type) {
      case 'rect':
        ctx.fillStyle = d.color;
        if (d.radius) { ctx.beginPath(); _pathRR(ctx,d.x,d.y,d.width,d.height,d.radius); ctx.fill(); }
        else ctx.fillRect(d.x, d.y, d.width, d.height);
        break;
      case 'circle':
        ctx.fillStyle = d.color;
        ctx.beginPath(); ctx.arc(d.cx,d.cy,d.r,0,Math.PI*2); ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 2;
        ctx.beginPath(); ctx.arc(d.cx,d.cy,d.r,0,Math.PI*2); ctx.stroke();
        break;
      case 'line':
        ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
        if (d.dash) ctx.setLineDash(d.dash);
        ctx.beginPath(); ctx.moveTo(d.x1,d.y1); ctx.lineTo(d.x2,d.y2); ctx.stroke();
        ctx.setLineDash([]);
        break;
      case 'text_deco':
        ctx.font = `700 ${d.fontSize}px 'Noto Serif TC',serif`;
        ctx.fillStyle = d.color; ctx.textAlign = 'left';
        ctx.fillText(d.text, d.x, d.y);
        break;
    }
    ctx.restore();
  }

  // ── Photo Frame ──────────────────────────────
  function _drawPhotoFrame(ctx, f) {
    const { x, y, width: fw, height: fh, shape, borderColor, borderWidth, shadow, glowColor } = f;

    if (shadow || glowColor) {
      ctx.save();
      ctx.shadowColor   = glowColor || 'rgba(0,0,0,.22)';
      ctx.shadowBlur    = glowColor ? 40 : 28;
      ctx.shadowOffsetX = glowColor ?  0 :  4;
      ctx.shadowOffsetY = glowColor ?  0 :  8;
      ctx.fillStyle = (f.background || '#ffffff') + '01';
      ctx.beginPath(); _clipPath(ctx, x, y, fw, fh, shape); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath(); _clipPath(ctx, x, y, fw, fh, shape); ctx.clip();

    if (_userPhoto) {
      _drawCroppedPhoto(ctx, x, y, fw, fh);
    } else {
      const g = ctx.createLinearGradient(x, y, x+fw, y+fh);
      g.addColorStop(0, 'rgba(42,143,166,.10)');
      g.addColorStop(1, 'rgba(42,143,166,.20)');
      ctx.fillStyle = g; ctx.fillRect(x, y, fw, fh);
      ctx.font = `300 ${Math.floor(fw*.14)}px 'Noto Sans TC',sans-serif`;
      ctx.fillStyle = 'rgba(42,143,166,.40)'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('相片', x+fw/2, y+fh/2-fw*.05);
      ctx.font = `300 ${Math.floor(fw*.07)}px 'Noto Sans TC',sans-serif`;
      ctx.fillStyle = 'rgba(42,143,166,.25)';
      ctx.fillText('點擊上傳', x+fw/2, y+fh/2+fw*.08);
    }
    ctx.restore();

    if (borderColor && borderColor !== 'transparent' && borderWidth > 0) {
      ctx.save();
      ctx.strokeStyle = borderColor; ctx.lineWidth = borderWidth;
      const bh = borderWidth/2;
      ctx.beginPath(); _clipPath(ctx, x+bh, y+bh, fw-borderWidth, fh-borderWidth, shape); ctx.stroke();
      ctx.restore();
    }
  }

  function _clipPath(ctx, x, y, fw, fh, shape) {
    if (shape === 'circle') ctx.arc(x+fw/2, y+fh/2, Math.min(fw,fh)/2, 0, Math.PI*2);
    else if (shape === 'rounded') _pathRR(ctx, x, y, fw, fh, Math.min(fw,fh)*0.08);
    else ctx.rect(x, y, fw, fh);
  }

  function _drawCroppedPhoto(ctx, x, y, fw, fh) {
    const img = _userPhoto;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (_cropState) {
      const { scale: sc, offsetX, offsetY } = _cropState;
      ctx.drawImage(img, x + offsetX, y + offsetY, iw * sc, ih * sc);
    } else {
      const s = Math.max(fw/iw, fh/ih);
      ctx.drawImage(img, x+(fw-iw*s)/2, y+(fh-ih*s)/2, iw*s, ih*s);
    }
  }

  // ── Text Element ─────────────────────────────
  function _drawTextElement(ctx, el, resolved) {
    const text = typeof resolved === 'object' ? resolved.text : resolved;
    const isPlaceholder = typeof resolved === 'object' ? resolved.isPlaceholder : false;
    if (!text && !el.bgColor) return;
    ctx.save();
    if (el.bgColor) { ctx.fillStyle = el.bgColor; ctx.fillRect(el.x, el.y, el.width, el.height); }
    if (text) {
      const ff = el.serif ? "'Noto Serif TC',serif" : "'Noto Sans TC',sans-serif";
      const fs = isPlaceholder ? Math.max(12, Math.round((el.fontSize || 16) * 0.65)) : (el.fontSize || 16);
      ctx.font = `${isPlaceholder ? 400 : (el.fontWeight||400)} ${fs}px ${ff}`;
      ctx.fillStyle = isPlaceholder ? 'rgba(120,150,160,0.55)' : (el.color || '#1a2126');
      ctx.textBaseline = 'top';
      const align = el.align || 'left';
      let ax = el.x;
      if (align === 'center') { ctx.textAlign='center'; ax = el.x + el.width/2; }
      else if (align === 'right') { ctx.textAlign='right'; ax = el.x + el.width; }
      else ctx.textAlign = 'left';
      if (!isPlaceholder && el.wrap) {
        _drawWrapped(ctx, text, ax, el.x, el.y, el.width, el.height, fs, el.lineHeight||1.65);
      } else {
        const oy = Math.max(0,(el.height-fs)/2);
        ctx.fillText(text, ax, el.y+oy, el.width);
      }
    }
    ctx.restore();
  }

  function _drawWrapped(ctx, text, ax, bx, by, maxW, maxH, fs, lh) {
    const lhPx = fs * lh;
    const lines = [];
    for (const para of text.split('\n')) {
      if (!para) { lines.push(''); continue; }
      let line = '';
      for (const ch of para) {
        const t = line + ch;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = ch; }
        else line = t;
      }
      if (line) lines.push(line);
    }
    let y = by;
    for (const ln of lines) {
      if (y > by + maxH) break;
      ctx.fillText(ln, ax, y);
      y += lhPx;
    }
  }

  // ── Resolve text ─────────────────────────────
  function _resolveText(el, fd) {
    if (el.bindField === 'custom') return { text: el.customText || '', isPlaceholder: false };
    if (!fd) return { text: '', isPlaceholder: false };

    const value = fd[el.bindField] || '';

    if (el.bindField === 'date') {
      if (value) return { text: _fmtDate(value), isPlaceholder: false };
      const label = _fieldLabel(el.bindField);
      return { text: label, isPlaceholder: true };
    }

    if (value) return { text: value, isPlaceholder: false };

    const label = _fieldLabel(el.bindField);
    return { text: label, isPlaceholder: true };
  }

  function _fieldLabel(fieldId) {
    if (typeof FieldManager !== 'undefined') {
      const f = FieldManager.getById(fieldId);
      if (f) return f.label;
    }
    const map = { unit:'單位／科別', name:'護理師姓名', title:'職稱', deed:'優良事蹟', date:'表揚日期' };
    return map[fieldId] || fieldId;
  }

  function _fmtDate(v) {
    const d = new Date(v);
    if (isNaN(d)) return v;
    return `${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日`;
  }

  // ── Rounded rect path ────────────────────────
  function _pathRR(ctx, x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  // ── Export ───────────────────────────────────
  function exportPNG(filename) {
    const a = document.createElement('a');
    a.download = filename || 'nurse-award.png';
    a.href = canvasEl.toDataURL('image/png', 1.0);
    a.click();
  }

  function getBlob(cb) { canvasEl.toBlob(cb, 'image/png', 1.0); }

  function fitToContainer(el) {
    if (!el) return;
    const s = Math.min((el.clientWidth-48)/W, (el.clientHeight-48)/H);
    canvasEl.style.width  = Math.floor(W*s) + 'px';
    canvasEl.style.height = Math.floor(H*s) + 'px';
  }

  return { render, setUserPhoto, clearUserPhoto, setBgImage, loadBgFromUrl, exportPNG, getBlob, fitToContainer, W, H };
}

// ── Global singleton for main preview canvas ─────────
const CanvasEngine = (() => {
  let _inst = null;
  const api = {
    init(canvasEl) { _inst = createCanvasInstance(canvasEl); return _inst; },
    get W() { return 1280; },
    get H() { return 720;  }
  };
  ['render','setUserPhoto','clearUserPhoto','setBgImage','loadBgFromUrl','exportPNG','getBlob','fitToContainer']
    .forEach(fn => { api[fn] = (...a) => _inst?.[fn](...a); });
  return api;
})();

// ── Thumbnail helper (isolated, no shared state) ─────
// Supports async background image loading for Drive-backed templates
async function renderTemplateThumbnail(tpl) {
  const mc   = document.createElement('canvas');
  const inst = createCanvasInstance(mc);
  if (tpl.bgImageUrl) {
    await inst.loadBgFromUrl(tpl.bgImageUrl);
  }
  inst.render(tpl, {});
  return mc.toDataURL('image/png');
}
