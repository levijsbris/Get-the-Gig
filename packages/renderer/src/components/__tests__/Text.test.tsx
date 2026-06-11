import { render } from '@testing-library/react';
import { defaultTheme, type TextComponent } from '@portfoliopro/snapshot-schema';
import { describe, expect, it } from 'vitest';
import { Text } from '../Text';
import { ThemeProvider } from '../../theme/ThemeProvider';

function wrap(node: React.ReactNode) {
  return <ThemeProvider theme={defaultTheme}>{node}</ThemeProvider>;
}

function buildComponent(doc: TextComponent['doc'], align?: TextComponent['align']): TextComponent {
  return { id: 't1', type: 'text', doc, align };
}

describe('Text renderer', () => {
  it('renders a body paragraph with the body type style applied', () => {
    const comp = buildComponent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { typeStyle: 'body' },
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    });
    const { container, getByText } = render(wrap(<Text component={comp} />));
    expect(getByText('Hello world')).toBeTruthy();
    const p = container.querySelector('p')!;
    expect(p.style.fontSize).toBe(`${defaultTheme.typeStyles!.body.fontSize}px`);
    expect(p.style.fontWeight).toBe(String(defaultTheme.typeStyles!.body.fontWeight));
  });

  it('renders an h1 paragraph with the h1 type style applied', () => {
    const comp = buildComponent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { typeStyle: 'h1' },
          content: [{ type: 'text', text: 'Headline' }],
        },
      ],
    });
    const { container } = render(wrap(<Text component={comp} />));
    const p = container.querySelector('p')!;
    expect(p.style.fontSize).toBe(`${defaultTheme.typeStyles!.h1.fontSize}px`);
    expect(p.style.fontWeight).toBe(String(defaultTheme.typeStyles!.h1.fontWeight));
  });

  it('renders inline marks: bold, italic, link', () => {
    const comp = buildComponent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'plain ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' ' },
            {
              type: 'text',
              text: 'linked',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
      ],
    });
    const { container, getByText } = render(wrap(<Text component={comp} />));
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    const link = container.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.textContent).toBe('linked');
    expect(getByText('plain')).toBeTruthy();
  });

  it('honors the align field on the wrapping div', () => {
    const comp = buildComponent({ type: 'doc', content: [] }, 'center');
    const { container } = render(wrap(<Text component={comp} />));
    expect((container.firstChild as HTMLElement).style.textAlign).toBe('center');
  });

  it('renders an unknown type style as body (forward-compatibility)', () => {
    const comp = buildComponent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { typeStyle: 'futureStyle' },
          content: [{ type: 'text', text: 'still readable' }],
        },
      ],
    });
    const { container } = render(wrap(<Text component={comp} />));
    const p = container.querySelector('p')!;
    expect(p.style.fontSize).toBe(`${defaultTheme.typeStyles!.body.fontSize}px`);
  });
});
