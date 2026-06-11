import { describe, expect, it } from 'vitest';
import {
  ComponentSchema,
  TextComponentSchema,
  TipTapDocSchema,
  createTextComponent,
} from '../index';

describe('TipTapDocSchema', () => {
  it('accepts an empty doc', () => {
    const result = TipTapDocSchema.safeParse({ type: 'doc', content: [] });
    expect(result.success).toBe(true);
  });

  it('accepts a recursively structured doc', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    };
    expect(TipTapDocSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects a content array containing a primitive (would crash TipTap)', () => {
    const doc = { type: 'doc', content: ['oops', 42] };
    expect(TipTapDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects a node missing the type discriminator', () => {
    expect(TipTapDocSchema.safeParse({ content: [] }).success).toBe(false);
  });
});

describe('TextComponentSchema', () => {
  it('accepts a freshly created text component', () => {
    const component = createTextComponent();
    expect(TextComponentSchema.safeParse(component).success).toBe(true);
  });

  it('rejects a component with the wrong type discriminator', () => {
    const component = { ...createTextComponent(), type: 'image' };
    expect(TextComponentSchema.safeParse(component).success).toBe(false);
  });

  it('accepts the optional align field', () => {
    const component = { ...createTextComponent(), align: 'center' as const };
    expect(TextComponentSchema.safeParse(component).success).toBe(true);
  });
});

describe('ComponentSchema discriminated union', () => {
  it('accepts a text component via the union', () => {
    expect(ComponentSchema.safeParse(createTextComponent()).success).toBe(true);
  });

  it('rejects an unknown type discriminator', () => {
    const unknownComponent = { id: 'x', type: 'image' };
    expect(ComponentSchema.safeParse(unknownComponent).success).toBe(false);
  });
});
