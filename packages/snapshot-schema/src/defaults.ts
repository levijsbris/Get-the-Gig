import { ulid } from 'ulid';
import type { Page } from './page';
import type { Snapshot } from './snapshot';
import { SCHEMA_VERSION } from './snapshot';
import { defaultTheme } from './theme';

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
