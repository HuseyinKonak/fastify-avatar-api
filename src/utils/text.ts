export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';
  
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const getFirstChar = (str: string) => {
    const segments = Array.from(segmenter.segment(str));
    return segments.length > 0 ? segments[0].segment.toUpperCase() : '';
  };

  if (parts.length === 1) return getFirstChar(parts[0]);

  const first = getFirstChar(parts[0]);
  const last = getFirstChar(parts[parts.length - 1]);
  return first + last || '?';
}

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (m) => {
    switch (m) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return m;
    }
  });
}

export function getDisplayText(name: string, mode: 'short' | 'long' = 'short'): string {
  if (!name || !name.trim()) return '?';

  return mode === 'long' ? name.trim() : getInitials(name);
}

export function calculateFontSize(
  text: string,
  width: number,
  height: number,
  requestedFontSize?: number
): number {
  if (requestedFontSize) return requestedFontSize;

  const minDimension = Math.min(width, height);
  const len = text.length;

  // Constants for consistent mathematical font sizing
  const FONT_WIDTH_FACTOR = 0.6; // Approximated average character width vs height
  const FONT_HEIGHT_RATIO = 0.7; // Target height relative to the minimum dimension
  const MAX_FONT_DIMENSION_RATIO = 0.5; // Do not exceed 50% of the box to maintain padding
  
  const calculatedByWidth = width / (len * FONT_WIDTH_FACTOR);
  const calculatedByHeight = height * FONT_HEIGHT_RATIO;
  
  return Math.round(Math.min(
    calculatedByWidth, 
    calculatedByHeight, 
    minDimension * MAX_FONT_DIMENSION_RATIO
  ));
}
