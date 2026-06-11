import type { CSSProperties, ReactNode } from 'react';

interface EditableShellProps {
  selected: boolean;
  onSelect: (event: React.MouseEvent) => void;
  /** Visible label shown above the selection ring when selected. */
  label?: string;
  children: ReactNode;
  /** Extra styles merged into the shell container. */
  style?: CSSProperties;
}

const RING_COLOR = '#0ea5e9';

/**
 * Selection chrome wrapper used by every *Editable component. Stops click
 * propagation so a click on a component selects only the component, not the
 * enclosing section. The selection ring is rendered via outline so it never
 * affects the wrapped content's layout.
 */
export function EditableShell({ selected, onSelect, label, children, style }: EditableShellProps) {
  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        onSelect(event);
      }}
      data-editable-label={label}
      data-selected={selected || undefined}
      style={{
        position: 'relative',
        outline: selected ? `2px solid ${RING_COLOR}` : '2px solid transparent',
        outlineOffset: 2,
        cursor: 'pointer',
        transition: 'outline-color 80ms ease-out',
        ...style,
      }}
    >
      {selected && label ? (
        <span
          style={{
            position: 'absolute',
            top: -22,
            left: 0,
            background: RING_COLOR,
            color: 'white',
            fontSize: 10,
            lineHeight: '18px',
            padding: '0 6px',
            borderRadius: 2,
            pointerEvents: 'none',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}
