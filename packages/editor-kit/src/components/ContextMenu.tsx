import { useEffect, useRef } from 'react';

export type ContextMenuAction = 'duplicate' | 'delete' | 'moveUp' | 'moveDown';

export interface ContextMenuItem {
  action: ContextMenuAction;
  label: string;
  shortcut?: string;
  destructive?: boolean;
}

const DEFAULT_ITEMS: readonly ContextMenuItem[] = [
  { action: 'duplicate', label: 'Duplicate', shortcut: '⌘D' },
  { action: 'moveUp', label: 'Move up' },
  { action: 'moveDown', label: 'Move down' },
  { action: 'delete', label: 'Delete', shortcut: '⌫', destructive: true },
];

interface ContextMenuProps {
  x: number;
  y: number;
  items?: readonly ContextMenuItem[];
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
}

/**
 * Right-click / ⋮-button popover with component action items. Positioned at
 * the viewport coordinates passed in (already adjusted for scroll). Closes
 * on outside click or Escape. Inline-styled because editor-kit doesn't ship
 * with Tailwind processing.
 */
export function ContextMenu({ x, y, items = DEFAULT_ITEMS, onAction, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onClickAway(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('mousedown', onClickAway);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClickAway);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <ul
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 50,
        minWidth: 160,
        margin: 0,
        padding: '4px 0',
        listStyle: 'none',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
        fontSize: 13,
      }}
    >
      {items.map((item) => (
        <li
          key={item.action}
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            onAction(item.action);
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 12px',
            cursor: 'pointer',
            color: item.destructive ? '#dc2626' : '#0f172a',
          }}
          onMouseEnter={(event) => {
            (event.currentTarget as HTMLLIElement).style.background = '#f1f5f9';
          }}
          onMouseLeave={(event) => {
            (event.currentTarget as HTMLLIElement).style.background = 'transparent';
          }}
        >
          <span>{item.label}</span>
          {item.shortcut ? (
            <span style={{ marginLeft: 12, fontSize: 11, color: '#94a3b8' }}>{item.shortcut}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
