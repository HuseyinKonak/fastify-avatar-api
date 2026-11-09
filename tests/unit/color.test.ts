import { describe, it, expect } from 'vitest';
import { getColorFromName, getGradientFromName, getContrastColor, parseHexColor } from '../../src/utils/color.js';

describe('Color Utilities', () => {
  describe('getColorFromName', () => {
    it('should return a consistent color for the same name', () => {
      const c1 = getColorFromName('John');
      const c2 = getColorFromName('John');
      expect(c1).toBe(c2);
      expect(c1).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should be case-insensitive and trim whitespace', () => {
      expect(getColorFromName('John')).toBe(getColorFromName('  john  '));
    });
  });

  describe('getGradientFromName', () => {
    it('should return a pair of hex colors', () => {
      const [c1, c2] = getGradientFromName('Alice');
      expect(c1).toMatch(/^#[0-9A-F]{6}$/i);
      expect(c2).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('getContrastColor', () => {
    it('should return white for dark colors', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#1a1a2e')).toBe('#ffffff');
    });

    it('should return dark color for light colors', () => {
      expect(getContrastColor('#ffffff')).toBe('#1a1a2e');
      expect(getContrastColor('#fdd835')).toBe('#1a1a2e');
    });
    it('should handle 3-digit hex during contrast calculation', () => {
      expect(getContrastColor('#000')).toBe('#ffffff');
      expect(getContrastColor('fff')).toBe('#1a1a2e');
    });
  });

  describe('parseHexColor', () => {
    it('should parse 6-digit hex', () => {
      expect(parseHexColor('ff0000')).toBe('#ff0000');
      expect(parseHexColor('#ff0000')).toBe('#ff0000');
    });

    it('should parse 3-digit hex', () => {
      expect(parseHexColor('f00')).toBe('#ff0000');
      expect(parseHexColor('#f00')).toBe('#ff0000');
    });

    it('should return null for invalid hex', () => {
      expect(parseHexColor('invalid')).toBeNull();
      expect(parseHexColor('1234')).toBeNull();
      expect(parseHexColor(null as any)).toBeNull();
      expect(parseHexColor(undefined)).toBeNull();
    });
  });
});

