import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and joins words with hyphens', () => {
    expect(slugify('My Resume')).toBe('my-resume');
  });

  it('collapses non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('Hello,  WORLD!!!  ok')).toBe('hello-world-ok');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Brûlé')).toBe('cafe-brule');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -- foo --  ')).toBe('foo');
  });

  it('caps at 40 characters (the server-side regex limit)', () => {
    const input = 'a'.repeat(60);
    expect(slugify(input)).toHaveLength(40);
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});
