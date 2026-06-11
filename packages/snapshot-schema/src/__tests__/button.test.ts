import { describe, expect, it } from 'vitest';
import { ButtonComponentSchema, createButtonComponent } from '../index';

describe('ButtonComponent', () => {
  it('createButtonComponent returns a Zod-valid instance', () => {
    const button = createButtonComponent();
    const result = ButtonComponentSchema.safeParse(button);
    expect(result.success).toBe(true);
  });

  it('rejects empty labels and labels longer than 80 chars', () => {
    expect(
      ButtonComponentSchema.safeParse({
        id: 'b1',
        type: 'button',
        label: '',
        variant: 'primary',
        alignment: 'left',
      }).success,
    ).toBe(false);

    expect(
      ButtonComponentSchema.safeParse({
        id: 'b1',
        type: 'button',
        label: 'x'.repeat(81),
        variant: 'primary',
        alignment: 'left',
      }).success,
    ).toBe(false);
  });

  it('rejects unknown variants', () => {
    expect(
      ButtonComponentSchema.safeParse({
        id: 'b1',
        type: 'button',
        label: 'Go',
        variant: 'gradient',
        alignment: 'left',
      }).success,
    ).toBe(false);
  });

  it('accepts a NavTarget link of each kind', () => {
    const base = { id: 'b1', type: 'button', label: 'Go', variant: 'primary', alignment: 'left' };
    for (const link of [
      { kind: 'page', pageId: 'p1' },
      { kind: 'section', pageId: 'p1', sectionId: 's1' },
      { kind: 'url', href: 'https://example.com', openInNewTab: true },
      { kind: 'mailto', email: 'a@b.co' },
    ]) {
      expect(ButtonComponentSchema.safeParse({ ...base, link }).success).toBe(true);
    }
  });
});
