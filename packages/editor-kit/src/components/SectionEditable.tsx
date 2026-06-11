import type { Section as SectionType } from '@portfoliopro/snapshot-schema';
import { Section } from '@portfoliopro/renderer';
import { EditableShell } from './EditableShell';

interface SectionEditableProps {
  section: SectionType;
  selected: boolean;
  onSelect: (event: React.MouseEvent) => void;
}

export function SectionEditable({ section, selected, onSelect }: SectionEditableProps) {
  return (
    <EditableShell selected={selected} onSelect={onSelect} label="Section">
      <Section section={section} />
    </EditableShell>
  );
}
