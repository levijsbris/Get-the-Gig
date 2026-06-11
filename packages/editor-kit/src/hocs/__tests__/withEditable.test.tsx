import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { withEditable } from '../withEditable';

function Demo({ label }: { label: string }) {
  return <p>demo:{label}</p>;
}

const DemoEditable = withEditable(Demo, { label: 'Demo' });

describe('withEditable', () => {
  it('renders the wrapped component', () => {
    render(<DemoEditable label="x" selected={false} onSelect={() => {}} />);
    expect(screen.getByText('demo:x')).toBeTruthy();
  });

  it('shows the ⋮ button only when selected and onMenuAction is provided', () => {
    const { rerender } = render(
      <DemoEditable label="x" selected={false} onSelect={() => {}} onMenuAction={() => {}} />,
    );
    expect(screen.queryByLabelText('Component actions')).toBeNull();

    rerender(
      <DemoEditable label="x" selected onSelect={() => {}} onMenuAction={() => {}} />,
    );
    expect(screen.getByLabelText('Component actions')).toBeTruthy();

    // No onMenuAction → no chrome even when selected.
    rerender(<DemoEditable label="x" selected onSelect={() => {}} />);
    expect(screen.queryByLabelText('Component actions')).toBeNull();
  });

  it('right-click opens the menu, selects the component, and dispatches actions', () => {
    const onMenuAction = vi.fn();
    const onSelect = vi.fn();
    render(
      <DemoEditable
        label="x"
        selected={false}
        onSelect={onSelect}
        onMenuAction={onMenuAction}
      />,
    );

    const target = screen.getByText('demo:x');
    fireEvent.contextMenu(target);
    expect(onSelect).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Duplicate'));
    expect(onMenuAction).toHaveBeenCalledWith('duplicate');
  });

  it('Escape closes the menu without dispatching an action', () => {
    const onMenuAction = vi.fn();
    render(
      <DemoEditable label="x" selected onSelect={() => {}} onMenuAction={onMenuAction} />,
    );
    fireEvent.click(screen.getByLabelText('Component actions'));
    expect(screen.getByText('Duplicate')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(screen.queryByText('Duplicate')).toBeNull();
    expect(onMenuAction).not.toHaveBeenCalled();
  });
});
