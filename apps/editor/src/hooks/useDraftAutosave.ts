import {
  readShadow,
  shadowWins,
  useAutosave,
  writeShadow,
  type DraftShadow,
} from '@portfoliopro/editor-kit';
import { SCHEMA_VERSION, SnapshotSchema, type Snapshot } from '@portfoliopro/snapshot-schema';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useEditorStore } from '../store/editorStore';

interface GetDraftResponse {
  draft: unknown;
  draftUpdatedAt: string;
  draftSchemaVersion: number;
}

interface UpdateDraftResponse {
  draftUpdatedAt: string;
}

export type DraftLoadState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready' };

/**
 * Loads the draft once on mount, applies the localStorage-shadow-wins-if-strictly-
 * newer reconciliation, then hands the value to the editor store and to
 * useAutosave for ongoing saves. Snapshot mutations come from the store; this
 * hook is the bridge between the store and the network/localStorage.
 */
export function useDraftAutosave(portfolioId: string): {
  load: DraftLoadState;
  saveStatus: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
  saveError: Error | null;
} {
  const [load, setLoad] = useState<DraftLoadState>({ status: 'loading' });
  const init = useEditorStore((s) => s.init);
  const markClean = useEditorStore((s) => s.markClean);
  const snapshot = useEditorStore((s) => s.history.entries[s.history.index]!);
  const isDirty = useEditorStore((s) => s.isDirty);

  // Watch only the snapshot reference for autosave; immer's structural sharing
  // keeps the reference stable until something actually mutates.
  const value = useMemo(() => snapshot, [snapshot]);

  // One-shot load. The empty dependency on portfolioId is intentional — switching
  // portfolios would remount the route.
  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });

    void (async () => {
      try {
        const server = await apiFetch<GetDraftResponse>(`/api/portfolios/${portfolioId}/draft`);

        const serverParse = SnapshotSchema.safeParse(server.draft);
        if (!serverParse.success) {
          throw new Error('Server draft failed snapshot validation; refusing to mount editor.');
        }
        const serverSnapshot = serverParse.data;
        const serverUpdatedAtMs = new Date(server.draftUpdatedAt).getTime();

        // Try the shadow; if Zod tightening retroactively invalidated it, warn
        // once and fall back to server. Never crash the editor over a stale
        // shadow.
        let shadow: DraftShadow<Snapshot> | null = null;
        try {
          shadow = readShadow<Snapshot>(portfolioId, (raw: unknown) => {
            const parsed = SnapshotSchema.safeParse(raw);
            return parsed.success ? parsed.data : null;
          });
        } catch (err) {
          console.warn('[autosave] shadow load failed — falling back to server', err);
          shadow = null;
        }

        if (cancelled) return;
        if (shadowWins(shadow, serverUpdatedAtMs)) {
          // The shadow is strictly newer — apply it and let autosave catch up.
          init(shadow!.snapshot, { isDirty: true });
        } else {
          init(serverSnapshot, { isDirty: false });
        }
        setLoad({ status: 'ready' });
      } catch (err) {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setLoad({ status: 'error', error: e });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [portfolioId, init]);

  // Always write the shadow on every change so a tab crash mid-debounce loses
  // nothing. Synchronous; cheap.
  useEffect(() => {
    if (load.status !== 'ready') return;
    if (!isDirty) return;
    writeShadow(portfolioId, snapshot);
  }, [snapshot, portfolioId, isDirty, load.status]);

  const autosave = useAutosave({
    value,
    enabled: load.status === 'ready' && isDirty,
    onSave: async (next: Snapshot) => {
      const response = await apiFetch<UpdateDraftResponse>(`/api/portfolios/${portfolioId}/draft`, {
        method: 'PATCH',
        body: { draft: next, draftSchemaVersion: SCHEMA_VERSION },
      });
      // Server acknowledged — mark the store clean. The shadow stays as a
      // crash safety net but will be passed by the server next time if we
      // reload, because savedAt was set when the user last edited.
      void response;
      markClean();
    },
  });

  return { load, saveStatus: autosave.status, saveError: autosave.error };
}
