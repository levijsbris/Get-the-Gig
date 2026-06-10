# Snapshot Schema

The published-portfolio snapshot is a single JSON document. The same shape is used as the live editor draft (with one allowance for unsaved partial state). The shape is defined in TypeScript/Zod in `packages/snapshot-schema/` — this document is the human-readable reference.

## Top level

```ts
{
  version: 1;
  portfolio: {
    title: string;
    description: string;
  };
  theme: Theme;
  globalSections: {
    header: Section | null;
    footer: Section | null;
  };
  pages: Page[];          // ordered; first page is the landing page
}
```

## Pages

```ts
type Page = {
  id: string;             // ULID
  slug: string;           // ^[a-z0-9-]{1,40}$, unique within portfolio; "home" reserved for landing
  title: string;
  sections: Section[];
  hideGlobalHeader?: boolean;
  hideGlobalFooter?: boolean;
};
```

## Sections

```ts
type Section = {
  id: string;
  templateId?: string;    // when added from a section template
  background: {
    color?: TokenRef | string;
  };
  layout: {
    columns: 1 | 2 | 3 | 4;
    gap?: TokenRef | number;
    columnRatios?: number[];  // length matches columns; defaults to equal
  };
  responsive?: {
    tablet?: { columns?: 1 | 2; hidden?: boolean };
    mobile?: { columns?: 1; hidden?: boolean };
  };
  padding?: { top?: TokenRef | number; bottom?: TokenRef | number };
  columns: Column[];      // length === layout.columns
};

type Column = {
  id: string;
  components: Component[];
};
```

Sections cannot be nested. For nested layout, use a Container component (see below).

## Components

```ts
type Component =
  | TextComponent
  | ImageComponent
  | CardComponent
  | ButtonComponent
  | ContainerComponent
  | PdfComponent;
```

### Text

```ts
type TextComponent = {
  id: string;
  type: 'text';
  doc: TipTapDocJSON;   // TipTap structured document
  align?: 'left' | 'center' | 'right';
};
```

The TipTap document uses marks that reference theme type styles (`h1`, `h2`, ..., `paragraph`, `caption`) by token name. Inline overrides (bold, italic, link) are allowed.

### Image

```ts
type ImageComponent = {
  id: string;
  type: 'image';
  assetId: string;
  alt: string;
  crop?: { x: number; y: number; w: number; h: number };  // 0..1 normalised
  rotation?: 0 | 90 | 180 | 270;
  link?: NavTarget;
  lightbox?: boolean;
};
```

At publish time, a cropped derivative is rendered in the browser (canvas) and uploaded alongside the snapshot. The source asset stays untouched and re-usable.

### Card

```ts
type CardComponent = {
  id: string;
  type: 'card';
  preset: 'cardA' | 'cardB' | 'cardC';
  title?: string;
  body?: TipTapDocJSON;
  assetId?: string;
  link?: NavTarget;
};
```

### Button

```ts
type ButtonComponent = {
  id: string;
  type: 'button';
  preset: 'primary' | 'secondary' | 'ghost';
  label: string;
  link: NavTarget;
};
```

### Container

```ts
type ContainerComponent = {
  id: string;
  type: 'container';
  background: { color?: TokenRef | string };
  border?: {
    color?: TokenRef | string;
    width?: number;
    radius?: TokenRef | number;
  };
  padding?: { all?: TokenRef | number };
  layout: { columns: 1 | 2 | 3 | 4; gap?: TokenRef | number };
  columns: Column[];
};
```

Containers may contain any non-Container component. Containers do NOT nest in v1 — flag a validation error.

### PDF

```ts
type PdfComponent = {
  id: string;
  type: 'pdf';
  assetId: string;
  showInlinePreview: boolean;   // lazy-loaded pdf.js when true
  downloadLabel: string;        // e.g. "Download résumé"
};
```

A PDF component renders an inline scrollable preview (when `showInlinePreview` is true) AND a download button. The preview lazy-loads pdf.js only when the component scrolls into view.

## Navigation targets

```ts
type NavTarget =
  | { kind: 'page'; pageId: string }
  | { kind: 'section'; pageId: string; sectionId: string }      // in-page scroll
  | { kind: 'url'; url: string; newTab: boolean }
  | { kind: 'mailto'; email: string }
  | { kind: 'tel'; phone: string };
```

`page` and `section` are validated at publish time — the referenced page/section must exist in the same snapshot.

## Theme

```ts
type Theme = {
  fonts: {
    heading: GoogleFontName;
    body: GoogleFontName;
  };
  typeScale: {
    h1: TypeStyle;
    h2: TypeStyle;
    h3: TypeStyle;
    h4: TypeStyle;
    paragraph: TypeStyle;
    caption: TypeStyle;
  };
  colors: {
    background: HexColor;
    surface: HexColor;
    foreground: HexColor;
    muted: HexColor;
    primary: HexColor;
    accent: HexColor;
  };
  buttons: {
    primary: ButtonStyle;
    secondary: ButtonStyle;
    ghost: ButtonStyle;
  };
  cards: {
    cardA: CardStyle;
    cardB: CardStyle;
    cardC: CardStyle;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radii: { sm: number; md: number; lg: number };
};

type TypeStyle = {
  family: 'heading' | 'body';
  size: number;          // px at desktop breakpoint
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  lineHeight: number;    // multiplier, e.g. 1.4
  letterSpacing?: number;
  color: keyof Theme['colors'];  // refers to palette slot
};

type ButtonStyle = {
  background: keyof Theme['colors'] | HexColor;
  foreground: keyof Theme['colors'] | HexColor;
  border?: { color: keyof Theme['colors'] | HexColor; width: number };
  radius: keyof Theme['radii'] | number;
  paddingX: keyof Theme['spacing'] | number;
  paddingY: keyof Theme['spacing'] | number;
  fontWeight: number;
  hover?: Partial<Omit<ButtonStyle, 'hover'>>;
};
```

`GoogleFontName` is constrained to the curated list of 30 fonts in `packages/renderer/src/theme/fonts.ts`.

## Token references

Many fields accept `TokenRef | concrete-value`. A `TokenRef` is a string like `"color.primary"`, `"spacing.md"`, `"radii.lg"`. The renderer resolves these against the theme at render time. This makes theme tweaks propagate without rewriting every component.

## Schema versioning

`version: 1` is the only current version. When making a backwards-compatible additive change (new optional field), keep `version: 1` and ensure the new field is treated as optional everywhere. When making a breaking change, increment to `version: 2` and write a migration in `packages/snapshot-schema/migrations/`. See the **snapshot-and-publish** skill for the full procedure.

## Validation

Validation happens in two places:

1. **Frontend (editor)** — Zod schema validates draft before save. Errors surface in the UI.
2. **Backend (publish endpoint)** — generated JSON Schema validates incoming snapshots before they're written to Cloud Storage. Cross-reference checks (NavTarget refs, column count matches `layout.columns`, etc.) run as a second pass.

The backend never trusts the frontend to have validated. The frontend never relies on the backend to catch obvious schema errors.
