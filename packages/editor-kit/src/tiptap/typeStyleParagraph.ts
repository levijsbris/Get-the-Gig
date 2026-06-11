import Paragraph from '@tiptap/extension-paragraph';
import { TYPE_STYLE_NAMES, type TypeStyleName } from '@portfoliopro/snapshot-schema';

/**
 * Replaces TipTap's built-in Paragraph extension with one that carries a
 * `typeStyle` attribute. The attribute names one of the theme's named type
 * styles (`h1`, `h2`, `h3`, `lead`, `body`, `caption`) — the renderer
 * resolves it against `theme.typeStyles` at render time so editing the
 * theme propagates to every paragraph without document migrations.
 *
 * Stored as a `paragraph` node (not a heading) so semantics stay flat:
 * the doc never sees `<h1>` vs `<p>` choices; styling is a presentational
 * concern owned by the theme.
 */
export const TypeStyleParagraph = Paragraph.extend({
  addAttributes() {
    return {
      typeStyle: {
        default: 'body' as TypeStyleName,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-type-style');
          return TYPE_STYLE_NAMES.includes(value as TypeStyleName) ? value : 'body';
        },
        renderHTML: (attributes: { typeStyle?: TypeStyleName }) => {
          const value = attributes.typeStyle;
          return value ? { 'data-type-style': value } : {};
        },
      },
    };
  },
});
