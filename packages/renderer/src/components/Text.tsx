import type { TextComponent, TipTapNode } from '@portfoliopro/snapshot-schema';
import { useTheme } from '../theme/ThemeProvider';

interface TextProps {
  component: TextComponent;
}

/**
 * Phase 4 renderer. Walks the TipTap doc shallowly and concatenates text
 * nodes — enough to display a placeholder string in the editor. Phase 5
 * swaps this for a TipTap-based renderer that respects marks (bold/italic/
 * link) and the theme's typography tokens for headings vs paragraphs.
 */
export function Text({ component }: TextProps) {
  const theme = useTheme();
  const flattened = flattenText(component.doc);
  return (
    <div
      style={{
        color: theme.colors.foreground,
        fontFamily: theme.fonts.body,
        textAlign: component.align ?? 'left',
        whiteSpace: 'pre-wrap',
      }}
    >
      {flattened === '' ? <span style={{ color: theme.colors.muted }}>(empty text)</span> : flattened}
    </div>
  );
}

function flattenText(node: TipTapNode | undefined): string {
  if (!node) return '';
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(flattenText).join('');
}
