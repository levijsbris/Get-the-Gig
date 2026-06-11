import type {
  TextComponent,
  Theme,
  TipTapNode,
  TypeStyle,
  TypeStyleName,
} from '@portfoliopro/snapshot-schema';
import { defaultTypeStyles, TYPE_STYLE_NAMES } from '@portfoliopro/snapshot-schema';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '../theme/ThemeProvider';

interface TextProps {
  component: TextComponent;
}

/**
 * Recursive TipTap-doc renderer. The doc is a tree of:
 *   - block nodes (`paragraph` with a `typeStyle` attr resolved against
 *     theme.typeStyles, plus `bulletList` / `orderedList` / `listItem` /
 *     `blockquote` from StarterKit)
 *   - inline nodes (`text` with optional `marks`)
 *   - hard breaks
 *
 * Marks are folded into nested spans / anchors so a single text run can carry
 * bold + italic + link without each layer needing its own component.
 *
 * Phase 6 will add more theme-resolution (color tokens on inline marks) —
 * the dispatcher is structured so that's an extension at the mark/attrs
 * level rather than a rewrite.
 */
export function Text({ component }: TextProps) {
  const theme = useTheme();
  const align: CSSProperties = component.align && component.align !== 'left'
    ? { textAlign: component.align }
    : {};

  return (
    <div
      style={{
        color: theme.colors.foreground,
        fontFamily: theme.fonts.body,
        ...align,
      }}
    >
      {renderNode(component.doc, theme, 'root')}
    </div>
  );
}

function renderNode(node: TipTapNode | undefined, theme: Theme, key: string): ReactNode {
  if (!node) return null;
  switch (node.type) {
    case 'doc':
      return (
        <Fragment key={key}>
          {(node.content ?? []).map((child, i) => renderNode(child, theme, `${key}.${i}`))}
        </Fragment>
      );
    case 'paragraph': {
      const typeStyleName = (node.attrs?.typeStyle as TypeStyleName | undefined) ?? 'body';
      const safeName: TypeStyleName = TYPE_STYLE_NAMES.includes(typeStyleName)
        ? typeStyleName
        : 'body';
      const style = resolveTypeStyle(safeName, theme);
      return (
        <p
          key={key}
          style={{
            margin: 0,
            ...style,
            // Render empty paragraphs at the right height so toggling type
            // styles doesn't make blocks visually disappear.
            minHeight: hasInlineContent(node) ? undefined : `${style.fontSize * style.lineHeight}px`,
          }}
        >
          {(node.content ?? []).map((child, i) => renderNode(child, theme, `${key}.${i}`))}
        </p>
      );
    }
    case 'bulletList':
      return (
        <ul key={key} style={{ paddingLeft: 20, margin: 0 }}>
          {(node.content ?? []).map((child, i) => renderNode(child, theme, `${key}.${i}`))}
        </ul>
      );
    case 'orderedList':
      return (
        <ol key={key} style={{ paddingLeft: 20, margin: 0 }}>
          {(node.content ?? []).map((child, i) => renderNode(child, theme, `${key}.${i}`))}
        </ol>
      );
    case 'listItem':
      return (
        <li key={key}>
          {(node.content ?? []).map((child, i) => renderNode(child, theme, `${key}.${i}`))}
        </li>
      );
    case 'blockquote':
      return (
        <blockquote
          key={key}
          style={{
            borderLeft: `3px solid ${theme.colors.muted}`,
            paddingLeft: 12,
            margin: 0,
            color: theme.colors.muted,
          }}
        >
          {(node.content ?? []).map((child, i) => renderNode(child, theme, `${key}.${i}`))}
        </blockquote>
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'text':
      return renderTextRun(node, theme, key);
    default:
      // Unknown block — render children inline. Keeps forward compatibility
      // when a future TipTap extension adds a node type before we update
      // the renderer.
      return (
        <Fragment key={key}>
          {(node.content ?? []).map((child, i) => renderNode(child, theme, `${key}.${i}`))}
        </Fragment>
      );
  }
}

function renderTextRun(node: TipTapNode, theme: Theme, key: string): ReactNode {
  const text = node.text ?? '';
  if (text === '') return null;
  let element: ReactNode = text;

  for (const mark of node.marks ?? []) {
    element = applyMark(element, mark.type, mark.attrs, theme, key);
  }

  return <Fragment key={key}>{element}</Fragment>;
}

function applyMark(
  element: ReactNode,
  type: string,
  attrs: Record<string, unknown> | undefined,
  theme: Theme,
  key: string,
): ReactNode {
  switch (type) {
    case 'bold':
      return <strong style={{ fontWeight: 700 }}>{element}</strong>;
    case 'italic':
      return <em>{element}</em>;
    case 'strike':
      return <s>{element}</s>;
    case 'underline':
      return <u>{element}</u>;
    case 'code':
      return (
        <code style={{ background: theme.colors.surface, padding: '0 4px', borderRadius: 3 }}>
          {element}
        </code>
      );
    case 'link': {
      const href = (attrs?.href as string | undefined) ?? '#';
      const target = attrs?.target as string | undefined;
      return (
        <a
          href={href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          style={{ color: theme.colors.accent, textDecoration: 'underline' }}
        >
          {element}
        </a>
      );
    }
    default:
      return element;
  }
}

interface ResolvedTypeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: number;
}

function resolveTypeStyle(name: TypeStyleName, theme: Theme): ResolvedTypeStyle {
  const styles = theme.typeStyles ?? defaultTypeStyles;
  const style: TypeStyle = styles[name];
  return {
    fontFamily: theme.fonts[style.fontFamily],
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
  };
}

function hasInlineContent(node: TipTapNode): boolean {
  return !!node.content && node.content.length > 0;
}
