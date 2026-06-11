import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Theme } from '@portfoliopro/snapshot-schema';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  // Memoise so consumers don't re-render when the parent re-renders with a
  // theme that's the same object identity.
  const value = useMemo(() => theme, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      'useTheme called outside <ThemeProvider>. Wrap the snapshot in <Snapshot> or a manual provider.',
    );
  }
  return ctx;
}
