import { describe, expect, it } from 'vitest';
import { emptyHomePage, emptySnapshot, SCHEMA_VERSION, SnapshotSchema } from '../index';

describe('emptySnapshot', () => {
  it('parses through the Zod schema', () => {
    const snapshot = emptySnapshot();
    const result = SnapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(true);
  });

  it('uses the current SCHEMA_VERSION', () => {
    expect(emptySnapshot().version).toBe(SCHEMA_VERSION);
  });

  it('contains exactly one home page with no sections', () => {
    const snapshot = emptySnapshot();
    expect(snapshot.pages).toHaveLength(1);
    expect(snapshot.pages[0]!.slug).toBe('home');
    expect(snapshot.pages[0]!.sections).toEqual([]);
  });

  it('generates a fresh ULID for the home page each call', () => {
    const a = emptySnapshot();
    const b = emptySnapshot();
    expect(a.pages[0]!.id).not.toBe(b.pages[0]!.id);
    expect(a.pages[0]!.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('has null global header/footer', () => {
    const snapshot = emptySnapshot();
    expect(snapshot.globalSections.header).toBeNull();
    expect(snapshot.globalSections.footer).toBeNull();
  });
});

describe('emptyHomePage', () => {
  it('produces a valid Page', () => {
    const page = emptyHomePage();
    expect(page.slug).toBe('home');
    expect(page.title).toBe('Home');
    expect(page.sections).toEqual([]);
    expect(page.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
