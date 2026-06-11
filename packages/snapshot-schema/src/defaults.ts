import { ulid } from 'ulid';
import type { Column, Section } from './section';
import type { Page } from './page';
import type { Snapshot } from './snapshot';
import { SCHEMA_VERSION } from './snapshot';
import type { TextComponent } from './components/text';
import { defaultTheme } from './theme';
import { emptyTipTapDoc } from './tiptap';

const HOME_PAGE_SLUG = 'home';
const HOME_PAGE_TITLE = 'Home';

export function emptyHomePage(): Page {
  return {
    id: ulid(),
    slug: HOME_PAGE_SLUG,
    title: HOME_PAGE_TITLE,
    sections: [],
  };
}

export function createColumn(): Column {
  return { id: ulid(), components: [] };
}

export function createSection(columnCount: 1 | 2 | 3 | 4 = 1): Section {
  return {
    id: ulid(),
    background: {},
    layout: { columns: columnCount },
    columns: Array.from({ length: columnCount }, () => createColumn()),
  };
}

export function createPage(title = 'Untitled', slug = 'untitled'): Page {
  return {
    id: ulid(),
    slug,
    title,
    sections: [],
  };
}

export function createTextComponent(): TextComponent {
  return {
    id: ulid(),
    type: 'text',
    doc: emptyTipTapDoc(),
  };
}

export function emptySnapshot(): Snapshot {
  return {
    version: SCHEMA_VERSION,
    portfolio: {
      title: '',
      description: '',
    },
    theme: defaultTheme,
    globalSections: {
      header: null,
      footer: null,
    },
    pages: [emptyHomePage()],
  };
}
