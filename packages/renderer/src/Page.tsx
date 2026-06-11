import type { Page as PageType } from '@portfoliopro/snapshot-schema';
import { Section } from './components/Section';

interface PageProps {
  page: PageType;
}

export function Page({ page }: PageProps) {
  return (
    <>
      {page.sections.map((section) => (
        <Section key={section.id} section={section} />
      ))}
    </>
  );
}
