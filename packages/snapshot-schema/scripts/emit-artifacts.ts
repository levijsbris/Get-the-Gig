import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toJSONSchema } from 'zod';
import { emptySnapshot, SnapshotSchema } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'dist', 'artifacts');
mkdirSync(outDir, { recursive: true });

const jsonSchema = toJSONSchema(SnapshotSchema);
writeFileSync(
  path.join(outDir, 'snapshot.schema.json'),
  `${JSON.stringify(jsonSchema, null, 2)}\n`,
  'utf8',
);

// The empty default has any auto-generated identifiers replaced with the literal
// placeholder "__GENERATE_ULID__". Backend (and any frontend consumer that wants
// a fresh instance) walks the JSON and replaces those before use, so we never
// ship a frozen ULID that would collide across portfolios.
const PLACEHOLDER = '__GENERATE_ULID__';
const empty = emptySnapshot();
empty.pages.forEach((page) => {
  page.id = PLACEHOLDER;
});

writeFileSync(
  path.join(outDir, 'snapshot.empty.json'),
  `${JSON.stringify(empty, null, 2)}\n`,
  'utf8',
);

console.log(`Emitted artifacts to ${outDir}`);
