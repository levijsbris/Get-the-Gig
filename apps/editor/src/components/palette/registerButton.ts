import { createButtonComponent } from '@portfoliopro/snapshot-schema';
import { registerPaletteComponent } from './components';

registerPaletteComponent({
  type: 'button',
  label: '+ Button',
  description: 'Click to insert, or drag onto a column',
  dragId: 'palette:button',
  factory: () => createButtonComponent(),
});
