import { describe, it, expect } from 'vitest';
import { getInitials, escapeXml, getDisplayText, calculateFontSize } from '../../src/utils/text.js';

describe('Text Utilities', () => {
  describe('getInitials', () => {
    it('should extract initials from single name', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('should extract initials from multiple names', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('John Quincey Doe')).toBe('JD');
    });

    it('should handle whitespace', () => {
      expect(getInitials('  John   Doe  ')).toBe('JD');
    });

    it('should return ? for empty input', () => {
      expect(getInitials('')).toBe('?');
      expect(getInitials('   ')).toBe('?');
    });
  });

  describe('escapeXml', () => {
    it('should escape dangerous characters', () => {
      expect(escapeXml('<script>')).toBe('&lt;script&gt;');
      expect(escapeXml('John & Jane')).toBe('John &amp; Jane');
      expect(escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeXml("'single'")).toBe('&apos;single&apos;');
    });
  });

  describe('getDisplayText', () => {
    it('should return initials in short mode', () => {
      expect(getDisplayText('John Doe', 'short')).toBe('JD');
    });

    it('should return full name in long mode', () => {
      expect(getDisplayText('John Doe', 'long')).toBe('John Doe');
    });

    it('should not escape the result anymore (deferred to renderer)', () => {
      expect(getDisplayText('<img src=x>', 'long')).toBe('<img src=x>');
    });
  });

  describe('calculateFontSize', () => {
    it('should return requested font size if provided', () => {
      expect(calculateFontSize('JD', 100, 100, 50)).toBe(50);
    });

    it('should calculate size based on text length', () => {
      const sizeShort = calculateFontSize('JD', 100, 100, undefined);
      const sizeLong = calculateFontSize('Long Name', 100, 100, undefined);
      expect(sizeShort).toBeGreaterThan(sizeLong);
    });
  });
});
