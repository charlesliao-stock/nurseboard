/**
 * canvas.js
 * Canvas 合成引擎 — 負責將模板 + 使用者資料渲染成圖像
 * 輸出尺寸：1280 × 720 px (16:9)
 */

const CanvasEngine = (() => {
  const W = 1280, H = 720;

  let _canvas = null;
  let _ctx    = null;
  let _userPhoto = null;   // HTMLImageElement or null
  let _bgImage   = null;   // background image if any

  // ── Init ───────────────────────────────────────
  function init(canvasEl) {
    _canvas = canvasEl;
    _canvas.width  = W;
    _canvas.height = H;
    _ctx = _canvas.getContext('2d');
  }

  // ── Set user photo ─────────────────────────────
  function setUserPhoto(img) { _userPhoto = img; }
  function clearUserPhoto()  { _userPhoto = null; }

  function setBgImage(img) { _bgImage = img; }

  // ── Main render ────────────────────────────────
  function render(template, formData) {
    if (!_ctx || !template) return;
    const ctx = _ctx;
    ctx.clearRect(0, 0, W, H);

    // 1. Background
    _drawBackground(ctx, template);

    // 2. Decorations (behind content)
    if (template.decorations) {
      template.decorations.forEach(d => _drawDecoration(ctx, d));
    }

    // 3. Photo frame
    if (template.photoFrame) {
      _drawPhotoFrame(ctx, template.photoFrame);
    }

    // 4. Text elements
    if (template.elements) {
      template.elements.forEach(el => {
        const text = _resolveText(el, formData);
        _drawTextElement(ctx, el, text);
      });
    }

    return _canvas;
  }

  // ── Background ────────────────────────────────
  function _drawBackground(ctx, tpl) {
    // Solid color
    ctx.fillStyle = tpl.background || '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Optional background image
    if (_bgImage) {
      ctx.drawImage(_bgImage, 0, 0, W, H);
    }

    // Pattern overlay
    if (tpl.bgPattern === 'grid') {
      _drawGridPattern(ctx, tpl.bgPatternColor || 'rgba(0,0,0,.05)');
    } else if (tpl.bgPattern === 'dots') {
      _drawDotPattern(ctx, tpl.bgPatternColor || 'rgba(0,0,0,.05)');
    }
  }

  function _drawGridPattern(ctx, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    const gap = 40;
    for (let x = 0; x <= W; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function _drawDotPattern(ctx, color) {
    ctx.save();
    ctx.fillStyle = color;
    const gap = 30;
    for (let x = 0; x <= W; x += gap) {
      for (let y = 0; y <= H; y += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── Decorations ───────────────────────────────
  function _drawDecoration(ctx, d) {
    ctx.save();
    if (d.type === 'rect') {
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x, d.y, d.width, d.height);
    } else if (d.type === 'circle') {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.type === 'text_deco') {
      ctx.font = `700 ${d.fontSize}px 'Noto Serif TC', serif`;
      ctx.fillStyle = d.color;
      ctx.textAlign = 'left';
      ctx.fillText(d.text, d.x, d.y);
    }
    ctx.restore();
  }

  // ── Photo Frame ───────────────────────────────
  function _drawPhotoFrame(ctx, frame) {
    const { x, y, width: fw, height: fh, shape, borderColor, borderWidth, shadow, glowColor } = frame;

    ctx.save();

    // Glow effect (vivid template)
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 40;
    }

    // Shadow
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,.20)';
      ctx.shadowBlur  = 24;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 8;
    }

    // Clip region
    ctx.beginPath();
    if (shape === 'circle') {
      const cx = x + fw / 2, cy = y + fh / 2, r = Math.min(fw, fh) / 2;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
      _roundRect(ctx, x, y, fw, fh, 20);
    } else {
      ctx.rect(x, y, fw, fh);
    }
    ctx.clip();

    // Draw photo or placeholder
    if (_userPhoto) {
      const imgW = _userPhoto.naturalWidth || _userPhoto.width;
      const imgH = _userPhoto.naturalHeight || _userPhoto.height;
      const scale = Math.max(fw / imgW, fh / imgH);
      const dw = imgW * scale, dh = imgH * scale;
      const dx = x + (fw - dw) / 2, dy = y + (fh - dh) / 2;
      ctx.drawImage(_userPhoto, dx, dy, dw, dh);
    } else {
      // Placeholder
      ctx.fillStyle = 'rgba(42,143,166,.12)';
      ctx.fillRect(x, y, fw, fh);
      ctx.restore(); ctx.save();
      ctx.font = `300 ${Math.floor(fw * 0.12)}px 'Noto Sans TC', sans-serif`;
      ctx.fillStyle = 'rgba(42,143,166,.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('相片', x + fw / 2, y + fh / 2);
    }

    ctx.restore();

    // Border (drawn after clip is released)
    if (borderColor && borderColor !== 'transparent' && borderWidth > 0) {
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.beginPath();
      if (shape === 'circle') {
        const cx = x + fw / 2, cy = y + fh / 2, r = Math.min(fw, fh) / 2 - borderWidth / 2;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      } else if (shape === 'rounded') {
        _roundRect(ctx, x + borderWidth / 2, y + borderWidth / 2,
          fw - borderWidth, fh - borderWidth, 18);
      } else {
        ctx.rect(x, y, fw, fh);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Text Element ──────────────────────────────
  function _drawTextElement(ctx, el, text) {
    if (!text && !el.bgColor) return;
    ctx.save();

    // Background fill (e.g. top bar)
    if (el.bgColor) {
      ctx.fillStyle = el.bgColor;
      ctx.fillRect(el.x, el.y, el.width, el.height);
    }

    if (!text) { ctx.restore(); return; }

    // Font setup
    const fontFamily = el.serif
      ? "'Noto Serif TC', serif"
      : "'Noto Sans TC', sans-serif";
    ctx.font = `${el.fontWeight || 400} ${el.fontSize || 16}px ${fontFamily}`;
    ctx.fillStyle = el.color || '#1a2126';
    ctx.textBaseline = 'top';

    const align = el.align || 'left';
    let anchorX = el.x;
    if (align === 'center') { ctx.textAlign = 'center'; anchorX = el.x + el.width / 2; }
    else if (align === 'right') { ctx.textAlign = 'right'; anchorX = el.x + el.width; }
    else { ctx.textAlign = 'left'; anchorX = el.x; }

    if (el.wrap) {
      _drawWrappedText(ctx, text, anchorX, el.x, el.y, el.width, el.height,
        el.fontSize, el.lineHeight || 1.6, align);
    } else {
      // Vertically center in element height
      const offsetY = (el.height - el.fontSize) / 2;
      ctx.fillText(text, anchorX, el.y + Math.max(0, offsetY), el.width);
    }

    ctx.restore();
  }

  function _drawWrappedText(ctx, text, anchorX, baseX, baseY, maxW, maxH, fontSize, lineH, align) {
    const lines = [];
    const paragraphs = text.split('\n');
    paragraphs.forEach(para => {
      const words = para.split('');  // char-by-char for Chinese text
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const test = line + words[i];
        if (ctx.measureText(test).width > maxW && line.length > 0) {
          lines.push(line);
          line = words[i];
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      if (para === '' && paragraphs.length > 1) lines.push('');
    });

    const lineHeightPx = fontSize * lineH;
    let y = baseY;
    for (const ln of lines) {
      if (y + lineHeightPx > baseY + maxH + lineHeightPx) break;
      ctx.fillText(ln, anchorX, y);
      y += lineHeightPx;
    }
  }

  // ── Resolve text from formData ─────────────────
  function _resolveText(el, formData) {
    if (el.bindField === 'custom') return el.customText || '';
    if (!formData) return '';
    const map = {
      unit:  formData.unit  || '',
      name:  formData.name  || '',
      title: formData.title || '',
      deed:  formData.deed  || '',
      date:  formData.date  ? _formatDate(formData.date) : ''
    };
    return map[el.bindField] || '';
  }

  function _formatDate(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d)) return val;
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }

  // ── Utility: rounded rect path ────────────────
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Export PNG ────────────────────────────────
  function exportPNG(filename) {
    if (!_canvas) return;
    const link = document.createElement('a');
    link.download = filename || 'nurse-award.png';
    link.href = _canvas.toDataURL('image/png', 1.0);
    link.click();
  }

  // ── Get blob for upload ───────────────────────
  function getBlob(cb) {
    if (!_canvas) return;
    _canvas.toBlob(cb, 'image/png', 1.0);
  }

  // ── Scale canvas display to fit container ─────
  function fitToContainer(containerEl) {
    if (!_canvas || !containerEl) return;
    const containerW = containerEl.clientWidth  - 48;
    const containerH = containerEl.clientHeight - 48;
    const scale = Math.min(containerW / W, containerH / H);
    _canvas.style.width  = Math.floor(W * scale) + 'px';
    _canvas.style.height = Math.floor(H * scale) + 'px';
  }

  return { init, render, setUserPhoto, clearUserPhoto, setBgImage,
           exportPNG, getBlob, fitToContainer, W, H };
})();
