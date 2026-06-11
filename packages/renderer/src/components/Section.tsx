import type { Section as SectionType } from '@portfoliopro/snapshot-schema';
import { useTheme } from '../theme/ThemeProvider';
import { Column } from './Column';

interface SectionProps {
  section: SectionType;
}

export function Section({ section }: SectionProps) {
  const theme = useTheme();
  const columnCount = section.layout.columns;
  return (
    <section
      style={{
        background: section.background.color ?? 'transparent',
        paddingTop: section.padding?.top ?? theme.spacing.lg,
        paddingBottom: section.padding?.bottom ?? theme.spacing.lg,
        paddingLeft: theme.spacing.md,
        paddingRight: theme.spacing.md,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gap: section.layout.gap ?? theme.spacing.md,
        }}
      >
        {section.columns.map((column) => (
          <Column key={column.id} column={column} />
        ))}
      </div>
    </section>
  );
}
