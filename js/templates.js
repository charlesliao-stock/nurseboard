/**
 * templates.js
 * 模板定義與載入器
 * 管理所有模板的 JSON 資料，支援本地預設模板及後台自訂模板
 */

const TemplateManager = (() => {

  // ── 預設 5 套模板定義 ──────────────────────────
  // 畫布尺寸以 1280×720 為基準 (16:9)

  const DEFAULT_TEMPLATES = [
    {
      id: 'tpl_01',
      name: '經典藍',
      style: 'formal',
      background: '#EBF4F8',
      bgPattern: 'grid',       // grid | dots | none
      bgPatternColor: 'rgba(42,143,166,.06)',
      elements: [
        {
          id: 'el_unit', type: 'text', bindField: 'unit',
          x: 72, y: 96, width: 480, height: 36,
          fontSize: 20, fontWeight: '500',
          color: '#1a5c6b', align: 'left',
          prefix: '', suffix: ''
        },
        {
          id: 'el_badge', type: 'text', bindField: 'custom',
          customText: '✦ 優良護理師表揚',
          x: 72, y: 148, width: 280, height: 32,
          fontSize: 13, fontWeight: '400',
          color: '#c8973a', align: 'left'
        },
        {
          id: 'el_name', type: 'text', bindField: 'name',
          x: 72, y: 192, width: 560, height: 88,
          fontSize: 64, fontWeight: '700',
          color: '#0d2d35', align: 'left', serif: true
        },
        {
          id: 'el_title', type: 'text', bindField: 'title',
          x: 72, y: 296, width: 360, height: 36,
          fontSize: 18, fontWeight: '400',
          color: '#2a8fa6', align: 'left'
        },
        {
          id: 'el_divider', type: 'text', bindField: 'custom',
          customText: '────────────────────',
          x: 72, y: 344, width: 560, height: 20,
          fontSize: 13, fontWeight: '300',
          color: 'rgba(42,143,166,.35)', align: 'left'
        },
        {
          id: 'el_deed', type: 'text', bindField: 'deed',
          x: 72, y: 376, width: 560, height: 200,
          fontSize: 18, fontWeight: '400',
          color: '#1a2126', align: 'left', wrap: true,
          lineHeight: 1.75
        },
        {
          id: 'el_date', type: 'text', bindField: 'date',
          x: 72, y: 644, width: 300, height: 28,
          fontSize: 14, fontWeight: '300',
          color: '#8a9aa6', align: 'left'
        }
      ],
      photoFrame: {
        id: 'photo_main',
        x: 860, y: 80, width: 320, height: 320,
        shape: 'circle',
        borderColor: '#2a8fa6', borderWidth: 4,
        shadow: true
      },
      decorations: [
        { type: 'rect', x: 0, y: 0, width: 12, height: 720, color: '#1a5c6b' },
        { type: 'rect', x: 12, y: 0, width: 4, height: 720, color: '#c8973a' },
        { type: 'rect', x: 800, y: 460, width: 480, height: 260, color: 'rgba(42,143,166,.06)' }
      ]
    },

    {
      id: 'tpl_02',
      name: '溫暖橙',
      style: 'warm',
      background: '#FDF6EE',
      bgPattern: 'none',
      elements: [
        {
          id: 'el_top_bar', type: 'text', bindField: 'custom',
          customText: '優良護理師  NURSE EXCELLENCE AWARD',
          x: 0, y: 0, width: 1280, height: 52,
          fontSize: 14, fontWeight: '500',
          color: '#ffffff', align: 'center',
          bgColor: '#c0632b'
        },
        {
          id: 'el_unit', type: 'text', bindField: 'unit',
          x: 80, y: 80, width: 600, height: 36,
          fontSize: 18, fontWeight: '500',
          color: '#7a3a18', align: 'left'
        },
        {
          id: 'el_name', type: 'text', bindField: 'name',
          x: 80, y: 128, width: 600, height: 96,
          fontSize: 72, fontWeight: '700',
          color: '#3d1a08', align: 'left', serif: true
        },
        {
          id: 'el_title', type: 'text', bindField: 'title',
          x: 80, y: 240, width: 400, height: 34,
          fontSize: 17, fontWeight: '400',
          color: '#c0632b', align: 'left'
        },
        {
          id: 'el_deed', type: 'text', bindField: 'deed',
          x: 80, y: 296, width: 600, height: 220,
          fontSize: 17, fontWeight: '400',
          color: '#3d1a08', align: 'left', wrap: true,
          lineHeight: 1.8
        },
        {
          id: 'el_date', type: 'text', bindField: 'date',
          x: 80, y: 640, width: 300, height: 28,
          fontSize: 14, fontWeight: '300',
          color: '#b08060', align: 'left'
        }
      ],
      photoFrame: {
        id: 'photo_main',
        x: 840, y: 80, width: 340, height: 400,
        shape: 'rounded',
        borderColor: '#c0632b', borderWidth: 3,
        shadow: true
      },
      decorations: [
        { type: 'circle', cx: 1180, cy: 580, r: 180, color: 'rgba(192,99,43,.07)' },
        { type: 'circle', cx: 1100, cy: 660, r: 100, color: 'rgba(200,151,58,.1)' },
        { type: 'rect', x: 0, y: 680, width: 1280, height: 40, color: '#c0632b' }
      ]
    },

    {
      id: 'tpl_03',
      name: '日系綠',
      style: 'japanese',
      background: '#F2F5F0',
      bgPattern: 'dots',
      bgPatternColor: 'rgba(60,100,70,.07)',
      elements: [
        {
          id: 'el_jp_label', type: 'text', bindField: 'custom',
          customText: '優秀看護師表彰',
          x: 900, y: 80, width: 300, height: 36,
          fontSize: 16, fontWeight: '400',
          color: '#4a7055', align: 'right', serif: true
        },
        {
          id: 'el_unit', type: 'text', bindField: 'unit',
          x: 80, y: 120, width: 480, height: 34,
          fontSize: 17, fontWeight: '500',
          color: '#3a5a42', align: 'left'
        },
        {
          id: 'el_name', type: 'text', bindField: 'name',
          x: 80, y: 168, width: 560, height: 96,
          fontSize: 68, fontWeight: '700',
          color: '#1a2d1e', align: 'left', serif: true
        },
        {
          id: 'el_title', type: 'text', bindField: 'title',
          x: 80, y: 280, width: 380, height: 32,
          fontSize: 17, fontWeight: '300',
          color: '#4a7055', align: 'left'
        },
        {
          id: 'el_deed', type: 'text', bindField: 'deed',
          x: 80, y: 332, width: 580, height: 220,
          fontSize: 17, fontWeight: '400',
          color: '#2a3d2e', align: 'left', wrap: true,
          lineHeight: 1.85
        },
        {
          id: 'el_date', type: 'text', bindField: 'date',
          x: 80, y: 636, width: 300, height: 28,
          fontSize: 14, fontWeight: '300',
          color: '#7a9a80', align: 'left'
        }
      ],
      photoFrame: {
        id: 'photo_main',
        x: 844, y: 160, width: 300, height: 300,
        shape: 'rect',
        borderColor: '#4a7055', borderWidth: 2,
        shadow: false
      },
      decorations: [
        { type: 'rect', x: 0, y: 0, width: 6, height: 720, color: '#3a5a42' },
        { type: 'rect', x: 760, y: 0, width: 1, height: 720, color: 'rgba(60,100,70,.15)' },
        { type: 'text_deco', text: '看護', x: 1100, y: 500, fontSize: 120, color: 'rgba(60,100,70,.04)' }
      ]
    },

    {
      id: 'tpl_04',
      name: '簡約灰',
      style: 'minimal',
      background: '#F8F8F6',
      bgPattern: 'none',
      elements: [
        {
          id: 'el_eyebrow', type: 'text', bindField: 'custom',
          customText: 'NURSE EXCELLENCE',
          x: 80, y: 100, width: 400, height: 24,
          fontSize: 11, fontWeight: '600',
          color: '#8a9aa6', align: 'left',
          letterSpacing: '0.2em'
        },
        {
          id: 'el_name', type: 'text', bindField: 'name',
          x: 76, y: 132, width: 640, height: 108,
          fontSize: 80, fontWeight: '700',
          color: '#1a2126', align: 'left', serif: false
        },
        {
          id: 'el_title', type: 'text', bindField: 'title',
          x: 80, y: 256, width: 360, height: 32,
          fontSize: 16, fontWeight: '300',
          color: '#4a5560', align: 'left'
        },
        {
          id: 'el_unit', type: 'text', bindField: 'unit',
          x: 80, y: 292, width: 360, height: 30,
          fontSize: 16, fontWeight: '400',
          color: '#4a5560', align: 'left'
        },
        {
          id: 'el_line', type: 'text', bindField: 'custom',
          customText: '—',
          x: 80, y: 340, width: 40, height: 20,
          fontSize: 20, fontWeight: '300',
          color: '#c8973a', align: 'left'
        },
        {
          id: 'el_deed', type: 'text', bindField: 'deed',
          x: 80, y: 372, width: 620, height: 220,
          fontSize: 16, fontWeight: '400',
          color: '#2a3540', align: 'left', wrap: true,
          lineHeight: 1.9
        },
        {
          id: 'el_date', type: 'text', bindField: 'date',
          x: 80, y: 648, width: 300, height: 28,
          fontSize: 13, fontWeight: '300',
          color: '#8a9aa6', align: 'left'
        }
      ],
      photoFrame: {
        id: 'photo_main',
        x: 880, y: 80, width: 320, height: 560,
        shape: 'rounded',
        borderColor: 'transparent', borderWidth: 0,
        shadow: true
      },
      decorations: [
        { type: 'rect', x: 0, y: 0, width: 1280, height: 4, color: '#1a2126' },
        { type: 'rect', x: 0, y: 716, width: 1280, height: 4, color: '#1a2126' }
      ]
    },

    {
      id: 'tpl_05',
      name: '活力紫',
      style: 'vivid',
      background: '#1a1a2e',
      bgPattern: 'none',
      elements: [
        {
          id: 'el_badge', type: 'text', bindField: 'custom',
          customText: '★ EXCELLENCE AWARD ★',
          x: 72, y: 88, width: 360, height: 30,
          fontSize: 12, fontWeight: '600',
          color: '#c8973a', align: 'left',
          letterSpacing: '0.14em'
        },
        {
          id: 'el_unit', type: 'text', bindField: 'unit',
          x: 72, y: 132, width: 520, height: 34,
          fontSize: 18, fontWeight: '400',
          color: 'rgba(255,255,255,.6)', align: 'left'
        },
        {
          id: 'el_name', type: 'text', bindField: 'name',
          x: 68, y: 174, width: 600, height: 104,
          fontSize: 76, fontWeight: '700',
          color: '#ffffff', align: 'left', serif: true
        },
        {
          id: 'el_title', type: 'text', bindField: 'title',
          x: 72, y: 296, width: 400, height: 34,
          fontSize: 18, fontWeight: '300',
          color: '#7ec8d8', align: 'left'
        },
        {
          id: 'el_deed', type: 'text', bindField: 'deed',
          x: 72, y: 352, width: 580, height: 220,
          fontSize: 17, fontWeight: '400',
          color: 'rgba(255,255,255,.8)', align: 'left', wrap: true,
          lineHeight: 1.8
        },
        {
          id: 'el_date', type: 'text', bindField: 'date',
          x: 72, y: 644, width: 300, height: 28,
          fontSize: 14, fontWeight: '300',
          color: 'rgba(255,255,255,.35)', align: 'left'
        }
      ],
      photoFrame: {
        id: 'photo_main',
        x: 848, y: 60, width: 340, height: 340,
        shape: 'circle',
        borderColor: '#c8973a', borderWidth: 4,
        shadow: false,
        glowColor: 'rgba(200,151,58,.3)'
      },
      decorations: [
        { type: 'circle', cx: 1000, cy: 230, r: 260, color: 'rgba(42,143,166,.08)' },
        { type: 'circle', cx: 1200, cy: 600, r: 200, color: 'rgba(200,151,58,.06)' },
        { type: 'rect', x: 0, y: 0, width: 8, height: 720, color: '#c8973a' },
        { type: 'rect', x: 820, y: 440, width: 460, height: 1, color: 'rgba(200,151,58,.25)' }
      ]
    }
  ];

  // ── Storage Key ────────────────────────────────
  const STORAGE_KEY = 'nurse_templates';
  const ENABLED_KEY = 'nurse_template_enabled';

  // ── Load templates (localStorage overrides defaults) ──
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) return saved;
      }
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)); // deep clone
  }

  // ── Save templates to localStorage ────────────
  function save(templates) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }

  // ── Get by id ──────────────────────────────────
  function getById(id) {
    return load().find(t => t.id === id) || null;
  }

  // ── Reset to defaults ──────────────────────────
  function reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Template enabled/disabled ─────────────────
  function getEnabledMap() {
    try {
      const raw = localStorage.getItem(ENABLED_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    // Default: all enabled
    const map = {};
    load().forEach(t => { map[t.id] = true; });
    return map;
  }

  function setEnabled(id, enabled) {
    const map = getEnabledMap();
    map[id] = enabled;
    localStorage.setItem(ENABLED_KEY, JSON.stringify(map));
  }

  function loadEnabled() {
    const all = load();
    const map = getEnabledMap();
    return all.filter(t => map[t.id] !== false);
  }

  return { load, save, getById, reset, DEFAULT_TEMPLATES, getEnabledMap, setEnabled, loadEnabled };
})();

// ── FieldManager ──────────────────────────────────────
const FieldManager = (() => {
  const STORAGE_KEY = 'nurse_fields';

  const DEFAULT_FIELDS = [
    { id: 'unit',  label: '單位／科別',  type: 'text' },
    { id: 'name',  label: '護理師姓名',  type: 'text' },
    { id: 'title', label: '職稱',        type: 'text' },
    { id: 'deed',  label: '優良事蹟',    type: 'textarea' },
    { id: 'date',  label: '表揚日期',    type: 'date' },
  ];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) return saved;
      }
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_FIELDS));
  }

  function save(fields) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  }

  function addField(label, type) {
    const fields = load();
    const id = 'field_' + Date.now();
    fields.push({ id, label, type: type || 'text' });
    save(fields);
    return id;
  }

  function removeField(id) {
    // Prevent removing built-in fields
    const BUILT_IN = ['unit','name','title','deed','date'];
    if (BUILT_IN.includes(id)) return false;
    const fields = load().filter(f => f.id !== id);
    save(fields);
    return true;
  }

  function getById(id) {
    return load().find(f => f.id === id) || null;
  }

  return { load, save, addField, removeField, getById, DEFAULT_FIELDS };
})();
