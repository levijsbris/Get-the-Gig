import type { Snapshot as SnapshotType } from '@portfoliopro/snapshot-schema';
import { Page } from './Page';
import { Section } from './components/Section';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

interface SnapshotProps {
  snapshot: SnapshotType;
  /** If supplied, render this page; otherwise render the first one. */
  pageId?: string;
}

export function Snapshot({ snapshot, pageId }: SnapshotProps) {
  const page = pageId
    ? (snapshot.pages.find((p) => p.id === pageId) ?? snapshot.pages[0])
    : snapshot.pages[0];

  if (!page) return null;

  return (
    <ThemeProvider theme={snapshot.theme}>
      <PageWithGlobals page={page} snapshot={snapshot} />
    </ThemeProvider>
  );
}

function PageWithGlobals({
  page,
  snapshot,
}: {
  page: NonNullable<SnapshotType['pages'][number]>;
  snapshot: SnapshotType;
}) {
  const theme = useTheme();
  const { header, footer } = snapshot.globalSections;
  return (
    <div
      style={{
        background: theme.colors.background,
        color: theme.colors.foreground,
        minHeight: '100%',
      }}
    >
      {header && !page.hideGlobalHeader ? <Section section={header} /> : null}
      <Page page={page} />
      {footer && !page.hideGlobalFooter ? <Section section={footer} /> : null}
    </div>
  );
}
