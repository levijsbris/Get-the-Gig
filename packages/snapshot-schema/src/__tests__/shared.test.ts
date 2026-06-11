import { describe, expect, it } from 'vitest';
import {
  HexColorSchema,
  NavTargetSchema,
  TokenRefOrColorSchema,
  TokenRefOrNumberSchema,
  TokenRefSchema,
} from '../shared';

describe('HexColorSchema', () => {
  it('accepts 3/4/6/8 digit forms', () => {
    for (const ok of ['#fff', '#ffff', '#ffffff', '#ffffffff', '#0a0b0c']) {
      expect(HexColorSchema.safeParse(ok).success).toBe(true);
    }
  });

  it('rejects missing #, wrong digit counts, and non-hex chars', () => {
    for (const bad of ['fff', '#ff', '#fffff', '#fffffg', 'red']) {
      expect(HexColorSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('TokenRefSchema', () => {
  it('accepts dotted theme paths', () => {
    expect(TokenRefSchema.safeParse({ kind: 'token', path: 'colors.primary' }).success).toBe(true);
    expect(TokenRefSchema.safeParse({ kind: 'token', path: 'spacing.md' }).success).toBe(true);
  });

  it('rejects single-segment paths (must traverse the theme)', () => {
    expect(TokenRefSchema.safeParse({ kind: 'token', path: 'primary' }).success).toBe(false);
  });

  it('rejects paths with leading digits or hyphens', () => {
    expect(TokenRefSchema.safeParse({ kind: 'token', path: '1.bad' }).success).toBe(false);
    expect(TokenRefSchema.safeParse({ kind: 'token', path: 'foo-bar.baz' }).success).toBe(false);
  });

  it('rejects wrong kind discriminator', () => {
    expect(TokenRefSchema.safeParse({ kind: 'literal', path: 'colors.primary' }).success).toBe(
      false,
    );
  });
});

describe('Token unions', () => {
  it('TokenRefOrColor accepts either form', () => {
    expect(
      TokenRefOrColorSchema.safeParse({ kind: 'token', path: 'colors.primary' }).success,
    ).toBe(true);
    expect(TokenRefOrColorSchema.safeParse('#fff').success).toBe(true);
    expect(TokenRefOrColorSchema.safeParse(42).success).toBe(false);
  });

  it('TokenRefOrNumber accepts either form and rejects negatives', () => {
    expect(
      TokenRefOrNumberSchema.safeParse({ kind: 'token', path: 'spacing.md' }).success,
    ).toBe(true);
    expect(TokenRefOrNumberSchema.safeParse(8).success).toBe(true);
    expect(TokenRefOrNumberSchema.safeParse(0).success).toBe(true);
    expect(TokenRefOrNumberSchema.safeParse(-1).success).toBe(false);
  });
});

describe('NavTargetSchema', () => {
  it('accepts a page target', () => {
    expect(NavTargetSchema.safeParse({ kind: 'page', pageId: 'abc' }).success).toBe(true);
  });

  it('accepts a section target with both ids', () => {
    expect(
      NavTargetSchema.safeParse({ kind: 'section', pageId: 'a', sectionId: 'b' }).success,
    ).toBe(true);
  });

  it('accepts a url target and defaults openInNewTab to false', () => {
    const result = NavTargetSchema.safeParse({
      kind: 'url',
      href: 'https://example.com',
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === 'url') {
      expect(result.data.openInNewTab).toBe(false);
    }
  });

  it('rejects non-URL hrefs for kind=url', () => {
    expect(NavTargetSchema.safeParse({ kind: 'url', href: 'not a url' }).success).toBe(false);
  });

  it('accepts a mailto target with valid email', () => {
    expect(NavTargetSchema.safeParse({ kind: 'mailto', email: 'a@b.co' }).success).toBe(true);
  });

  it('rejects malformed emails for kind=mailto', () => {
    expect(NavTargetSchema.safeParse({ kind: 'mailto', email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('rejects unknown kinds', () => {
    expect(NavTargetSchema.safeParse({ kind: 'tel', number: '+1234' }).success).toBe(false);
  });

  it('rejects section target missing sectionId', () => {
    expect(NavTargetSchema.safeParse({ kind: 'section', pageId: 'a' }).success).toBe(false);
  });
});
