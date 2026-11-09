// FNV-1a extremely fast hash function
export function hashString(str: string): number {
  let hval = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return hval >>> 0;
}

// Convert HSL back to approximate Hex for SVG compatibility
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getColorFromName(name: string): string {
  const hash = hashString(name.toLowerCase().trim());
  
  // Determinisic HSL: 
  // Hue 0-360 mapped by modulo
  // Saturation 40-80% for pleasant colors
  // Lightness: 40-60% for strong backgrounds
  const h = hash % 360;
  const s = 40 + (hash % 40);
  const l = 40 + (hash % 20);
  
  return hslToHex(h, s, l);
}

export function getGradientFromName(name: string): readonly [string, string] {
  const hash = hashString(name.toLowerCase().trim());
  const h = hash % 360;
  const s = 60 + (hash % 40); // slightly more saturated
  
  // Complementary or analogous colors
  const h2 = (h + 40 + (hash % 60)) % 360;
  
  return [hslToHex(h, s, 50), hslToHex(h2, s, 60)];
}

export function getContrastColor(hexColor: string): string {
  const fullHex = parseHexColor(hexColor) || '#000000';
  const hex = fullHex.replace('#', '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // WCAG Relative Luminance formula
  // See: https://www.w3.org/TR/WCAG20/#relativeluminancedef
  const getLR = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  const luminance = 0.2126 * getLR(r) + 0.7152 * getLR(g) + 0.0722 * getLR(b);
  
  // Contrast ratio threshold
  return luminance > 0.179 ? '#1a1a2e' : '#ffffff';
}

const HEX_6 = /^[0-9A-Fa-f]{6}$/;
const HEX_3 = /^[0-9A-Fa-f]{3}$/;

export function parseHexColor(color: string | undefined | null): string | null {
  if (!color || typeof color !== 'string') return null;

  const cleaned = color.replace('#', '').trim();

  if (HEX_6.test(cleaned)) {
    return `#${cleaned}`;
  }
  if (HEX_3.test(cleaned)) {
    const r = cleaned[0];
    const g = cleaned[1];
    const b = cleaned[2];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

