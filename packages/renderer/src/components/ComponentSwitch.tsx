import type { Component } from '@portfoliopro/snapshot-schema';
import { Text } from './Text';

interface ComponentSwitchProps {
  component: Component;
}

/**
 * Dispatches a component by its discriminator. Phase 5 adds Image / Card /
 * Button / Container / PDF cases. Unknown types render an inline error so a
 * forward-compatible client can show "unsupported component — upgrade?" without
 * crashing.
 */
export function ComponentSwitch({ component }: ComponentSwitchProps) {
  switch (component.type) {
    case 'text':
      return <Text component={component} />;
    default:
      return (
        <div style={{ padding: 8, border: '1px dashed currentColor', color: '#888' }}>
          Unsupported component type
        </div>
      );
  }
}
