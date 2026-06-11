import Link from '@tiptap/extension-link';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { TextComponent, TipTapDoc, TypeStyleName } from '@portfoliopro/snapshot-schema';
import { TYPE_STYLE_NAMES } from '@portfoliopro/snapshot-schema';
import { useEffect, useRef, type CSSProperties } from 'react';
import { TypeStyleParagraph } from '../tiptap/typeStyleParagraph';

interface TextEditorProps {
  component: TextComponent;
  /** True when the wrapper says this component is in edit mode. */
  editable: boolean;
  /**
   * Fires on every doc mutation. Wire this to the store's
   * updateTextComponentDoc which debounces history entries within ~500ms
   * so each typing burst is one undoable atom.
   */
  onChange: (doc: TipTapDoc) => void;
}

/**
 * TipTap-backed text editor with the snapshot's TipTap doc as the source of
 * truth. Extensions:
 *   - StarterKit minus its built-in Paragraph (replaced by TypeStyleParagraph)
 *   - TypeStyleParagraph: paragraph with a `typeStyle` attribute referencing
 *     one of the theme's named type styles (resolved at render time).
 *   - Link: inline mark with `href` (NavTarget URL form for v1; richer
 *     NavTargets in a follow-up if needed).
 *
 * Inline marks (bold/italic/underline/strike) via keyboard shortcuts inherited
 * from StarterKit. The parent floating toolbar (in the editor app) exposes
 * the type-style picker, link insert, and alignment buttons.
 */
export function TextEditor({ component, editable, onChange }: TextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      TypeStyleParagraph,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: component.doc,
    editable,
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current(ed.getJSON() as TipTapDoc);
    },
  });

  // Sync the editable flag on selection / blur transitions.
  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  // External-source-of-truth sync: when the store's doc changes underneath us
  // (undo, redo, programmatic mutation) and it's different from what the
  // editor currently shows, push the new content in. We compare JSON shape
  // shallowly via stringify to avoid noisy resets on every render.
  const lastDocJson = useRef<string>(JSON.stringify(component.doc));
  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(component.doc);
    if (incoming === lastDocJson.current) return;
    lastDocJson.current = incoming;
    editor.commands.setContent(component.doc, false);
  }, [editor, component.doc]);

  const alignStyle: CSSProperties =
    component.align && component.align !== 'left' ? { textAlign: component.align } : {};

  return (
    <div style={alignStyle} className="portfoliopro-text-editor">
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Imperative helpers for floating toolbars. Toolbar components import these
 * rather than poke TipTap commands directly so future extension changes
 * stay localized.
 */
export const textEditorCommands = {
  toggleBold: (editor: Editor) => editor.chain().focus().toggleBold().run(),
  toggleItalic: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
  toggleUnderline: (editor: Editor) => editor.chain().focus().toggleStrike().run(),
  setTypeStyle: (editor: Editor, typeStyle: TypeStyleName) =>
    editor.chain().focus().updateAttributes('paragraph', { typeStyle }).run(),
  setLink: (editor: Editor, href: string) =>
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run(),
  unsetLink: (editor: Editor) => editor.chain().focus().unsetMark('link').run(),
  isMarkActive: (editor: Editor, name: 'bold' | 'italic' | 'link') => editor.isActive(name),
  currentTypeStyle: (editor: Editor): TypeStyleName => {
    const attrs = editor.getAttributes('paragraph');
    const value = attrs?.typeStyle as TypeStyleName | undefined;
    return value && TYPE_STYLE_NAMES.includes(value) ? value : 'body';
  },
};
