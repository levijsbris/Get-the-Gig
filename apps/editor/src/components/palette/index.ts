// Side-effect imports register each component type into PALETTE_COMPONENTS at
// module load. Adding a new component means dropping a registerXxx.ts file
// next to this one and importing it here.
import './registerText';
import './registerButton';

export { PALETTE_COMPONENTS, registerPaletteComponent } from './components';
export type { PaletteEntry } from './components';
