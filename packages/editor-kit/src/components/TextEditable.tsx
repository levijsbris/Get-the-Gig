import type { TextComponent } from '@portfoliopro/snapshot-schema';
import { Text } from '@portfoliopro/renderer';
import { EditableShell } from './EditableShell';

interface TextEditableProps {
  component: TextComponent;
  selected: boolean;
  onSelect: (event: React.MouseEvent) => void;
}

export function TextEditable({ component, selected, onSelect }: TextEditableProps) {
  return (
    <EditableShell selected={selected} onSelect={onSelect} label="Text">
      <Text component={component} />
    </EditableShell>
  );
}
