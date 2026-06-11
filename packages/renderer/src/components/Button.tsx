import type { ButtonComponent, NavTarget } from '@portfoliopro/snapshot-schema';
import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { useNavTarget } from '../theme/useNavTarget';

interface ButtonProps {
  component: ButtonComponent;
}

/**
 * Three-variant button rendered as either an <a> (when `link` is set) or a
 * plain <button>. Variant styles resolve from the theme — `primary` is solid
 * accent, `secondary` is outlined, `ghost` is text-only. Phase 6's theme tab
 * will move these to editable presets; for v1 the recipe is fixed here so
 * the renderer is self-contained.
 */
export function Button({ component }: ButtonProps) {
  const theme = useTheme();
  const nav = useNavTarget(component.link);

  const base: CSSProperties = {
    display: 'inline-block',
    fontFamily: theme.fonts.body,
    fontWeight: 500,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.radii.md,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'opacity 80ms ease-out',
    border: 'none',
  };

  const variantStyle: CSSProperties = variantStyles(component.variant, theme);

  const wrapper: CSSProperties = {
    display: 'flex',
    justifyContent: alignToJustify(component.alignment),
  };

  const buttonStyle: CSSProperties = { ...base, ...variantStyle };

  return (
    <div style={wrapper}>
      {component.link ? (
        <a
          href={nav.href}
          target={nav.target}
          rel={nav.rel}
          onClick={nav.onClick}
          style={buttonStyle}
        >
          {component.label}
        </a>
      ) : (
        <button type="button" style={buttonStyle}>
          {component.label}
        </button>
      )}
    </div>
  );
}

function variantStyles(
  variant: ButtonComponent['variant'],
  theme: ReturnType<typeof useTheme>,
): CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: theme.colors.primary,
        color: theme.colors.background,
      };
    case 'secondary':
      return {
        background: 'transparent',
        color: theme.colors.primary,
        border: `1px solid ${theme.colors.primary}`,
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: theme.colors.foreground,
        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
      };
    default:
      return {};
  }
}

function alignToJustify(align: ButtonComponent['alignment']): CSSProperties['justifyContent'] {
  switch (align) {
    case 'left':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'right':
      return 'flex-end';
    default:
      return 'flex-start';
  }
}

// Re-export for downstream callers that want to dispatch on NavTarget kind.
export type { NavTarget };
