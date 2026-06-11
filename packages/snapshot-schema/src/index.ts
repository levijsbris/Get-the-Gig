export { SCHEMA_VERSION, SnapshotSchema } from './snapshot';
export type { Snapshot } from './snapshot';

export { PageSchema } from './page';
export type { Page } from './page';

export { ColumnSchema, SectionSchema } from './section';
export type { Column, Section } from './section';

export { ThemeSchema, defaultTheme } from './theme';
export type { Theme } from './theme';

export { ComponentSchema, TextComponentSchema } from './components';
export type { Component, TextComponent } from './components';

export { TipTapDocSchema, TipTapMarkSchema, emptyTipTapDoc } from './tiptap';
export type { TipTapDoc, TipTapNode } from './tiptap';

export {
  HexColorSchema,
  TokenRefSchema,
  TokenRefOrColorSchema,
  TokenRefOrNumberSchema,
  NavTargetSchema,
} from './shared';
export type {
  HexColor,
  TokenRef,
  TokenRefOrColor,
  TokenRefOrNumber,
  NavTarget,
} from './shared';

export {
  emptyHomePage,
  emptySnapshot,
  createColumn,
  createSection,
  createPage,
  createTextComponent,
} from './defaults';
