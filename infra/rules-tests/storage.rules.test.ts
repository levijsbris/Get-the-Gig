import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const rules = readFileSync(path.resolve(here, '../storage.rules'), 'utf8');

const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST?.split(':') ?? ['localhost', '9299'];
const [host, portString] = storageHost;
const port = Number(portString ?? '9299');

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: `portfoliopro-storage-rules-${Date.now()}`,
    storage: { rules, host, port },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
});

const sampleBytes = new Uint8Array([0xff, 0xd8, 0xff]); // looks like a JPEG header

describe('users/{uid}/{**} — per-user prefix', () => {
  it('owner can write to their own prefix', async () => {
    const alice = env.authenticatedContext('alice').storage();
    await assertSucceeds(
      uploadBytes(ref(alice, 'users/alice/assets/01H/photo.jpg'), sampleBytes, {
        contentType: 'image/jpeg',
      }),
    );
  });

  it('owner can read their own prefix', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'users/alice/assets/01H/photo.jpg'), sampleBytes, {
        contentType: 'image/jpeg',
      });
    });
    const alice = env.authenticatedContext('alice').storage();
    await assertSucceeds(getBytes(ref(alice, 'users/alice/assets/01H/photo.jpg')));
  });

  it('other user cannot write to alice prefix', async () => {
    const bob = env.authenticatedContext('bob').storage();
    await assertFails(
      uploadBytes(ref(bob, 'users/alice/assets/01H/photo.jpg'), sampleBytes, {
        contentType: 'image/jpeg',
      }),
    );
  });

  it('anonymous request cannot read alice prefix', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'users/alice/assets/01H/photo.jpg'), sampleBytes, {
        contentType: 'image/jpeg',
      });
    });
    const anon = env.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(anon, 'users/alice/assets/01H/photo.jpg')));
  });
});

describe('snapshots/{**} — backend-only published snapshots', () => {
  it('no client can write under snapshots/', async () => {
    const alice = env.authenticatedContext('alice').storage();
    await assertFails(
      uploadBytes(ref(alice, 'snapshots/alice/resume/snapshot.json'), sampleBytes, {
        contentType: 'application/json',
      }),
    );
  });

  it('no client can read under snapshots/', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'snapshots/alice/resume/snapshot.json'), sampleBytes, {
        contentType: 'application/json',
      });
    });
    const alice = env.authenticatedContext('alice').storage();
    await assertFails(getBytes(ref(alice, 'snapshots/alice/resume/snapshot.json')));
  });
});

describe('other prefixes', () => {
  it('writes outside users/ and snapshots/ are denied', async () => {
    const alice = env.authenticatedContext('alice').storage();
    await assertFails(
      uploadBytes(ref(alice, 'random/path/file.jpg'), sampleBytes, { contentType: 'image/jpeg' }),
    );
  });
});
