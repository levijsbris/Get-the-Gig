import { render } from '@testing-library/react';
import {
  defaultTheme,
  type ButtonComponent,
  type NavTarget,
} from '@portfoliopro/snapshot-schema';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button';
import { ThemeProvider } from '../../theme/ThemeProvider';

function wrap(component: ButtonComponent) {
  return (
    <ThemeProvider theme={defaultTheme}>
      <Button component={component} />
    </ThemeProvider>
  );
}

function make(overrides: Partial<ButtonComponent> = {}): ButtonComponent {
  return {
    id: 'b1',
    type: 'button',
    label: 'Click me',
    variant: 'primary',
    alignment: 'left',
    ...overrides,
  };
}

describe('Button renderer', () => {
  it('renders a <button> when no link is set', () => {
    const { container } = render(wrap(make()));
    expect(container.querySelector('button')?.textContent).toBe('Click me');
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders an <a> when link is set, with appropriate href', () => {
    const link: NavTarget = { kind: 'url', href: 'https://example.com', openInNewTab: true };
    const { container } = render(wrap(make({ link })));
    const a = container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.com');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders mailto links with the mailto: scheme', () => {
    const link: NavTarget = { kind: 'mailto', email: 'hi@example.com' };
    const { container } = render(wrap(make({ link })));
    expect(container.querySelector('a')?.getAttribute('href')).toBe('mailto:hi@example.com');
  });

  it('applies primary, secondary, and ghost variant styles distinctly', () => {
    const primary = render(wrap(make({ variant: 'primary' }))).container.querySelector('button')!;
    const secondary = render(wrap(make({ variant: 'secondary' }))).container.querySelector('button')!;
    const ghost = render(wrap(make({ variant: 'ghost' }))).container.querySelector('button')!;

    expect(primary.style.background).toBe('rgb(15, 23, 42)'); // theme.colors.primary
    expect(secondary.style.background).toBe('transparent');
    expect(secondary.style.border).toContain('1px solid');
    expect(ghost.style.background).toBe('transparent');
    expect(ghost.style.border).toBe('');
  });

  it('aligns via flexbox justify-content', () => {
    const left = render(wrap(make({ alignment: 'left' }))).container.firstChild as HTMLElement;
    const center = render(wrap(make({ alignment: 'center' }))).container.firstChild as HTMLElement;
    const right = render(wrap(make({ alignment: 'right' }))).container.firstChild as HTMLElement;
    expect(left.style.justifyContent).toBe('flex-start');
    expect(center.style.justifyContent).toBe('center');
    expect(right.style.justifyContent).toBe('flex-end');
  });
});
