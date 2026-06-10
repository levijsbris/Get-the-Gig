import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { create } from 'zustand';
import { firebaseAuth } from '../lib/firebase';

export type AuthStatus = 'initializing' | 'ready';

interface AuthStore {
  firebaseUser: User | null;
  status: AuthStatus;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((_set) => ({
  firebaseUser: null,
  status: 'initializing',
  signUp: async (email, password) => {
    await createUserWithEmailAndPassword(firebaseAuth, email, password);
  },
  signIn: async (email, password) => {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  },
  signOut: async () => {
    await firebaseSignOut(firebaseAuth);
  },
}));

// Boot the auth listener once at module load. onAuthStateChanged fires immediately
// with the restored session (or null) and then on every subsequent change.
onAuthStateChanged(firebaseAuth, (user) => {
  useAuthStore.setState({ firebaseUser: user, status: 'ready' });
});
