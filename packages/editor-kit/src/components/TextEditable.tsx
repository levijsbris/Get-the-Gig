import { Text } from '@portfoliopro/renderer';
import type { TextComponent, TipTapDoc } from '@portfoliopro/snapshot-schema';
import { useState, type MouseEvent } from 'react';
import { ContextMenu, type ContextMenuAction } from './ContextMenu';
import { EditableShell } from './EditableShell';
import { TextEditor } from './TextEditor';

interface TextEditableProps {
  component: TextComponent;
  selected: boolean;
  onSelect: (event: MouseEvent) => void;
  onChange: (doc: TipTapDoc) => void;
  onMenuAction?: (action: ContextMenuAction) => void;
}

/**
 * Text component wrapper. Renders the read-only theme-aware <Text> when not
 * selected, swaps in the interactive <TextEditor> on selection. The chrome
 * (selection ring, ⋮ button, right-click menu) mirrors withEditable but is
 * inlined here because the inner content swap is selection-sensitive.
 */
export function TextEditable({
  component,
  selected,
  onSelect,
  onChange,
  onMenuAction,
}: TextEditableProps) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = () => setMenuPos(null);
  const dispatch = (action: ContextMenuAction) => {
    onMenuAction?.(action);
    closeMenu();
  };

  return (
    <div
      style={{ position: 'relative' }}
      onContextMenu={(event) => {
        if (!onMenuAction) return;
        event.preventDefault();
        event.stopPropagation();
        setMenuPos({ x: event.clientX, y: event.clientY });
        onSelect(event);
      }}
    >
      <EditableShell selected={selected} onSelect={onSelect} label="Text">
        {selected ? (
          <TextEditor component={component} editable onChange={onChange} />
        ) : (
          <Text component={component} />
        )}
      </EditableShell>
      {selected && onMenuAction ? (
        <button
          type="button"
          aria-label="Component actions"
          onClick={(event) => {
            event.stopPropagation();
            const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
            setMenuPos({ x: rect.right, y: rect.bottom + 4 });
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 10,
            padding: '0 6px',
            height: 20,
            fontSize: 14,
            lineHeight: '18px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            cursor: 'pointer',
            color: '#475569',
          }}
        >
          ⋮
        </button>
      ) : null}
      {menuPos && onMenuAction ? (
        <ContextMenu x={menuPos.x} y={menuPos.y} onAction={dispatch} onClose={closeMenu} />
      ) : null}
    </div>
  );
}
