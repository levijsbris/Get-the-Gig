import type { Column as ColumnType } from '@portfoliopro/snapshot-schema';
import { useTheme } from '../theme/ThemeProvider';
import { ComponentSwitch } from './ComponentSwitch';

interface ColumnProps {
  column: ColumnType;
}

export function Column({ column }: ColumnProps) {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      {column.components.map((component) => (
        <ComponentSwitch key={component.id} component={component} />
      ))}
    </div>
  );
}
