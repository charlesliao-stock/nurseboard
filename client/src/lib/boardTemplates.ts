/**
 * Board template definitions with unique colors, styles, and decorative elements
 * Each template features a distinct pink/floral theme with healthcare symbols
 */

export interface BoardTemplate {
  id: number;
  name: string;
  primaryColor: string; // Main background color
  accentColor: string; // Secondary accent color
  textColor: string; // Main text color
  decorElements: string[]; // Types of decorative elements: 'heart', 'cross', 'bubble', 'flower', 'leaf'
  bgPattern?: string; // Optional pattern style
  borderStyle?: string; // Border decoration style
}

export const BOARD_TEMPLATES: Record<number, BoardTemplate> = {
  1: {
    id: 1,
    name: "粉紅心語",
    primaryColor: "#FFB6D9", // Bright pink
    accentColor: "#FF69B4", // Hot pink
    textColor: "#2C3E50",
    decorElements: ["heart", "bubble"],
    bgPattern: "dots",
    borderStyle: "rounded",
  },
  2: {
    id: 2,
    name: "淡粉醫療",
    primaryColor: "#FFE4F0", // Light pink
    accentColor: "#FFB3D9", // Medium pink
    textColor: "#1A4D6D",
    decorElements: ["cross", "flower"],
    bgPattern: "none",
    borderStyle: "soft",
  },
  3: {
    id: 3,
    name: "珊瑚溫暖",
    primaryColor: "#FFCCCB", // Light coral
    accentColor: "#FF7F7F", // Coral
    textColor: "#3D2817",
    decorElements: ["heart", "bubble", "leaf"],
    bgPattern: "gradient",
    borderStyle: "wavy",
  },
  4: {
    id: 4,
    name: "玫瑰專業",
    primaryColor: "#FFB6D9", // Rose pink
    accentColor: "#C71585", // Medium violet red
    textColor: "#1C1C1C",
    decorElements: ["cross", "leaf", "bubble"],
    bgPattern: "none",
    borderStyle: "geometric",
  },
  5: {
    id: 5,
    name: "蜜桃活力",
    primaryColor: "#FFDAB9", // Peach puff
    accentColor: "#FFB347", // Peach
    textColor: "#2F4F4F",
    decorElements: ["heart", "cross", "bubble"],
    bgPattern: "wave",
    borderStyle: "curved",
  },
  6: {
    id: 6,
    name: "淺粉星光",
    primaryColor: "#FFF0F5", // Lavender blush
    accentColor: "#FFB6D9", // Light pink
    textColor: "#4A4A4A",
    decorElements: ["heart", "star", "bubble"],
    bgPattern: "dots",
    borderStyle: "soft",
  },
  7: {
    id: 7,
    name: "紫粉典雅",
    primaryColor: "#E6B3FF", // Light purple pink
    accentColor: "#DA70D6", // Orchid
    textColor: "#2D2D2D",
    decorElements: ["cross", "bubble", "flower"],
    bgPattern: "gradient",
    borderStyle: "rounded",
  },
  8: {
    id: 8,
    name: "橙粉溫馨",
    primaryColor: "#FFDAB9", // Peach pink
    accentColor: "#FF8C69", // Salmon
    textColor: "#3D3D3D",
    decorElements: ["heart", "flower", "leaf"],
    bgPattern: "none",
    borderStyle: "organic",
  },
  9: {
    id: 9,
    name: "莓粉精緻",
    primaryColor: "#FFB6D9", // Berry pink
    accentColor: "#DB7093", // Pale violet red
    textColor: "#1A1A1A",
    decorElements: ["cross", "leaf", "bubble"],
    bgPattern: "subtle",
    borderStyle: "elegant",
  },
  10: {
    id: 10,
    name: "奶油豐富",
    primaryColor: "#FFEFD5", // Papaya whip
    accentColor: "#FFD4A3", // Cream
    textColor: "#3E2723",
    decorElements: ["heart", "cross", "bubble", "flower", "leaf"],
    bgPattern: "mixed",
    borderStyle: "decorative",
  },
};

export function getTemplate(templateId: number): BoardTemplate {
  return BOARD_TEMPLATES[templateId] || BOARD_TEMPLATES[1];
}

export function getAllTemplates(): BoardTemplate[] {
  return Object.values(BOARD_TEMPLATES).sort((a, b) => a.id - b.id);
}
