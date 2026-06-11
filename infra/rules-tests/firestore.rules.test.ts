import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const rules = readFileSync(path.resolve(here, '../firestore.rules'), 'utf8');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.split(':') ?? ['localhost', '8080'];
const [host, portString] = emulatorHost;
const port = Number(portString ?? '8080');

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: `portfoliopro-rules-${Date.now()}`,
    firestore: { rules, host, port },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

async function seedAsAdmin(
  write: (ctx: ReturnType<RulesTestEnvironment['authenticatedContext']>) => Promise<void>,
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    // Cast: withSecurityRulesDisabled gives the same firestore shape we use.
    await write(ctx as unknown as ReturnType<RulesTestEnvironment['authenticatedContext']>);
  });
}

describe('/users/{uid}', () => {
  it('owner can read their own user doc', async () => {
    await seedAsAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), {
        uid: 'alice',
        username: 'alice',
        email: 'a@example.com',
      });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  });

  it('other authenticated user cannot read user A doc', async () => {
    await seedAsAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), {
        uid: 'alice',
        username: 'a',
        email: 'a@b',
      });
    });
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'users/alice')));
  });

  it('anonymous request cannot read user docs', async () => {
    await seedAsAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), {
        uid: 'alice',
        username: 'a',
        email: 'a@b',
      });
    });
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users/alice')));
  });

  it('owner cannot delete their user doc (soft delete is backend-only)', async () => {
    await seedAsAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), {
        uid: 'alice',
        username: 'a',
        email: 'a@b',
      });
    });
    const alice = env.authenticatedContext('alice').firestore();
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(alice, 'users/alice')));
  });
});

describe('/usernames/{username}', () => {
  it('anonymous can read /usernames/{u} (availability check)', async () => {
    await seedAsAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usernames/alice'), {
        uid: 'alice',
        claimedAt: new Date(),
      });
    });
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'usernames/alice')));
  });

  it('anonymous cannot write /usernames/{u}', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anon, 'usernames/alice'), { uid: 'alice', claimedAt: new Date() }),
    );
  });

  it('authenticated user cannot write /usernames/{u} (backend-only)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'usernames/alice'), { uid: 'alice', claimedAt: new Date() }),
    );
  });
});

describe('/portfolioRoutes/{routeId}', () => {
  it('anonymous can read /portfolioRoutes/{routeId} (viewer URL lookup)', async () => {
    await seedAsAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'portfolioRoutes/alice_resume'), {
        uid: 'alice',
        portfolioId: 'pid-1',
        isPublished: true,
        requiresPassword: false,
      });
    });
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'portfolioRoutes/alice_resume')));
  });

  it('no client can write /portfolioRoutes/{routeId}', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'portfolioRoutes/alice_resume'), {
        uid: 'alice',
        portfolioId: 'pid-1',
        isPublished: true,
      }),
    );
  });
});

describe('/users/{uid}/portfolios/{pid} (Phase 2 stub)', () => {
  it('owner can read their portfolio doc', async () => {
    await seedAsAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/portfolios/p1'), { uid: 'alice', slug: 's' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'users/alice/portfolios/p1')));
  });

  it('other user cannot read alice portfolio', async () => {
    await seedAsAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/portfolios/p1'), { uid: 'alice', slug: 's' });
    });
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'users/alice/portfolios/p1')));
  });
});

describe('/deletionQueue/{taskId}', () => {
  it('no client can read /deletionQueue', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(alice, 'deletionQueue/task1')));
  });
});
