'use strict';

const {
  isValidZone, isValidStall, isValidMode,
  sanitizeItems, sanitizeUserId,
} = require('../src/middleware/validate');

describe('isValidZone()', () => {
  test('accepts all 8 valid zone IDs', () => {
    ['A','B','C','D','E','F','G','H'].forEach(id => expect(isValidZone(id)).toBe(true));
  });
  test('rejects unknown zone', () => expect(isValidZone('Z')).toBe(false));
  test('rejects number', ()  => expect(isValidZone(1)).toBe(false));
  test('rejects empty string', () => expect(isValidZone('')).toBe(false));
  test('rejects null', () => expect(isValidZone(null)).toBe(false));
  test('is case-sensitive (lowercase rejected)', () => expect(isValidZone('a')).toBe(false));
});

describe('isValidStall()', () => {
  test('accepts all 4 stall IDs', () => {
    ['s1','s2','s3','s4'].forEach(id => expect(isValidStall(id)).toBe(true));
  });
  test('rejects unknown stall', () => expect(isValidStall('s99')).toBe(false));
  test('rejects null', () => expect(isValidStall(null)).toBe(false));
});

describe('isValidMode()', () => {
  test('accepts all 4 valid modes', () => {
    ['normal','pre_match','halftime','exit_rush'].forEach(m => expect(isValidMode(m)).toBe(true));
  });
  test('rejects unknown mode', () => expect(isValidMode('full_capacity')).toBe(false));
  test('rejects __proto__', () => expect(isValidMode('__proto__')).toBe(false));
  test('rejects constructor', () => expect(isValidMode('constructor')).toBe(false));
});

describe('sanitizeItems()', () => {
  test('returns cleaned array for valid input', () => {
    expect(sanitizeItems(['1x Burger', '2x Fries'])).toEqual(['1x Burger', '2x Fries']);
  });
  test('strips HTML tags from items', () => {
    const result = sanitizeItems(['<script>alert(1)</script>']);
    expect(result[0]).not.toContain('<');
    expect(result[0]).not.toContain('>');
  });
  test('returns null for empty array', () => expect(sanitizeItems([])).toBeNull());
  test('returns null for non-array', () => expect(sanitizeItems('burger')).toBeNull());
  test('returns null for array > 20 items', () => {
    expect(sanitizeItems(Array(21).fill('item'))).toBeNull();
  });
  test('filters out non-string items', () => {
    const result = sanitizeItems(['valid', 123, null, 'also valid']);
    expect(result).toEqual(['valid', 'also valid']);
  });
  test('filters out empty strings', () => {
    expect(sanitizeItems(['  ', 'real item'])).toEqual(['real item']);
  });
  test('returns null if all items invalid', () => {
    expect(sanitizeItems([123, null, undefined])).toBeNull();
  });
  test('trims whitespace from items', () => {
    expect(sanitizeItems(['  burger  '])).toEqual(['burger']);
  });
});

describe('sanitizeUserId()', () => {
  test('returns clean userId for valid input', () => {
    expect(sanitizeUserId('fan_001')).toBe('fan_001');
  });
  test('strips HTML from userId', () => {
    expect(sanitizeUserId('<script>evil</script>')).not.toContain('<');
  });
  test('returns guest for empty string', () => expect(sanitizeUserId('')).toBe('guest'));
  test('returns guest for null', () => expect(sanitizeUserId(null)).toBe('guest'));
  test('returns guest for userId > 64 chars', () => {
    expect(sanitizeUserId('x'.repeat(65))).toBe('guest');
  });
  test('strips double quotes', () => {
    expect(sanitizeUserId('"admin"')).not.toContain('"');
  });
});
