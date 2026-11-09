import sharp from 'sharp';
import { getDisplayText, escapeXml, calculateFontSize } from '../utils/text.js';
import { getColorFromName, getGradientFromName, getContrastColor, parseHexColor } from '../utils/color.js';
import { AvatarParams } from '../types/avatar.js';

/**
 * Avatar renderer.
 * Renders SVG and converts to desired bitmap format using Sharp
 */
export default async function render(params: AvatarParams): Promise<{ buffer: Buffer; contentType: string }> {
  const {
    name,
    width,
    height,
    mode,
    shape,
    format,
    background: reqBackground,
    color: reqColor,
    fontFamily: reqFontFamily,
    fontSize: requestedFontSize,
    bold,
    gradient,
    rounded,
    uppercase,
  } = params;

  // 1. Prepare Text
  let rawText = getDisplayText(name, mode);
  if (uppercase) rawText = rawText.toUpperCase();
  const displayText = escapeXml(rawText);

  // 2. Resolve Colors
  const bgColor = parseHexColor(reqBackground) || getColorFromName(name);
  const textColor = parseHexColor(reqColor) || getContrastColor(bgColor);

  // 3. Resolve Typography & Hardening
  // Strict sanitization: Allow only alpha-numeric, spaces, and dashes.
  const sanitizedFont = reqFontFamily.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'sans-serif';
  // Enterprise Fallback: Ensure we always have a system font available
  const fontFamily = `${sanitizedFont}, "Liberation Sans", "DejaVu Sans", Arial, sans-serif`;
  
  const fontSize = calculateFontSize(rawText, width, height, requestedFontSize);
  const fontWeight = bold ? 'bold' : '600';

  // 4. Generate SVG Background
  let svgBackground = '';
  if (gradient) {
    const [c1, c2] = getGradientFromName(name);
    const gradStart = parseHexColor(reqBackground) || c1;
    svgBackground = `
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${escapeXml(gradStart)};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${escapeXml(c2)};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
    `;
  } else {
    svgBackground = `<rect width="100%" height="100%" fill="${escapeXml(bgColor)}" />`;
  }

  // 5. Handle Shapes
  let clipPathContent = '';
  const minDim = Math.min(width, height);
  
  if (shape === 'circle') {
    clipPathContent = `<circle cx="${width / 2}" cy="${height / 2}" r="${minDim / 2}" />`;
  } else if (shape === 'rounded' || (shape === 'square' && rounded > 0)) {
    const rx = rounded || (shape === 'rounded' ? minDim * 0.15 : 0);
    clipPathContent = `<rect width="${width}" height="${height}" rx="${rx}" ry="${rx}" />`;
  }

  // 6. Assemble SVG
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${clipPathContent ? `<defs><clipPath id="cp">${clipPathContent}</clipPath></defs>` : ''}
      <g ${clipPathContent ? 'clip-path="url(#cp)"' : ''}>
        ${svgBackground}
        <text 
          x="50%" 
          y="50%" 
          dy=".35em" 
          fill="${escapeXml(textColor)}" 
          font-family="${escapeXml(fontFamily)}, sans-serif" 
          font-size="${fontSize}" 
          font-weight="${fontWeight}" 
          text-anchor="middle"
          dominant-baseline="middle"
        >${displayText}</text>
      </g>
    </svg>
  `;

  if (format === 'svg') {
    return {
      buffer: Buffer.from(svg),
      contentType: 'image/svg+xml',
    };
  }

  // 7. Convert to Bitmap
  const pipeline = sharp(Buffer.from(svg));
  let outputBuffer: Buffer;
  let contentType: string;

  switch (format) {
    case 'webp':
      outputBuffer = await pipeline.webp({ quality: 90, effort: 6 }).toBuffer();
      contentType = 'image/webp';
      break;
    case 'jpeg':
      outputBuffer = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      contentType = 'image/jpeg';
      break;
    case 'png':
    default:
      // PNG Level 6 is the sweet spot for performance vs size. 9 is too slow for dynamic services.
      outputBuffer = await pipeline.png({ compressionLevel: 6, palette: true }).toBuffer();
      contentType = 'image/png';
      break;
  }

  return { buffer: outputBuffer, contentType };
}


