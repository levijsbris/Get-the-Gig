import { beforeEach, describe, expect, it, vi } from 'vitest';

const createUserWithEmailAndPassword = vi.fn();
const signInWithEmailAndPassword = vi.fn();
const firebaseSignOut = vi.fn();
const onAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut: firebaseSignOut,
  onAuthStateChanged,
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(() => ({})),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset modules so each test re-runs auth.ts's top-level onAuthStateChanged call.
    vi.resetModules();
    createUserWithEmailAndPassword.mockReset();
    signInWithEmailAndPassword.mockReset();
    firebaseSignOut.mockReset();
    onAuthStateChanged.mockReset();
  });

  it('subscribes to onAuthStateChanged at module load', async () => {
    await import('./auth');
    expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
  });

  it('wires sign-in / sign-up / sign-out to Firebase Auth', async () => {
    const { useAuthStore } = await import('./auth');

    await useAuthStore.getState().signUp('alice@example.com', 'hunter2hunter2');
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'alice@example.com',
      'hunter2hunter2',
    );

    await useAuthStore.getState().signIn('alice@example.com', 'hunter2hunter2');
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'alice@example.com',
      'hunter2hunter2',
    );

    await useAuthStore.getState().signOut();
    expect(firebaseSignOut).toHaveBeenCalled();
  });
});
