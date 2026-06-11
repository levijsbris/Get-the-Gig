import { createTextComponent } from '@portfoliopro/snapshot-schema';
import { registerPaletteComponent } from './components';

// Phase 5 text remains a one-click insert — no picker, factory only.
registerPaletteComponent({
  type: 'text',
  label: '+ Text',
  description: 'Click to insert, or drag onto a column',
  dragId: 'palette:text',
  factory: () => createTextComponent(),
});
