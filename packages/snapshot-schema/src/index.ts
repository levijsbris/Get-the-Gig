export { SCHEMA_VERSION, SnapshotSchema } from './snapshot';
export type { Snapshot } from './snapshot';

export { PageSchema } from './page';
export type { Page } from './page';

export { ColumnSchema, SectionSchema } from './section';
export type { Column, Section } from './section';

export {
  ThemeSchema,
  TypeStyleSchema,
  TypeStylesSchema,
  TYPE_STYLE_NAMES,
  defaultTheme,
  defaultTypeStyles,
} from './theme';
export type { Theme, TypeStyle, TypeStyles, TypeStyleName } from './theme';

export { ComponentSchema, ButtonComponentSchema, TextComponentSchema } from './components';
export type { Component, ButtonComponent, TextComponent } from './components';

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
  createButtonComponent,
} from './defaults';
