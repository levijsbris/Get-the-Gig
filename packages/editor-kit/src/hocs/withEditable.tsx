import {
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { EditableShell } from '../components/EditableShell';
import { ContextMenu, type ContextMenuAction } from '../components/ContextMenu';

export interface WithEditableInjectedProps {
  /** True when this component is the current selection target. */
  selected: boolean;
  /** Clicking the component should call this to update the editor selection. */
  onSelect: (event: ReactMouseEvent) => void;
  /**
   * Component-level actions from the context menu / ⋮ button. Optional — when
   * omitted, the menu chrome is not rendered (useful for read-only previews).
   */
  onMenuAction?: (action: ContextMenuAction) => void;
}

export interface WithEditableOptions {
  /** Label shown above the selection ring (e.g. "Image"). */
  label: string;
  /**
   * Optional render-prop for component-specific overlay chrome (e.g. crop
   * handles for Image, resize handles for Container). Rendered inside the
   * shell so it inherits the selection state.
   */
  renderOverlay?: (args: { selected: boolean }) => ReactNode;
}

/**
 * Wraps a renderer component with the editor chrome shared by every
 * component type:
 *   - selection ring (EditableShell)
 *   - ⋮ button (top-right) shown when selected
 *   - right-click context menu with Duplicate / Move up / Move down / Delete
 *
 * The injected props (`selected`, `onSelect`, `onMenuAction`) are wired in by
 * the editor at the use site; the HOC itself is store-agnostic.
 *
 * Usage:
 *
 *     import { Button } from '@portfoliopro/renderer';
 *     export const ButtonEditable = withEditable(Button, { label: 'Button' });
 */
export function withEditable<P extends object>(
  Renderer: ComponentType<P>,
  options: WithEditableOptions,
): ComponentType<P & WithEditableInjectedProps> {
  const Editable = function Editable(props: P & WithEditableInjectedProps) {
    const { selected, onSelect, onMenuAction, ...rendererProps } = props;
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

    const closeMenu = () => setMenuPos(null);
    const dispatchAction = (action: ContextMenuAction) => {
      if (onMenuAction) onMenuAction(action);
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
        <EditableShell selected={selected} onSelect={onSelect} label={options.label}>
          <Renderer {...(rendererProps as unknown as P)} />
          {options.renderOverlay ? options.renderOverlay({ selected }) : null}
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
          <ContextMenu
            x={menuPos.x}
            y={menuPos.y}
            onAction={dispatchAction}
            onClose={closeMenu}
          />
        ) : null}
      </div>
    );
  };
  Editable.displayName = `Editable(${options.label})`;
  return Editable;
}
