export { EditableShell } from './components/EditableShell';
export { SectionEditable } from './components/SectionEditable';
export { TextEditable } from './components/TextEditable';

export { useAutosave } from './autosave/useAutosave';
export type { UseAutosaveOptions, UseAutosaveResult } from './autosave/useAutosave';

export {
  shadowKey,
  readShadow,
  writeShadow,
  clearShadow,
  shadowWins,
} from './autosave/localStorageShadow';
export type { DraftShadow } from './autosave/localStorageShadow';
